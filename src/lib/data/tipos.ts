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
  'azul', 'indigo', 'violeta', 'rosa', 'arena', 'marron', 'amarillo', 'piedra',
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
/**
 * El avance de una tarea.
 *
 * Solo tres se eligen a mano. `retrasada` **no se guarda nunca**: depende de qué día se
 * mire, así que almacenarlo produciría tareas marcadas como retrasadas con fecha futura
 * en cuanto se editara algo. Se calcula al mostrar, con `progresoDe`.
 */
export const PROGRESOS = ['sin-empezar', 'en-curso', 'hecha'] as const;
export type Progreso = (typeof PROGRESOS)[number];
/** Lo que se ve en pantalla: los tres de arriba más el que se deduce del calendario. */
export type ProgresoVisible = Progreso | 'retrasada';

export interface Tarea {
  id: ID;
  fecha: Fecha;
  ini: Minutos;
  fin: Minutos;
  titulo: string;
  /** De dónde saca su color: el de la asignatura. Vacío mientras no se le asigne una. */
  asignatura?: string;
  color: Color;
  icono: string;
  prio: Prioridad;
  progreso?: Progreso;
  /**
   * El estado antiguo, de cuando una tarea solo podía estar hecha o no.
   *
   * Se sigue escribiendo junto a `progreso` para que nada que aún lo lea se rompa, y se
   * sigue leyendo para las tareas guardadas antes de que existiera `progreso`. Cuando no
   * quede ninguna de aquellas, este campo se puede retirar.
   */
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
  /** Sin cristal ni borde: el contenido flota directamente sobre la fotografía. */
  desnudo?: boolean;
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

/**
 * El progreso que se enseña, que no siempre es el que está guardado.
 *
 * Una tarea sin terminar cuya hora de fin ya pasó está **retrasada**, y eso no hace falta
 * que nadie lo marque: se deduce del reloj. Calcularlo aquí en vez de guardarlo evita el
 * estado imposible —"retrasada" con fecha de la semana que viene— y hace que el aviso
 * aparezca solo, sin que nadie tenga que volver a abrir la tarea.
 *
 * También traduce las tareas viejas, anteriores a que existiera `progreso`, leyendo su
 * antiguo `hecha`.
 */
export function progresoDe(t: Tarea, ahora: Date = new Date()): ProgresoVisible {
  const guardado: Progreso = t.progreso ?? (t.hecha ? 'hecha' : 'sin-empezar');
  if (guardado === 'hecha') return 'hecha';
  const finDeLaTarea = new Date(`${t.fecha}T00:00:00`);
  finDeLaTarea.setMinutes(t.fin);
  return finDeLaTarea.getTime() < ahora.getTime() ? 'retrasada' : guardado;
}

/** Cómo se llama cada estado en pantalla. */
export const NOMBRE_PROGRESO: Record<ProgresoVisible, string> = {
  'sin-empezar': 'Sin empezar',
  'en-curso': 'En curso',
  hecha: 'Hecha',
  retrasada: 'Retrasada',
};

/**
 * Una carpeta dentro de una asignatura.
 *
 * Existe como documento propio y no como un trozo de la ruta de cada apunte, y esa
 * decisión tiene una consecuencia concreta: **una carpeta vacía sigue existiendo**. Si la
 * carpeta fuera solo texto dentro de un apunte, crear «Tema 3» antes de tener nada que
 * meter dentro no guardaría nada, y al recargar habría desaparecido. Organizarse es
 * justamente preparar el sitio **antes** de llenarlo.
 */
export interface Carpeta {
  id: ID;
  asignatura: string;
  /** Dentro de qué otra carpeta está. Vacío significa la raíz de la asignatura. */
  madre?: ID;
  /** Lo escribe quien sea: se pinta como texto, nunca como HTML. */
  nombre: string;
  remoto: { proveedor: 'local' | 'drive'; id: string };
  creado?: number;
  actualizado?: number;
}

/**
 * Un apunte: el material de estudio de una asignatura.
 *
 * Esto es una **ficha, no un fichero**. Los bytes viven en el archivador —en Drive todo lo
 * nuevo; en el navegador, solo lo que se guardó ahí antes— y aquí solo está lo que hace
 * falta para pintar la pantalla sin pedirle nada al proveedor: cómo se llama, de qué tipo
 * es, cuánto ocupa y dónde encontrarlo.
 *
 * Esa separación es lo que hace que la página de una asignatura se dibuje entera sin una
 * sola llamada de red al almacenamiento. Al archivador solo se va al subir, al abrir, al
 * borrar y al organizar.
 */
export interface Apunte {
  id: ID;
  /** La clave de la asignatura en el catálogo del curso. */
  asignatura: string;
  /**
   * El nombre tal cual lo trae el fichero.
   *
   * Lo escribe quien sea y entra de fuera: se pinta **siempre como texto**, nunca como
   * HTML. Es la primera regla de la revisión de seguridad y aquí es donde más aplica.
   */
  nombre: string;
  /** El tipo MIME: `application/pdf`, `image/jpeg`… Vacío si el sistema no lo supo decir. */
  tipo: string;
  /** Bytes. Para poder decir «2,4 MB» sin preguntarle al proveedor. */
  tam: number;
  /** Dónde están los bytes. El proveedor va dentro porque conviven dos: Drive y lo antiguo del navegador. */
  remoto: { proveedor: 'local' | 'drive'; id: string };
  /** En qué carpeta está. Vacío significa la raíz de la asignatura. */
  carpeta?: ID;
  /** Para ordenar a mano dentro de la asignatura. Sin él manda `creado`. */
  orden?: number;
  creado?: number;
  actualizado?: number;
}

/**
 * El color de una tarea sale de su asignatura, no de un selector.
 *
 * La lista de asignaturas vive en `curso.ts` y es la única fuente: el mismo color que
 * usa el horario usa la tarea. Se busca con tolerancia —vale la clave, el nombre, el
 * corto o el código, sin tildes— porque el campo se escribe a mano.
 *
 * Una tarea puede no ser de ninguna asignatura, y eso es legítimo: entonces es piedra,
 * el gris neutro, que no compite con ningún color del horario.
 *
 * Vive aquí y no en `curso.ts` para no invertir la dirección de las dependencias: los
 * tipos no deben importar el catálogo. La implementación se inyecta al arrancar.
 */
let buscador: ((texto: string | undefined) => { color: Color } | null) | null = null;

/** Lo llama `curso.ts` al cargarse; así `tipos` no necesita conocerlo. */
export function registrarCatalogoDeAsignaturas(f: (t: string | undefined) => { color: Color } | null) {
  buscador = f;
}

export function colorDeAsignatura(asignatura: string | undefined): Color {
  return buscador?.(asignatura)?.color ?? 'piedra';
}

