/**
 * Lo que Canvas devuelve, recortado a lo que Archicel usa.
 *
 * Los objetos de Canvas traen cuarenta campos; aquí hay ocho. Es deliberado: declarar
 * solo lo que se lee documenta la superficie real de la integración y evita que alguien
 * empiece a depender de un campo sin darse cuenta. Todo lo que pueda faltar está marcado
 * como opcional, porque **falta de verdad**: `due_at` es `null` en cualquier tarea sin
 * fecha, y un profesor puede dejar una asignatura sin nombre corto.
 *
 * Referencia: https://canvas.instructure.com/doc/api/
 */

/** Una asignatura del curso. */
export interface CursoCanvas {
  id: number;
  name?: string;
  course_code?: string;
  /** `active`, `completed`, `unpublished`… */
  workflow_state?: string;
}

/** Una entrega, examen o tarea evaluable. */
export interface TareaCanvas {
  id: number;
  course_id?: number;
  name?: string;
  /** Instante ISO en UTC, o `null` si no tiene fecha. */
  due_at?: string | null;
  points_possible?: number | null;
  html_url?: string;
  submission_types?: string[];
  submission?: EntregaCanvas;
}

/** El estado de la entrega propia. */
export interface EntregaCanvas {
  /** `submitted`, `unsubmitted`, `graded`, `pending_review`… */
  workflow_state?: string;
  submitted_at?: string | null;
  missing?: boolean;
  late?: boolean;
  excused?: boolean;
}

/** Un hueco del calendario puesto por el profesor: clase, tutoría, examen. */
export interface EventoCanvas {
  id: number;
  title?: string;
  start_at?: string | null;
  end_at?: string | null;
  all_day?: boolean;
  /** `course_123`, `user_45`… */
  context_code?: string;
  context_name?: string;
  html_url?: string;
}

/**
 * Un elemento del planificador: lo que vence, venga de donde venga.
 *
 * Es el endpoint más valioso de todos porque contesta de una sola llamada la pregunta que
 * hace el escritorio de Archicel —qué tengo por delante— sin recorrer asignatura por
 * asignatura. El objeto de verdad vive dentro de `plannable`, y su forma depende de
 * `plannable_type`.
 */
export interface ElementoPlan {
  plannable_id?: number;
  /** `assignment`, `quiz`, `discussion_topic`, `calendar_event`, `planner_note`… */
  plannable_type?: string;
  /** El instante que lo coloca en el calendario. */
  plannable_date?: string | null;
  course_id?: number;
  context_name?: string;
  context_type?: string;
  html_url?: string;
  plannable?: {
    id?: number;
    title?: string;
    /** las entregas lo llaman `todo_date`; los eventos, `start_at` */
    due_at?: string | null;
    todo_date?: string | null;
    start_at?: string | null;
    end_at?: string | null;
    all_day?: boolean;
    points_possible?: number | null;
  };
  submissions?: false | EntregaCanvas;
}

/** Quién es el dueño del token. Sirve de prueba de vida. */
export interface YoCanvas {
  id: number;
  name?: string;
  short_name?: string;
  avatar_url?: string;
  primary_email?: string;
}
