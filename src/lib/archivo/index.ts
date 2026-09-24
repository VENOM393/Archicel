/**
 * Quién guarda los bytes, y quién los tenía ya.
 *
 * Esto no es un interruptor entre dos archivadores: es un **encaminador**, y la
 * diferencia importa. Un apunte guardado hace meses en el archivo del navegador tiene que
 * seguir abriéndose aunque hoy todo vaya a Drive. Si «el archivador» fuera uno solo, todo
 * lo anterior habría dejado de existir el día que las subidas pasaron a Drive.
 *
 * Así que:
 *
 *   · **al subir y al crear carpetas** manda siempre Drive, y si no se puede, falla con
 *     nombre — nada nuevo va a parar al disco;
 *   · **al abrir, borrar, renombrar y mover** manda el `proveedor` que lleve el propio
 *     apunte.
 *
 * Esa es toda la lógica, y es la que permite que los dos convivan sin que ninguna
 * pantalla tenga que saber que son dos.
 */

import { crearArchivadorDrive } from './archivador-drive';
import { crearArchivadorLocal } from './archivador-local';
import { hayClienteConfigurado, hayPermiso, yaEstaConectado } from './google';
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

/** Sin ID de cliente no hay a quién pedirle nada, y decirlo es mejor que fallar. */
function exigirConfigurado(): void {
  if (!hayClienteConfigurado()) {
    throw new FalloDeArchivo('sin-conexion', 'Drive no está configurado en esta aplicación.');
  }
}

export function elArchivador(): Archivador {
  return {
    /* Siempre Drive: el archivador local sigue existiendo, pero solo para **abrir y
       borrar** lo que se guardó ahí antes. Nada nuevo va a parar al disco. */
    nombre: 'drive' as const,

    disponible: () => driveConectado(),

    async conectar() {
      exigirConfigurado();
      await elDrive().conectar();
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
     * Si el token caducó, el archivador de Drive lo renueva en su primera línea: esto se
     * llama desde un gesto y Google deja abrir su ventana; con el permiso ya concedido no
     * se ve nada.
     */
    async subir(fichero, destino, alAvanzar) {
      exigirConfigurado();
      return elDrive().subir(fichero, destino, alAvanzar);
    },

    async crearCarpeta(nombre, destino) {
      exigirConfigurado();
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

    leer(remoto, opciones) {
      return paraRemoto(remoto).leer(remoto, opciones);
    },
  };
}

export { deQuienEsElDrive, precargar, prepararCarpeta } from './archivador-drive';
export * from './iconos';
export * from './archivador';
export * from './explicar';
export { soltarPermiso } from './google';
export * from './arbol';
