/**
 * El catálogo de widgets del escritorio.
 *
 * Añadir uno nuevo es añadir una entrada aquí y su componente en `components/widgets.tsx`.
 * El motor de posición, el editor y la persistencia no se tocan.
 *
 * `def` se escribe en celdas de una rejilla de 12 por comodidad al pensarlo; el motor lo
 * traduce a fracciones y píxeles, que es como se guarda de verdad.
 */

import type { Caja, Layout } from '@/lib/data';

export interface DefinicionWidget {
  id: string;
  titulo: string;
  /** Posición de fábrica, en celdas de 12 columnas y filas de 44 px. */
  def: { x: number; y: number; w: number; h: number };
  /** Tamaño mínimo, también en celdas. */
  min: { w: number; h: number };
  /** Usa el relleno más opaco (para lo que lleva dato crítico). */
  solido?: boolean;
}

export const COLUMNAS = 12;
export const FILA = 44;
export const HUECO = 12;
/** Píxeles de imantación a los bordes vecinos; con Alt no imanta. */
export const IMAN = 5;

export const WIDGETS: DefinicionWidget[] = [
  { id: 'bienvenida', titulo: 'Bienvenida', def: { x: 0, y: 0, w: 8, h: 4 }, min: { w: 2, h: 2 } },
  { id: 'reloj', titulo: 'Hora', def: { x: 8, y: 0, w: 4, h: 4 }, min: { w: 2, h: 2 } },
  /* la segunda fila corta por la misma columna que la primera: la vertical a dos tercios
     recorre el escritorio entero y es lo que lo sostiene con tan pocos bloques */
  { id: 'calendario', titulo: 'Calendario del mes', def: { x: 0, y: 4, w: 8, h: 10 }, min: { w: 3, h: 4 } },
  { id: 'pendientes', titulo: 'Pendientes', def: { x: 8, y: 4, w: 4, h: 10 }, min: { w: 2, h: 2 } },
];

export function desdeCeldas(d: DefinicionWidget['def']): Caja {
  return {
    fx: d.x / COLUMNAS,
    fw: d.w / COLUMNAS,
    y: d.y * (FILA + HUECO),
    h: d.h * FILA + (d.h - 1) * HUECO,
  };
}

export function minimoEnPixeles(def: DefinicionWidget): { w: number; h: number } {
  return { w: def.min.w * 96, h: def.min.h * FILA };
}

export function layoutPorDefecto(): Layout {
  const l: Layout = {};
  WIDGETS.forEach((w) => {
    l[w.id] = desdeCeldas(w.def);
  });
  return l;
}

/**
 * Mezcla lo guardado con el catálogo actual: lo que existe conserva su sitio, lo nuevo
 * entra en su posición de fábrica y lo retirado **se conserva sin tocar**. Por eso
 * publicar widgets nuevos no descoloca el escritorio de nadie.
 *
 * Lo de conservar lo retirado importa más de lo que parece. Antes se descartaba, y como
 * lo que se descarta también se guarda, quitar un widget del catálogo un rato borraba su
 * posición para siempre: al devolverlo, aparecía en su sitio de fábrica y había que
 * recolocarlo. Ahora su caja sigue ahí, invisible y sin estorbar —nadie la pinta, porque
 * para pintarse hace falta estar en `WIDGETS`—, esperando a que el widget vuelva.
 */
export function fusionarLayout(guardado: Layout | null): Layout {
  const base = layoutPorDefecto();
  if (!guardado) return base;
  const conocidos = new Set(WIDGETS.map((w) => w.id));
  const salida: Layout = {};
  Object.entries(guardado).forEach(([id, caja]) => {
    if (!conocidos.has(id) && caja && typeof caja.fx === 'number') salida[id] = caja;
  });
  WIDGETS.forEach((w) => {
    const g = guardado[w.id];
    salida[w.id] =
      g && typeof g.fx === 'number' && typeof g.y === 'number'
        ? {
            fx: Math.min(Math.max(g.fx, 0), 0.95),
            fw: Math.min(Math.max(g.fw, 0.08), 1),
            y: Math.max(0, g.y),
            h: Math.max(80, g.h),
            desnudo: Boolean(g.desnudo),
          }
        : base[w.id];
  });
  return salida;
}
