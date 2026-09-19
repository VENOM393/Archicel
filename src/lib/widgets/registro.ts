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
  { id: 'entrega', titulo: 'Próxima entrega', def: { x: 8, y: 0, w: 4, h: 3 }, min: { w: 2, h: 2 }, solido: true },
  { id: 'horario', titulo: 'Clases', def: { x: 8, y: 3, w: 4, h: 4 }, min: { w: 2, h: 2 } },
  { id: 'calendario', titulo: 'Calendario del mes', def: { x: 0, y: 4, w: 7, h: 8 }, min: { w: 3, h: 3 } },
  { id: 'pendientes', titulo: 'Pendientes', def: { x: 7, y: 4, w: 5, h: 8 }, min: { w: 2, h: 2 } },
  { id: 'cuatrimestre', titulo: 'Asignaturas', def: { x: 0, y: 12, w: 4, h: 4 }, min: { w: 2, h: 2 } },
  { id: 'horas', titulo: 'Horas de taller', def: { x: 4, y: 12, w: 4, h: 4 }, min: { w: 2, h: 2 } },
  { id: 'reloj', titulo: 'Hora', def: { x: 8, y: 12, w: 4, h: 4 }, min: { w: 2, h: 2 } },
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
 * entra en su posición de fábrica y lo retirado se ignora. Por eso publicar widgets
 * nuevos no descoloca el escritorio de nadie.
 */
export function fusionarLayout(guardado: Layout | null): Layout {
  const base = layoutPorDefecto();
  if (!guardado) return base;
  const salida: Layout = {};
  WIDGETS.forEach((w) => {
    const g = guardado[w.id];
    salida[w.id] =
      g && typeof g.fx === 'number' && typeof g.y === 'number'
        ? {
            fx: Math.min(Math.max(g.fx, 0), 0.95),
            fw: Math.min(Math.max(g.fw, 0.08), 1),
            y: Math.max(0, g.y),
            h: Math.max(80, g.h),
          }
        : base[w.id];
  });
  return salida;
}
