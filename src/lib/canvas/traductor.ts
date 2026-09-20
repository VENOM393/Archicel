/**
 * De Canvas al modelo de Archicel.
 *
 * Esta pieza es la frontera. A un lado están los objetos de Instructure, con sus nombres,
 * sus instantes UTC y sus cuarenta campos; al otro, el modelo de la casa: fecha como
 * `YYYY-MM-DD`, hora en minutos desde medianoche, color heredado de la asignatura. Que la
 * traducción viva en un solo sitio es lo que permite que el resto de Archicel no sepa que
 * Canvas existe.
 *
 * ## Por qué todo lo de Canvas se convierte en `Evento` y nunca en `Tarea`
 *
 * Son dos cosas distintas y confundirlas rompería el escritorio. Una **tarea** de Archicel
 * ocupa una franja: empieza a las 17:00, acaba a las 19:00, y es Celeste quien decide
 * cuándo se sienta a hacerla. Una entrega de Canvas no es eso: es un **vencimiento**, un
 * punto en el calendario que nadie elige. Traerla como tarea la colocaría inventándose una
 * franja de trabajo que la universidad no ha pedido.
 *
 * Así que Canvas aporta el **qué** y el **cuándo vence**; la franja de trabajo la sigue
 * poniendo ella, y esa sí es suya.
 */

import { CANVAS_ZONA } from './config';
import type { ElementoPlan, EventoCanvas, TareaCanvas } from './tipos';
import { ASIGNATURAS, CLAVES_ASIGNATURA, buscarAsignatura, type Evento, type TipoEvento } from '@/lib/data';

/** Lo que Archicel guarda de Canvas, sin `id`: lo pone el almacén. */
export type EventoImportado = Omit<Evento, 'id'> & {
  /** De dónde salió, para no volver a importarlo dos veces ni dejar que se edite a medias. */
  origen: 'canvas';
  origenId: string;
  /** El enlace a Canvas, para poder abrir la entrega de verdad. */
  enlace?: string;
  /** Ya entregado, según Canvas. */
  entregado?: boolean;
};

/* ───────────────── fechas ───────────────── */

/**
 * Parte un instante ISO en fecha del calendario y minutos, **en la zona del campus**.
 *
 * Canvas devuelve UTC. Una entrega de las 23:59 de Madrid llega como `21:59Z` en verano;
 * en invierno, una de las 00:30 llegaría como `23:30Z` del día anterior. Convertir con la
 * zona del servidor acierta por casualidad y falla en octubre, que es justo cuando empieza
 * el curso.
 */
export function partirInstante(iso: string | null | undefined): { fecha: string; hora: number | null } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: CANVAS_ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const de = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
  const fecha = `${de('year')}-${de('month')}-${de('day')}`;
  /* La medianoche viene con `24` en algunos motores; se normaliza a 0. */
  const h = Number(de('hour')) % 24;
  const m = Number(de('minute'));

  return { fecha, hora: h * 60 + m };
}

/* ───────────────── clasificación ───────────────── */

/**
 * De qué tipo es esto para Archicel.
 *
 * Canvas no tiene «examen» ni «corrección» como categorías: tiene `quiz`, que igual es un
 * examen final que un test de dos preguntas. Se afina por el título, porque es lo único
 * que de verdad lo distingue, y ante la duda gana `entrega`, que es lo que casi siempre es.
 */
export function tipoDe(titulo: string, plannable?: string): TipoEvento {
  const t = titulo.toLowerCase();
  if (/\bexamen|\bparcial|\bfinal\b|\btest\b/.test(t)) return 'examen';
  if (/present|expos|defensa/.test(t)) return 'presentacion';
  if (/correc|revisi[oó]n|cr[ií]tica/.test(t)) return 'correccion';
  if (/visita|excursi[oó]n|salida/.test(t)) return 'visita';
  if (plannable === 'quiz') return 'examen';
  if (plannable === 'calendar_event') return 'otro';
  return 'entrega';
}

/* ───────────────── nombres de asignatura ───────────────── */

/**
 * La UCAM nombra sus asignaturas así:
 *
 *     Matemáticas Aplic I-G FUND ARQUIT - MU - PRE - CAST-Edición-0
 *
 * Detrás del primer guion va la coleta administrativa —plan, campus, modalidad, idioma y
 * edición— que es idéntica en las doce y no dice nada. Los nombres de asignatura de este
 * grado no llevan guiones, así que cortar por el primero es exacto, no aproximado.
 */
export function nombreDeCurso(bruto: string | undefined): string | undefined {
  const corto = bruto?.split('-')[0]?.trim();
  return corto || undefined;
}

const ROMANO = /\s+(I{1,3}|IV|V)$/i;

function sinTildes(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** ¿Está `corta` dentro de `larga` en orden, aunque falten letras por el medio? */
function esAbreviatura(corta: string, larga: string): boolean {
  if (larga.startsWith(corta)) return true;
  let i = 0;
  for (const c of larga) if (c === corta[i] && ++i === corta.length) return true;
  return false;
}

/**
 * Encuentra la asignatura del catálogo detrás del nombre abreviado de Canvas.
 *
 * `buscarAsignatura` compara por prefijo y aquí no basta: la UCAM abrevia **por dentro**
 * de las palabras —«Arquitc» por «Arquitectónico», «Descrip» por «Descriptiva»— y mete
 * palabras que el catálogo no tiene («Análisis form arquit» contra «Análisis de Formas en
 * la Arquitectura»). Así que se comparan palabra a palabra, en orden, aceptando que cada
 * una sea abreviatura de la suya y saltando las de relleno del catálogo.
 *
 * **El numeral romano tiene que coincidir exacto.** Es lo que impide que «Matemáticas
 * Aplic II», que es de otro cuatrimestre, herede el color y el código de «Matemáticas
 * Aplicadas I». Dos asignaturas distintas con el mismo color serían peor que ninguna.
 */
function delCatalogo(nombre: string | undefined) {
  if (!nombre) return null;

  /* Primero el camino barato, por si algún día los nombres vienen limpios. */
  const directo = buscarAsignatura(nombre);
  if (directo) return directo;

  const numeroCanvas = nombre.match(ROMANO)?.[1]?.toUpperCase() ?? '';
  const palabras = sinTildes(nombre.replace(ROMANO, '')).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return null;

  for (const clave of CLAVES_ASIGNATURA) {
    const a = ASIGNATURAS[clave];
    const numeroCatalogo = a.nombre.match(ROMANO)?.[1]?.toUpperCase() ?? '';
    if (numeroCanvas !== numeroCatalogo) continue;

    const suyas = sinTildes(a.nombre.replace(ROMANO, '')).split(/\s+/).filter(Boolean);
    let i = 0;
    for (const p of palabras) {
      while (i < suyas.length && !esAbreviatura(p, suyas[i])) i++;
      if (i === suyas.length) break;
      i++;
    }
    if (i <= suyas.length && palabras.every((p) => suyas.some((s) => esAbreviatura(p, s)))) return a;
  }
  return null;
}

/** El nombre de asignatura que Archicel reconoce, si lo reconoce. */
function materiaDe(nombre: string | undefined): string | undefined {
  const limpio = nombreDeCurso(nombre);
  return delCatalogo(limpio)?.corto ?? limpio;
}

/** ¿Está entregado? `submissions` puede venir como `false` cuando no aplica. */
function entregado(s: ElementoPlan['submissions']): boolean | undefined {
  if (!s || typeof s !== 'object') return undefined;
  if (s.excused) return true;
  if (s.workflow_state === 'graded' || s.workflow_state === 'submitted') return true;
  return Boolean(s.submitted_at);
}

/* ───────────────── traducciones ───────────────── */

/**
 * Lo que el planificador devuelve y sí es una fecha en el calendario.
 *
 * Fuera queda `announcement`, y no es un detalle menor: en el curso de Celeste, **los
 * cinco únicos elementos que trae el planificador son anuncios** —el acto de acogida, un
 * viaje a Lisboa, el horario del curso—. Son tablón, no vencimientos. Colocarlos en el
 * calendario por su fecha de publicación llenaba el escritorio de cosas que no hay que
 * hacer, y encima las marcaba como entregas.
 */
const TIPOS_CON_FECHA = new Set(['assignment', 'quiz', 'discussion_topic', 'calendar_event', 'planner_note', 'wiki_page']);

/** Un elemento del planificador. Es la vía principal. */
export function dePlan(el: ElementoPlan): EventoImportado | null {
  if (el.plannable_type && !TIPOS_CON_FECHA.has(el.plannable_type)) return null;

  const p = el.plannable ?? {};
  const titulo = (p.title ?? '').trim();
  if (!titulo) return null;

  const cuando = partirInstante(p.due_at ?? p.todo_date ?? p.start_at ?? el.plannable_date);
  if (!cuando) return null;

  const idCanvas = String(el.plannable_id ?? p.id ?? `${el.plannable_type}-${cuando.fecha}-${titulo}`);

  return {
    origen: 'canvas',
    origenId: `${el.plannable_type ?? 'plan'}:${idCanvas}`,
    tipo: tipoDe(titulo, el.plannable_type),
    titulo,
    materia: materiaDe(el.context_name),
    fecha: cuando.fecha,
    /* Un elemento de todo el día no tiene hora; el modelo lo dice con `null`. */
    hora: p.all_day ? null : cuando.hora,
    enlace: el.html_url,
    entregado: entregado(el.submissions),
  };
}

/** Una entrega pedida por asignatura. La vía de reserva cuando el planificador viene corto. */
export function deTarea(t: TareaCanvas, nombreCurso?: string): EventoImportado | null {
  const titulo = (t.name ?? '').trim();
  const cuando = partirInstante(t.due_at);
  if (!titulo || !cuando) return null;

  return {
    origen: 'canvas',
    origenId: `assignment:${t.id}`,
    tipo: tipoDe(titulo, 'assignment'),
    titulo,
    materia: materiaDe(nombreCurso),
    fecha: cuando.fecha,
    hora: cuando.hora,
    enlace: t.html_url,
    entregado: entregado(t.submission),
  };
}

/** Un hueco del calendario: clase, tutoría, lo que ponga el profesor. */
export function deEvento(e: EventoCanvas): EventoImportado | null {
  const titulo = (e.title ?? '').trim();
  const cuando = partirInstante(e.start_at);
  if (!titulo || !cuando) return null;

  return {
    origen: 'canvas',
    origenId: `calendar_event:${e.id}`,
    tipo: tipoDe(titulo, 'calendar_event'),
    titulo,
    materia: materiaDe(e.context_name),
    fecha: cuando.fecha,
    hora: e.all_day ? null : cuando.hora,
    enlace: e.html_url,
  };
}

/**
 * Quita repetidos y ordena.
 *
 * Hace falta de verdad: el planificador y las entregas por asignatura devuelven **la misma
 * entrega** cuando se piden las dos, y sin esto el calendario la enseñaría dos veces. La
 * llave es `origenId`, que es estable entre llamadas.
 */
export function limpiar(lista: (EventoImportado | null)[]): EventoImportado[] {
  const vistos = new Map<string, EventoImportado>();
  for (const e of lista) {
    if (!e) continue;
    /* Gana el primero: el planificador va antes y trae el estado de entrega. */
    if (!vistos.has(e.origenId)) vistos.set(e.origenId, e);
  }
  return [...vistos.values()].sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || (a.hora ?? 0) - (b.hora ?? 0) || a.titulo.localeCompare(b.titulo),
  );
}
