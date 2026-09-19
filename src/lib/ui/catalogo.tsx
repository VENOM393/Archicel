/**
 * Iconos, colores y tipos de evento.
 *
 * Los iconos son SVG dibujados a mano, todos con el mismo trazo, y heredan el color
 * de quien los usa. Añadir uno es una entrada en ICONOS; añadir un tipo de evento,
 * una en TIPOS con su color e icono.
 */

import type { Color, TipoEvento } from '@/lib/data';

export const ICONOS: Record<string, string> = {
  pesa: '<path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11"/>',
  libro: '<path d="M4 19V5a2 2 0 0 1 2-2h14v14H6a2 2 0 0 0-2 2Zm0 0a2 2 0 0 0 2 2h14"/>',
  cafe: '<path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z"/><path d="M17 9.5h1.8a2.7 2.7 0 0 1 0 5.4H17"/><path d="M7 3v2M11 3v2"/>',
  comida: '<path d="M6 3v7a2 2 0 0 0 4 0V3M8 10v11"/><path d="M17 3c-1.5 1-2 3-2 5s.6 3 2 3h1V3Z"/><path d="M17.5 11v10"/>',
  casa: '<path d="M3.5 10.5 12 4l8.5 6.5V20a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1Z"/><path d="M9.5 21v-6h5v6"/>',
  regla: '<path d="M4 20 20 4"/><path d="M4 20h4v-4"/><path d="m8 16 8-8"/><path d="M20 4h-4v4"/>',
  lapiz: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  maqueta: '<path d="M12 3 4 7v10l8 4 8-4V7Z"/><path d="m4 7 8 4 8-4M12 11v10"/>',
  portatil: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M2 20h20"/>',
  camara: '<path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.3-2h8l1.3 2h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5Z"/><circle cx="12" cy="13" r="3.4"/>',
  musica: '<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  corazon: '<path d="M12 20s-7.5-4.7-7.5-9.6A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.8C19.5 15.3 12 20 12 20Z"/>',
  compras: '<path d="M5 8h14l-1 12H6Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  ducha: '<path d="M12 3c-4 0-7 3-7 7h14c0-4-3-7-7-7Z"/><path d="M12 10v11"/><path d="M8 14v1M16 14v1"/>',
  luna: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>',
  sol: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.5l3.5 2"/>',
  planta: '<path d="M12 21v-8"/><path d="M12 13c0-4 2.5-7 7-7 0 4-2.5 7-7 7Z"/><path d="M12 15c0-3-2-5.5-5.5-5.5C6.5 12.5 8.5 15 12 15Z"/>',
  avion: '<path d="M3 14.5 21 5l-4.5 15-4-6Z"/><path d="m12.5 14-2.5 5 2-3"/>',
  telefono: '<rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M10.8 18.5h2.4"/>',
};

export function Icono({ nombre, tam = 15 }: { nombre: string; tam?: number }) {
  return (
    <svg
      width={tam}
      height={tam}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: ICONOS[nombre] ?? ICONOS.reloj }}
    />
  );
}

export const COLORES_TAREA: Color[] = [
  'ambar', 'rojo', 'naranja', 'verde', 'menta', 'cian',
  'azul', 'indigo', 'violeta', 'rosa', 'arena', 'piedra',
];

export interface DefTipo {
  n: string;
  color: Color;
  icono: string;
}

export const TIPOS: Record<TipoEvento, DefTipo> = {
  entrega: { n: 'Entrega', color: 'ambar', icono: 'maqueta' },
  examen: { n: 'Examen', color: 'rojo', icono: 'libro' },
  presentacion: { n: 'Presentación', color: 'violeta', icono: 'portatil' },
  correccion: { n: 'Corrección', color: 'cian', icono: 'lapiz' },
  visita: { n: 'Visita', color: 'verde', icono: 'casa' },
  otro: { n: 'Otro', color: 'piedra', icono: 'reloj' },
};

export const PRIOS: Array<{ id: 'baja' | 'media' | 'alta'; n: string }> = [
  { id: 'baja', n: 'Baja' },
  { id: 'media', n: 'Media' },
  { id: 'alta', n: 'Alta' },
];

/** Franja de la agenda del día. */
export const DIA_INICIO = 6;
export const DIA_FIN = 24;
export const ALTO_HORA = 58;
