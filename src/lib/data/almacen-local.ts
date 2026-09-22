/**
 * El almacén contra el navegador.
 *
 * Mismo contrato que el de Firestore, para poder trabajar sin red, probar sin tocar la
 * base real y arrancar la app aunque no haya sesión. `escuchar` avisa a las demás
 * pestañas mediante el evento `storage`, así que dos ventanas abiertas se mantienen a la par.
 */

import { enRango, nuevoId, type Almacen, type Coleccion, type Desuscribir, type Documento } from './almacen';
import type { Ajustes, Apunte, Carpeta, Evento, ID, Layout, Rango, Tarea } from './tipos';

const CANAL = 'archicel:cambio';

function leerJSON<T>(clave: string, porDefecto: T): T {
  if (typeof window === 'undefined') return porDefecto;
  try {
    const crudo = window.localStorage.getItem(clave);
    return crudo ? (JSON.parse(crudo) as T) : porDefecto;
  } catch {
    return porDefecto;
  }
}

function escribirJSON(clave: string, valor: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(clave, JSON.stringify(valor));
    window.dispatchEvent(new CustomEvent(CANAL, { detail: clave }));
  } catch {
    /* almacenamiento bloqueado: la app sigue, solo que sin recordar */
  }
}

function alCambiar(clave: string, fn: () => void): Desuscribir {
  if (typeof window === 'undefined') return () => {};
  const propio = (e: Event) => {
    if ((e as CustomEvent<string>).detail === clave) fn();
  };
  const ajeno = (e: StorageEvent) => {
    if (e.key === clave) fn();
  };
  window.addEventListener(CANAL, propio);
  window.addEventListener('storage', ajeno);
  return () => {
    window.removeEventListener(CANAL, propio);
    window.removeEventListener('storage', ajeno);
  };
}

function crearColeccion<T extends { id: ID; fecha?: string }>(clave: string): Coleccion<T> {
  const todo = () => leerJSON<T[]>(clave, []);

  return {
    async listar(rango) {
      return enRango(todo() as Array<T & { fecha: string }>, rango) as T[];
    },

    async obtener(id) {
      return todo().find((d) => d.id === id) ?? null;
    },

    async guardar(entrada) {
      const lista = todo();
      const id = entrada.id ?? nuevoId();
      const doc = { ...(entrada as object), id } as T;
      const i = lista.findIndex((d) => d.id === id);
      if (i >= 0) lista[i] = doc;
      else lista.push(doc);
      escribirJSON(clave, lista);
      return doc;
    },

    async borrar(id) {
      escribirJSON(clave, todo().filter((d) => d.id !== id));
    },

    escuchar(cb, rango) {
      const emitir = () => cb(enRango(todo() as Array<T & { fecha: string }>, rango) as T[]);
      emitir();
      return alCambiar(clave, emitir);
    },
  };
}

/**
 * Un documento único, con rescate de versiones anteriores.
 *
 * Las claves llevan versión (`…​.v3`) para poder cambiar la forma de lo guardado sin leer
 * basura antigua. El precio, si no se hace nada más, es que **subir la versión borra el
 * trabajo de la usuaria**: la clave nueva está vacía y la aplicación arranca de cero.
 *
 * `anteriores` evita eso. La primera vez que se lee y la clave actual está vacía, se
 * busca hacia atrás, se copia lo que se encuentre a la clave nueva y se deja la vieja
 * donde está por si hiciera falta volver. Migrar deja de ser una decisión que se pueda
 * olvidar.
 */
function crearDocumento<T>(clave: string, anteriores: string[] = []): Documento<T> {
  const rescatar = (): T | null => {
    const actual = leerJSON<T | null>(clave, null);
    if (actual !== null) return actual;
    for (const vieja of anteriores) {
      const previo = leerJSON<T | null>(vieja, null);
      if (previo !== null) {
        escribirJSON(clave, previo);
        return previo;
      }
    }
    return null;
  };

  return {
    async leer() {
      return rescatar();
    },
    async escribir(valor) {
      escribirJSON(clave, valor);
    },
    escuchar(cb) {
      const emitir = () => cb(rescatar());
      emitir();
      return alCambiar(clave, emitir);
    },
  };
}

/** Las versiones anteriores de la disposición, de la más reciente a la más vieja. */
function clavesLayout(superficie: string) {
  const de = (v: number) => `archicel.layout.${superficie}.v${v}`;
  return { actual: de(3), anteriores: [de(2), de(1)] };
}

export function crearAlmacenLocal(): Almacen {
  return {
    uid: 'local',
    eventos: crearColeccion<Evento>('archicel.eventos.v1'),
    tareas: crearColeccion<Tarea>('archicel.tareas-dia.v1'),
    apuntes: crearColeccion<Apunte>('archicel.apuntes.v1'),
    carpetas: crearColeccion<Carpeta>('archicel.carpetas.v1'),
    ajustes: crearDocumento<Ajustes>('archicel.ajustes.v1'),
    layout: (superficie: string) => {
      const { actual, anteriores } = clavesLayout(superficie);
      return crearDocumento<Layout>(actual, anteriores);
    },
  };
}
