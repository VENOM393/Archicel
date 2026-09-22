/**
 * Quién guarda los bytes hoy.
 *
 * La misma línea única que tiene el almacén en `data/index.ts`: cuando exista
 * `archivador-drive`, cambiar de uno a otro se decide **aquí** y en ningún otro sitio.
 * Ninguna pantalla importa una implementación concreta; todas piden `elArchivador()`.
 */

import { crearArchivadorLocal } from './archivador-local';
import type { Archivador } from './archivador';

let unico: Archivador | null = null;

/** Uno solo por pestaña: abrir IndexedDB una vez por componente sería absurdo. */
export function elArchivador(): Archivador {
  unico ??= crearArchivadorLocal();
  return unico;
}

export * from './archivador';
