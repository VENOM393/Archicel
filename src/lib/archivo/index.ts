/**
 * Quién guarda los bytes, y quién los tenía ya.
 *
 * Esto no es un interruptor entre dos archivadores: es un **encaminador**, y la
 * diferencia importa. Un apunte guardado hace un mes en este equipo tiene que seguir
 * abriéndose después de conectar Drive. Si «el archivador» fuera uno solo y cambiara al
 * conectar, todo lo anterior dejaría de existir en el momento exacto en que la usuaria
 * hace algo que, para ella, solo debería añadir opciones.
 *
 * Así que:
 *
 *   · **al subir** va siempre a Drive, y si no se puede, falla — nunca a este equipo;
 *   · **al abrir y al borrar** manda el `proveedor` que lleve el propio apunte.
 *
 * Esa es toda la lógica, y es la que permite que los dos convivan sin que ninguna
 * pantalla tenga que saber que son dos.
 */

import { crearArchivadorDrive, olvidarQuien } from './archivador-drive';
import { crearArchivadorLocal } from './archivador-local';
import {
  conseguirToken, hayClienteConfigurado, hayPermiso, seHaUsadoDrive, soltarPermiso, yaEstaConectado,
} from './google';
import { FalloDeArchivo, type Archivador, type Remoto } from './archivador';

let local: Archivador | null = null;
let drive: Archivador | null = null;

/** Uno de cada por pestaña: abrir IndexedDB una vez por componente sería absurdo. */
function elLocal(): Archivador {
  local ??= crearArchivadorLocal();
  return local;
}

function elDrive(): Archivador {
  drive ??= crearArchivadorDrive();
  return drive;
}

/** El que corresponde a un apunte concreto, que es el que lo guardó. */
function paraRemoto(remoto: Remoto): Archivador {
  return remoto.proveedor === 'drive' ? elDrive() : elLocal();
}

/** Si Drive está configurado en este despliegue. Sin ID de cliente no se ofrece nada. */
export function sePuedeUsarDrive(): boolean {
  return hayClienteConfigurado();
}

/**
 * Si al abrir la página ya se puede usar Drive, sin abrir nada ni preguntar a nadie.
 *
 * Es una lectura del token recordado y nada más. Lo que hace que recargar deje de pedir
 * permisos no es reconectar: es que el token de la vez anterior **sigue valiendo**.
 */
export function reconectarDriveEnSilencio(): Promise<boolean> {
  return Promise.resolve(yaEstaConectado());
}

/** Si Drive está conectado **ahora**, en esta pestaña. */
export function driveConectado(): boolean {
  return hayClienteConfigurado() && hayPermiso();
}

/**
 * Si se conectó alguna vez en este navegador y no se ha desconectado, aunque el token
 * haya caducado. Es lo que distingue «pasó la hora, la siguiente acción lo renueva» de
 * «nunca se conectó» — dos pantallas distintas con el mismo `driveConectado() === false`.
 */
export function driveRecordado(): boolean {
  return hayClienteConfigurado() && seHaUsadoDrive();
}

/**
 * Desconecta Drive de este navegador.
 *
 * Retira el permiso en Google y olvida el token recordado y la cuenta. Lo que el archivador
 * recuerde de esa cuenta —los ids de carpeta— lo suelta él mismo en `olvidarQuien`, que es
 * quien sabe cómo lo guarda. **No borra nada de Drive**: los ficheros siguen donde
 * estaban y las fichas de Archicel también; al volver a conectar la misma cuenta, todo
 * se abre como antes.
 *
 * Devuelve si Google confirmó la revocación (ver `soltarPermiso`).
 */
export async function desconectarDrive(): Promise<boolean> {
  olvidarQuien();
  return soltarPermiso();
}

/**
 * Deja Drive listo o explica por qué no.
 *
 * Se llama antes de cualquier escritura. Si el token caducó lo renueva, y como esto se
 * invoca desde un gesto —pulsar subir, soltar un fichero, crear una carpeta— Google deja
 * abrir su ventana; con el permiso ya concedido no se ve nada.
 */
async function asegurarDrive(): Promise<void> {
  if (!hayClienteConfigurado()) {
    throw new FalloDeArchivo('sin-permiso', 'Drive no está configurado en esta aplicación.');
  }
  if (driveConectado()) return;
  try {
    await conseguirToken(true);
  } catch (e) {
    throw new FalloDeArchivo(
      'sin-permiso',
      e instanceof Error && e.message ? e.message : 'Drive no está conectado.',
      e,
    );
  }
}

export function elArchivador(): Archivador & { conectarDrive(): Promise<void> } {
  return {
    /* Siempre Drive: el archivador local sigue existiendo, pero solo para **abrir y
       borrar** lo que se guardó ahí antes de este cambio. Nada nuevo va a parar al disco. */
    nombre: 'drive' as const,

    disponible: () => driveConectado(),

    /** Sin Drive configurado no hay nada que conectar, y decirlo es mejor que fallar. */
    async conectar() {
      if (!hayClienteConfigurado()) {
        throw new FalloDeArchivo('sin-permiso', 'Drive no está configurado en esta aplicación.');
      }
      await elDrive().conectar();
    },

    conectarDrive() {
      return this.conectar();
    },

    /**
     * Sube a Drive. **Y si no se puede, falla.**
     *
     * Antes caía al disco cuando Drive no estaba disponible, y eso se quitó a propósito:
     * un apunte guardado en el portátil no está en ningún sitio útil. No viaja a otro
     * dispositivo, el navegador puede tirarlo cuando le falte espacio, y sobre todo
     * **parece guardado**. Media carrera de apuntes en un almacenamiento que se borra solo
     * es peor final que una subida que se niega a ocurrir.
     *
     * Así que aquí solo hay dos caminos: Drive, o un fallo con nombre que la pantalla sabe
     * explicar y reintentar.
     */
    async subir(fichero, destino, alAvanzar) {
      await asegurarDrive();
      return elDrive().subir(fichero, destino, alAvanzar);
    },

    async crearCarpeta(nombre, destino) {
      await asegurarDrive();
      return elDrive().crearCarpeta(nombre, destino);
    },

    renombrar(remoto, nombre) {
      return paraRemoto(remoto).renombrar(remoto, nombre);
    },

    mover(remoto, desde, hasta, destino) {
      return paraRemoto(remoto).mover(remoto, desde, hasta, destino);
    },

    borrar(remoto) {
      return paraRemoto(remoto).borrar(remoto);
    },

    enlace(remoto) {
      return paraRemoto(remoto).enlace(remoto);
    },

    soltar(url) {
      /* Los dos sueltan objetos locales, así que da igual cuál; se usa el de aquí. */
      elLocal().soltar(url);
    },
  };
}

export { deQuienEsElDrive } from './archivador-drive';
export * from './iconos';
export * from './archivador';
export { alCambiarDrive } from './google';
