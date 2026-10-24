/**
 * El arrastre de la agenda: mover algo de día o de hora cogiéndolo.
 *
 * Es su propio tipo de arrastre y no el de los apuntes a propósito. Con un tipo común, un
 * apunte soltado sobre una casilla del calendario habría encendido la diana y después no
 * habría pasado nada — y una diana que se enciende es una promesa. Con tipos distintos, el
 * navegador ni siquiera deja empezar el gesto sobre la superficie equivocada.
 *
 * Lo mismo vale al revés: el planificador del día tiene el suyo
 * (`application/x-archicel-bloque`) y no se cruzan.
 */

export const TIPO_AGENDA = 'application/x-archicel-agenda';

export interface CargaAgenda {
  que: 'evento' | 'tarea' | 'bloque';
  id: string;
  /**
   * Píxeles entre el borde de arriba de la pieza y donde se la cogió.
   *
   * Sin esto, soltar coloca la pieza con su borde superior justo bajo el cursor, así que
   * saltaba hacia arriba una cantidad distinta cada vez según por dónde se hubiera
   * agarrado. Solo lo usa la agenda del día, que es la única que mueve en vertical.
   */
  agarre?: number;
}

/** Deja la carga en el gesto. Devuelve el `onDragStart` listo para usar. */
export function cargar(e: DataTransfer, c: CargaAgenda): void {
  e.setData(TIPO_AGENDA, JSON.stringify(c));
  e.effectAllowed = 'move';
}

/** Lo que viene en el gesto, o `null` si no es nuestro o está corrupto. */
export function descargar(e: DataTransfer): CargaAgenda | null {
  try {
    const crudo = e.getData(TIPO_AGENDA);
    if (!crudo) return null;
    const c = JSON.parse(crudo) as CargaAgenda;
    return c && typeof c.id === 'string' && c.que ? c : null;
  } catch {
    return null;
  }
}

/** ¿Este gesto trae algo de la agenda? Se mira en `dragover`, donde el valor no se puede leer. */
export function esDeLaAgenda(e: DataTransfer): boolean {
  return e.types.includes(TIPO_AGENDA);
}

/** El escalón al que se pega una hora arrastrada. Quince minutos es lo que se planifica. */
export const PASO_MINUTOS = 15;

/**
 * De una posición en píxeles dentro de la rejilla a minutos desde medianoche, pegado al
 * escalón y sin salirse del día que se pinta.
 */
export function minutosEn(
  y: number,
  { inicio, fin, altoHora }: { inicio: number; fin: number; altoHora: number },
): number {
  const crudo = inicio * 60 + (y / altoHora) * 60;
  const pegado = Math.round(crudo / PASO_MINUTOS) * PASO_MINUTOS;
  return Math.min(Math.max(pegado, inicio * 60), fin * 60);
}
