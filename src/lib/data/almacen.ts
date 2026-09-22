/**
 * El contrato del almacén.
 *
 * La interfaz de la app **nunca** habla con Firestore ni con localStorage: habla con esto.
 * Hay dos implementaciones (`almacen-local` y `almacen-firestore`) y elegir una es una línea
 * en `index.ts`. Por eso se puede trabajar sin conexión, probar sin tocar la base real y
 * migrar sin reescribir ni una pantalla.
 *
 * Añadir una colección nueva (asignaturas, proyectos, referencias…) es:
 *   1. su tipo en `tipos.ts`
 *   2. una línea en la interfaz `Almacen`
 *   3. una línea en cada implementación
 */

import type { Ajustes, ID, Layout, Rango } from './tipos';

export type Desuscribir = () => void;

/** Una colección de documentos con id. */
export interface Coleccion<T extends { id: ID }> {
  listar(rango?: Rango): Promise<T[]>;
  obtener(id: ID): Promise<T | null>;
  /** Crea si no existe, actualiza si existe. Devuelve el documento con su id definitivo. */
  guardar(doc: Omit<T, 'id'> & { id?: ID }): Promise<T>;
  borrar(id: ID): Promise<void>;
  /** Se llama de inmediato con lo que haya y luego en cada cambio. */
  escuchar(cb: (docs: T[]) => void, rango?: Rango): Desuscribir;
}

/** Un documento único (ajustes, una disposición…). */
export interface Documento<T> {
  leer(): Promise<T | null>;
  escribir(valor: T): Promise<void>;
  escuchar(cb: (valor: T | null) => void): Desuscribir;
}

export interface Almacen {
  /** Identificador de quien está usando la app; `local` cuando no hay sesión. */
  readonly uid: string;
  readonly eventos: Coleccion<import('./tipos').Evento>;
  readonly tareas: Coleccion<import('./tipos').Tarea>;
  readonly apuntes: Coleccion<import('./tipos').Apunte>;
  readonly ajustes: Documento<Ajustes>;
  /** Una disposición por superficie: `layout('escritorio')`. */
  layout(superficie: string): Documento<Layout>;
}

/** Genera un id cuando el almacén no lo hace por su cuenta. */
export function nuevoId(prefijo = 'd'): ID {
  return `${prefijo}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Aplica un rango de fechas en memoria; los almacenes que no filtran en origen lo usan. */
export function enRango<T extends { fecha: string }>(docs: T[], rango?: Rango): T[] {
  if (!rango) return docs;
  return docs.filter((d) => {
    if (rango.desde && d.fecha < rango.desde) return false;
    if (rango.hasta && d.fecha > rango.hasta) return false;
    return true;
  });
}
