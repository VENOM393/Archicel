/**
 * Quién es la usuaria, y lo que cabe en una ficha.
 *
 * Dos cosas pequeñas que varias partes de la aplicación necesitan decir igual, y que por
 * eso viven en un solo sitio.
 */

/**
 * El nombre de la usuaria. **La interfaz nunca lo escribe a mano**: sale de aquí, para que
 * cambiarlo sea tocar una línea y no buscarlo por las pantallas.
 */
export const USUARIA = 'Celeste';

/** Los topes de texto que valida `firestore.rules`. Una ficha que se pase la rechaza entera. */
export const TOPES = {
  asignatura: 120,
  nombreApunte: 300,
  nombreCarpeta: 200,
  tipo: 120,
} as const;

/**
 * Un nombre dentro de su tope, acortado **por el medio** y conservando la extensión.
 *
 * Un nombre más largo lo rechazaban las reglas **después** de haber subido el fichero —o a
 * mitad de la migración, que entonces no terminaba nunca—. Cortar por el final se comería
 * la extensión, que es lo que dice qué es; en Drive el fichero se queda con su nombre
 * entero.
 */
export function acortar(nombre: string, tope: number): string {
  if (nombre.length <= tope) return nombre;
  const i = nombre.lastIndexOf('.');
  const ext = i > 0 && nombre.length - i <= 16 ? nombre.slice(i) : '';
  return `${nombre.slice(0, tope - ext.length - 1)}…${ext}`;
}
