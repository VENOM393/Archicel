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
import { conseguirToken, hayClienteConfigurado, hayPermiso, seConcedioAntes } from './google';
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
 * Vuelve a conectar sin enseñar nada, si ya se concedió alguna vez.
 *
 * Se llama al abrir una asignatura, y **solo si ya se concedió alguna vez**. Esa
 * condición no es una optimización: pedir en silencio a quien nunca ha concedido nada
 * abre una ventana que el navegador bloquea, por no venir de un clic — y una ventana
 * bloqueada no contesta, así que el intento se queda colgado y envenena al siguiente.
 * Eso es lo que dejaba el botón en «Conectando…» para siempre.
 */
export async function reconectarDriveEnSilencio(): Promise<boolean> {
  if (!hayClienteConfigurado() || !seConcedioAntes()) return false;
  try {
    await conseguirToken(false);
    return true;
  } catch {
    return false;
  }
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

    subir(fichero, destino, alAvanzar) {
      return (driveConectado() ? elDrive() : elLocal()).subir(fichero, destino, alAvanzar);
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

export * from './archivador';
export { soltarPermiso } from './google';
