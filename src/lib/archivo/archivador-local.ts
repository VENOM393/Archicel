/**
 * El archivador de este equipo: los bytes en IndexedDB.
 *
 * Fue la fase 1 —lo que permitió construir la página de una asignatura sin haber tocado
 * Google— y durante un tiempo la caída cuando Drive no estaba. **Hoy no guarda nada
 * nuevo**: Archicel solo sube a Drive, porque un apunte en el portátil no viaja a otro
 * dispositivo, el navegador puede tirarlo cuando le falte espacio y, sobre todo, parece
 * guardado.
 *
 * Sigue existiendo para una sola cosa: que lo que se guardó aquí antes de ese cambio se
 * pueda **abrir y borrar**. Por eso `subir` y `crearCarpeta` se niegan con un fallo con
 * nombre en vez de escribir, aunque el encaminador nunca debería llamarlos.
 *
 * IndexedDB y no `localStorage` porque guarda `Blob` tal cual, sin pasarlos a base64.
 */

import { FalloDeArchivo, type Archivador, type Remoto } from './archivador';

const BASE = 'archicel.apuntes';
const VERSION = 1;
const ALMACEN = 'ficheros';

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

export function crearArchivadorLocal(): Archivador {
  const yaNo = () =>
    Promise.reject(new FalloDeArchivo('desconocida', 'Este equipo ya no guarda apuntes nuevos: van a Drive.'));
  return {
    nombre: 'local',

    /* En el servidor no hay IndexedDB, y esto se pregunta durante el render. */
    disponible: () => typeof indexedDB !== 'undefined',

    async conectar() {},

    subir: yaNo,
    crearCarpeta: yaNo,

    /* El nombre y el sitio viven en la ficha del almacén, no en el byte: aquí no hay nada
       que cambiar, y decir que sí es más honesto que fingir un trabajo. */
    async renombrar() {},
    async mover() {},

    async borrar(remoto: Remoto) {
      if (remoto.proveedor !== 'local') {
        throw new FalloDeArchivo('no-esta', 'Ese apunte no está guardado en este equipo.');
      }
      /* Una carpeta local nunca tuvo bytes, y borrar una clave que no existe no falla. */
      try {
        await conAlmacen('readwrite', (s) => s.delete(remoto.id));
      } catch (e) {
        throw new FalloDeArchivo('desconocida', 'No se pudo borrar del archivo de este equipo.', e);
      }
    },

    async leer(remoto: Remoto, op = {}) {
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
      op.alAvanzar?.(blob, 1);
      return blob;
    },
  };
}
