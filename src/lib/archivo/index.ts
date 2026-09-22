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
 *   · **al subir** manda el preferido — Drive si hay permiso, este equipo si no;
 *   · **al abrir y al borrar** manda el `proveedor` que lleve el propio apunte.
 *
 * Esa es toda la lógica, y es la que permite que los dos convivan sin que ninguna
 * pantalla tenga que saber que son dos.
 */

import { crearArchivadorDrive } from './archivador-drive';
import { crearArchivadorLocal } from './archivador-local';
import { conseguirToken, hayClienteConfigurado, hayPermiso, seHaUsadoDrive, yaEstaConectado } from './google';
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

/** Si esta persona usa Drive, aunque su sesión esté caducada ahora mismo. */
export function driveEsLoNormal(): boolean {
  return hayClienteConfigurado() && seHaUsadoDrive();
}

/** Si Drive está conectado **ahora**, en esta pestaña. */
export function driveConectado(): boolean {
  return hayClienteConfigurado() && hayPermiso();
}

export function elArchivador(): Archivador & { conectarDrive(): Promise<void> } {
  return {
    get nombre() {
      return driveConectado() ? ('drive' as const) : ('local' as const);
    },

    disponible: () => elLocal().disponible() || driveConectado(),

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
     * Sube por el preferido, **renovando antes de rendirse**.
     *
     * Sin esto, pasada la hora el token deja de valer y la subida se iba al disco en
     * silencio: creías que estaba en Drive y estaba en el portátil. Eso es peor que un
     * error, porque un error se ve.
     *
     * Así que si esta persona usa Drive, primero se intenta renovar. Con el permiso ya
     * concedido eso no enseña nada, y funciona porque esta llamada nace de un gesto —
     * pulsar subir o soltar un fichero.
     *
     * Y si aun así no se puede, **se guarda igual en el equipo y se dice**: el `remoto`
     * que vuelve lleva `proveedor: 'local'`, y quien llamó compara con lo que esperaba.
     * Perder el fichero por no poder guardarlo donde tocaba sería el peor de los finales.
     */
    async subir(fichero, destino, alAvanzar) {
      if (driveConectado()) return elDrive().subir(fichero, destino, alAvanzar);

      if (hayClienteConfigurado() && seHaUsadoDrive()) {
        try {
          await conseguirToken(true);
          return await elDrive().subir(fichero, destino, alAvanzar);
        } catch {
          /* ni renovando: al disco, y que se note */
        }
      }

      return elLocal().subir(fichero, destino, alAvanzar);
    },

    /* Una carpeta se crea donde vayan a ir sus ficheros: por el preferido. */
    async crearCarpeta(nombre, destino) {
      if (driveConectado()) return elDrive().crearCarpeta(nombre, destino);
      if (hayClienteConfigurado() && seHaUsadoDrive()) {
        try {
          await conseguirToken(true);
          return await elDrive().crearCarpeta(nombre, destino);
        } catch {
          /* al disco, como con los ficheros */
        }
      }
      return elLocal().crearCarpeta(nombre, destino);
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
export * from './archivador';
export { soltarPermiso } from './google';
