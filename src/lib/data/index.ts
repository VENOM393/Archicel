/**
 * Aquí se decide dónde viven los datos, y es el único sitio donde se decide.
 *
 *   hay sesión  → Firestore (y la app sigue a Celeste entre dispositivos)
 *   no la hay   → el navegador (y la app funciona igual, solo que sin salir de aquí)
 *
 * También vive aquí la migración: la primera vez que entra con su cuenta, lo que tenía
 * guardado en el navegador sube a la nube y no se pierde nada.
 */

import { crearAlmacenFirestore } from './almacen-firestore';
import { crearAlmacenLocal } from './almacen-local';
import { conEspejoLocal } from './espejo';
import type { Almacen } from './almacen';

export * from './tipos';
export * from './curso';
export type { Almacen, Coleccion, Documento, Desuscribir } from './almacen';

/** Se avisa a quien quiera enterarse de que la nube rechazó una escritura. */
export type AvisoDeFallo = (error: unknown) => void;
let avisarDeFallo: AvisoDeFallo | null = null;

/**
 * Registra a quién avisar cuando una escritura en la nube falla.
 *
 * La capa de datos no sabe pintar un mensaje y la interfaz no debería saber de Firestore;
 * esto es el cable entre las dos. Sin él, un fallo de escritura se tragaba en un
 * `catch` vacío y la usuaria solo se enteraba al día siguiente, al ver su escritorio
 * como el primer día.
 */
export function registrarAvisoDeFallo(fn: AvisoDeFallo | null): void {
  avisarDeFallo = fn;
}

export function crearAlmacen(uid: string | null): Almacen {
  const local = crearAlmacenLocal();
  if (uid) {
    const nube = crearAlmacenFirestore(uid);
    if (nube) {
      return {
        ...nube,
        /**
         * La disposición del escritorio va siempre con copia en este equipo.
         *
         * Es el único dato que la usuaria coloca a mano, bloque a bloque, y el único que
         * no se puede volver a escribir de memoria si se pierde. El resto —tareas,
         * eventos— se teclea otra vez en un minuto; recolocar el escritorio, no.
         */
        layout: (superficie: string) =>
          conEspejoLocal(nube.layout(superficie), local.layout(superficie), {
            alFallar: (e) => avisarDeFallo?.(e),
          }),
      };
    }
  }
  return local;
}

const MARCA_MIGRACION = 'archicel.migrado.v1';

/**
 * Sube a la nube lo que hubiera en el navegador. Se ejecuta una sola vez por usuario:
 * deja una marca para no duplicar nada en el siguiente arranque.
 */
export async function migrarLocalANube(uid: string): Promise<{ eventos: number; tareas: number } | null> {
  if (typeof window === 'undefined') return null;
  const clave = `${MARCA_MIGRACION}.${uid}`;
  if (window.localStorage.getItem(clave)) return null;

  const local = crearAlmacenLocal();
  const nube = crearAlmacenFirestore(uid);
  if (!nube) return null;

  const [eventos, tareas, ajustes, layout] = await Promise.all([
    local.eventos.listar(),
    local.tareas.listar(),
    local.ajustes.leer(),
    local.layout('escritorio').leer(),
  ]);

  await Promise.all([
    ...eventos.map((e) => nube.eventos.guardar(e)),
    ...tareas.map((t) => nube.tareas.guardar(t)),
    ajustes ? nube.ajustes.escribir(ajustes) : Promise.resolve(),
    layout ? nube.layout('escritorio').escribir(layout) : Promise.resolve(),
  ]);

  window.localStorage.setItem(clave, new Date().toISOString());
  return { eventos: eventos.length, tareas: tareas.length };
}
