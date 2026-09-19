/**
 * El modelo de datos de Archicel.
 *
 * Reglas que se mantienen en toda la app:
 *  · una fecha de calendario es texto `YYYY-MM-DD` (ordena y se filtra por rango sin zonas horarias)
 *  · una hora del día son minutos enteros desde medianoche (480 = 08:00)
 *  · todo lleva `id`; lo genera el almacén, no la interfaz
 */

export type ID = string;

/** Fecha de calendario en formato `YYYY-MM-DD`. */
export type Fecha = string;

/** Minutos desde medianoche. `null` en un evento significa "todo el día". */
export type Minutos = number;

export const TIPOS_EVENTO = ['entrega', 'examen', 'presentacion', 'correccion', 'visita', 'otro'] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

export const COLORES = [
  'ambar', 'rojo', 'naranja', 'verde', 'menta', 'cian',
  'azul', 'indigo', 'violeta', 'rosa', 'arena', 'piedra',
] as const;
export type Color = (typeof COLORES)[number];

export const PRIORIDADES = ['baja', 'media', 'alta'] as const;
export type Prioridad = (typeof PRIORIDADES)[number];

/** Lo importante del curso: pertenece a un día entero, no a una franja. */
export interface Evento {
  id: ID;
  tipo: TipoEvento;
  titulo: string;
  materia?: string;
  fecha: Fecha;
  hora: Minutos | null;
  nota?: string;
  creado?: number;
  actualizado?: number;
}

/** Lo que ocupa una franja del día. */
export interface Tarea {
  id: ID;
  fecha: Fecha;
  ini: Minutos;
  fin: Minutos;
  titulo: string;
  color: Color;
  icono: string;
  prio: Prioridad;
  hecha: boolean;
  creado?: number;
  actualizado?: number;
}

export interface Ajustes {
  tema: 'dark' | 'light' | 'auto';
  opacidad: number;
  fondo?: string | null;
}

/** Posición de un widget: horizontal en fracción del lienzo, vertical en píxeles. */
export interface Caja {
  fx: number;
  fw: number;
  y: number;
  h: number;
}

/** Disposición de una superficie ("escritorio" hoy; mañana habrá más). */
export type Layout = Record<string, Caja>;

export const AJUSTES_POR_DEFECTO: Ajustes = { tema: 'auto', opacidad: 70, fondo: null };

/** Filtro por rango de fechas, inclusivo en ambos extremos. */
export interface Rango {
  desde?: Fecha;
  hasta?: Fecha;
}

export function hoy(): Fecha {
  return aFecha(new Date());
}

export function aFecha(d: Date): Fecha {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function deFecha(f: Fecha): Date {
  const [a, m, d] = f.split('-').map(Number);
  return new Date(a, m - 1, d);
}

export function hhmm(min: Minutos): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(min / 60))}:${p(min % 60)}`;
}
