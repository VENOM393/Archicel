/**
 * El almacén contra Firestore.
 *
 * Estructura (la misma que documenta docs/data/FIRESTORE.md):
 *   users/{uid}/eventos/{id}
 *   users/{uid}/tareas/{id}
 *   users/{uid}/apuntes/{id}
 *   users/{uid}/ajustes/app
 *   users/{uid}/layout/{superficie}
 *
 * Los rangos de fecha se filtran en el servidor, así que traer "la semana" no descarga el curso entero.
 */

import {
  collection, deleteDoc, doc, getDoc, getDocs, onSnapshot,
  orderBy, query, serverTimestamp, setDoc, where,
  type CollectionReference, type Firestore, type QueryConstraint,
} from 'firebase/firestore';

import { getDb } from '@/lib/firebase/config';
import { nuevoId, type Almacen, type Coleccion, type Desuscribir, type Documento } from './almacen';
import type { Ajustes, Apunte, Evento, ID, Layout, Rango, Tarea } from './tipos';

/**
 * Por qué el campo de orden es un parámetro y no siempre `fecha`.
 *
 * Firestore **excluye de una consulta los documentos que no tienen el campo por el que se
 * ordena**. No da error, no avisa: devuelve una lista vacía. Una colección sin `fecha`
 * —los apuntes, que se ordenan por cuándo se subieron— pedida con `orderBy('fecha')` se
 * ve exactamente igual que una colección vacía, y esa es la clase de fallo que se busca
 * durante una tarde en el sitio equivocado.
 */
function restricciones(rango: Rango | undefined, orden: string): QueryConstraint[] {
  const cs: QueryConstraint[] = [];
  if (rango?.desde) cs.push(where('fecha', '>=', rango.desde));
  if (rango?.hasta) cs.push(where('fecha', '<=', rango.hasta));
  cs.push(orderBy(orden));
  return cs;
}

function crearColeccion<T extends { id: ID }>(db: Firestore, ruta: string, orden = 'fecha'): Coleccion<T> {
  const ref = collection(db, ruta) as CollectionReference<Omit<T, 'id'>>;

  return {
    async listar(rango) {
      const inst = await getDocs(query(ref, ...restricciones(rango, orden)));
      return inst.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as T);
    },

    async obtener(id) {
      const inst = await getDoc(doc(db, ruta, id));
      return inst.exists() ? ({ ...(inst.data() as object), id: inst.id } as T) : null;
    },

    async guardar(entrada) {
      const id = entrada.id ?? nuevoId();
      const { id: _omitido, ...datos } = entrada as { id?: ID } & Record<string, unknown>;
      await setDoc(
        doc(db, ruta, id),
        { ...datos, actualizado: serverTimestamp(), ...(entrada.id ? {} : { creado: serverTimestamp() }) },
        { merge: true },
      );
      return { ...(datos as object), id } as T;
    },

    async borrar(id) {
      await deleteDoc(doc(db, ruta, id));
    },

    escuchar(cb, rango): Desuscribir {
      return onSnapshot(query(ref, ...restricciones(rango, orden)), (inst) => {
        cb(inst.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as T));
      });
    },
  };
}

function crearDocumento<T>(db: Firestore, ruta: string): Documento<T> {
  return {
    async leer() {
      const inst = await getDoc(doc(db, ruta));
      return inst.exists() ? (inst.data() as T) : null;
    },
    async escribir(valor) {
      await setDoc(doc(db, ruta), { ...(valor as object), actualizado: serverTimestamp() }, { merge: true });
    },
    escuchar(cb): Desuscribir {
      return onSnapshot(doc(db, ruta), (inst) => cb(inst.exists() ? (inst.data() as T) : null));
    },
  };
}

export function crearAlmacenFirestore(uid: string): Almacen | null {
  const db = getDb();
  if (!db) return null;
  const raiz = `users/${uid}`;

  return {
    uid,
    eventos: crearColeccion<Evento>(db, `${raiz}/eventos`),
    tareas: crearColeccion<Tarea>(db, `${raiz}/tareas`),
    /* por `creado`: un apunte no tiene fecha de calendario, tiene momento de subida */
    apuntes: crearColeccion<Apunte>(db, `${raiz}/apuntes`, 'creado'),
    ajustes: crearDocumento<Ajustes>(db, `${raiz}/ajustes/app`),
    layout: (superficie: string) => crearDocumento<Layout>(db, `${raiz}/layout/${superficie}`),
  };
}
