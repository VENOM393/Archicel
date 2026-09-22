/**
 * El archivador de este equipo: los bytes en IndexedDB.
 *
 * No es un apaño mientras llega Drive. Cumple dos funciones que se quedan:
 *
 *   1 · **Archicel funciona sin cuenta y sin permisos.** La cuenta es una invitación, no
 *       un muro, y eso vale también para los apuntes: se puede abrir la aplicación,
 *       arrastrar un PDF a una asignatura y verlo, sin haberle concedido nada a Google.
 *   2 · **La pantalla no depende de que el permiso esté concedido.** Sin esto, lo primero
 *       que vería alguien al entrar en una asignatura sería un error, y eso es
 *       exactamente lo que esta aplicación no puede permitirse.
 *
 * ## Por qué IndexedDB y no localStorage
 *
 * `localStorage` guarda texto y tiene un tope de unos 5 MB para todo el dominio. Un solo
 * PDF de teoría se lo come. IndexedDB guarda `Blob` tal cual —sin pasarlos a base64, que
 * los hincha un tercio— y su límite lo marca el disco, no una constante.
 *
 * ## Lo que este archivador no puede hacer, y está bien
 *
 * Lo guardado aquí **no viaja a otro dispositivo** y el navegador puede tirarlo si se
 * queda sin espacio. No es un fallo del diseño: es lo que significa «en este equipo», y
 * es justo el motivo de que exista el de Drive. La interfaz lo dice con todas las letras
 * en vez de dejar que se descubra el día que no está.
 */

import { FalloDeArchivo, type Archivador, type Destino, type Remoto } from './archivador';

const BASE = 'archicel.apuntes';
const VERSION = 1;
const ALMACEN = 'ficheros';

/** 2 GB, el mismo tope que valida `firestore.rules`. Por encima no es un apunte. */
const TOPE = 2 * 1024 * 1024 * 1024;

let abierta: Promise<IDBDatabase> | null = null;

function abrir(): Promise<IDBDatabase> {
  if (abierta) return abierta;
  abierta = new Promise((resolver, rechazar) => {
    if (typeof indexedDB === 'undefined') {
      rechazar(new FalloDeArchivo('desconocida', 'Este navegador no guarda ficheros.'));
      return;
    }
    const pet = indexedDB.open(BASE, VERSION);
    pet.onupgradeneeded = () => {
      if (!pet.result.objectStoreNames.contains(ALMACEN)) pet.result.createObjectStore(ALMACEN);
    };
    pet.onsuccess = () => resolver(pet.result);
    pet.onerror = () => rechazar(new FalloDeArchivo('desconocida', 'No se pudo abrir el archivo local.', pet.error));
  });
  return abierta;
}

/**
 * Una operación sobre el almacén, envuelta en promesa.
 *
 * IndexedDB trabaja con sucesos y no con promesas, y mezclar las dos cosas a mano en cada
 * llamada es como se acaba con transacciones que nadie cierra. Aquí se hace una vez.
 */
async function conAlmacen<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir();
  return new Promise((resolver, rechazar) => {
    const tx = db.transaction(ALMACEN, modo);
    const pet = fn(tx.objectStore(ALMACEN));
    pet.onsuccess = () => resolver(pet.result);
    pet.onerror = () => rechazar(pet.error);
    tx.onerror = () => rechazar(tx.error);
  });
}

function idNuevo(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function crearArchivadorLocal(): Archivador {
  return {
    nombre: 'local',

    /* En el servidor no hay IndexedDB, y esto se pregunta durante el render. */
    disponible: () => typeof indexedDB !== 'undefined',

    /* No hay nada que conceder: guardar aquí no le pide permiso a nadie. */
    async conectar() {},

    async subir(fichero, destino: Destino, alAvanzar) {
      if (fichero.size > TOPE) {
        throw new FalloDeArchivo('demasiado-grande', 'Ese fichero es demasiado grande.');
      }

      const id = `${destino.asignatura}/${idNuevo()}`;

      /*
       * El progreso se anuncia entero al terminar, y no en pasos inventados.
       *
       * Escribir en IndexedDB es inmediato: no hay nada que trocear ni nada que esperar.
       * Fingir un 30 %, un 60 % y un 100 % con temporizadores sería una barra que no mide
       * nada, y una barra que miente es peor que ninguna — enseña a no fiarse de la
       * siguiente, que sí medirá algo (la de Drive).
       */
      try {
        await conAlmacen('readwrite', (s) => s.put(fichero, id));
      } catch (e) {
        /* `QuotaExceededError` es el nombre que da el navegador cuando no cabe. */
        const nombre = (e as DOMException | null)?.name;
        if (nombre === 'QuotaExceededError') {
          throw new FalloDeArchivo('sin-sitio', 'No queda sitio en este equipo.', e);
        }
        throw new FalloDeArchivo('desconocida', 'No se pudo guardar el fichero.', e);
      }
      alAvanzar?.(1);

      return { proveedor: 'local', id };
    },

    async borrar(remoto: Remoto) {
      if (remoto.proveedor !== 'local') {
        throw new FalloDeArchivo('no-esta', 'Ese apunte no está guardado en este equipo.');
      }
      await conAlmacen('readwrite', (s) => s.delete(remoto.id));
    },

    async enlace(remoto: Remoto) {
      if (remoto.proveedor !== 'local') {
        throw new FalloDeArchivo('no-esta', 'Ese apunte no está guardado en este equipo.');
      }
      const blob = await conAlmacen<Blob | undefined>('readonly', (s) => s.get(remoto.id));
      if (!blob) {
        /*
         * La ficha está en el almacén pero el byte no está aquí. Pasa de verdad: el
         * navegador limpia su almacenamiento, o la ficha llegó de otro dispositivo por la
         * nube y el fichero se quedó en el de origen. La pantalla tiene que sobrevivir a
         * esto, y por eso es un fallo con nombre y no un `undefined` que reviente arriba.
         */
        throw new FalloDeArchivo('no-esta', 'Este apunte no está en este equipo.');
      }
      return URL.createObjectURL(blob);
    },

    soltar(url) {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    },
  };
}
