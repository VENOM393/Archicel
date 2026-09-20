import 'server-only';

/**
 * Lo que Archicel le pide a Canvas, y cómo se le pide sin gastar de más.
 *
 * El cliente sabe hacer una llamada bien. Esta capa decide **cuántas** se hacen, y ahí es
 * donde se gana o se pierde el rendimiento. Tres mecanismos, y los tres hacen falta:
 *
 *   · **Caché con caducidad.** El horario de un cuatrimestre no cambia entre las 9:00 y
 *     las 9:05. Las asignaturas se guardan media hora; el planificador, cinco minutos.
 *     Abrir el escritorio diez veces seguidas cuesta una sola llamada.
 *
 *   · **Vuelo único.** Si llegan tres peticiones a la vez y la caché está vacía, sin esto
 *     salen tres llamadas idénticas a Canvas. Con esto sale una y las tres esperan su
 *     resultado. Es el mecanismo que evita la estampida al arrancar, cuando varias
 *     pestañas piden lo mismo en el mismo segundo.
 *
 *   · **Tandas con tope.** Pedir las entregas de seis asignaturas en paralelo es rápido;
 *     hacerlo sin límite con veinte es la forma más fácil de agotar la cuota de golpe.
 *     Van de tres en tres.
 *
 * La caché vive en memoria del proceso a propósito: es una sola usuaria y un solo
 * servidor. Ponerla en Redis sería arquitectura para un problema que no existe.
 */

import { cuota, pedir, pedirTodo, FalloCanvas } from './cliente';
import { hayCanvas } from './config';
import { dePlan, deTarea, limpiar, nombreDeCurso, type EventoImportado } from './traductor';
import type { CursoCanvas, ElementoPlan, TareaCanvas, YoCanvas } from './tipos';

/* ───────────────── caché con caducidad y vuelo único ───────────────── */

interface Guardado {
  valor: unknown;
  caduca: number;
}

const almacen = new Map<string, Guardado>();
const enVuelo = new Map<string, Promise<unknown>>();

async function conCache<T>(clave: string, vidaMs: number, traer: () => Promise<T>): Promise<T> {
  const ahora = Date.now();
  const guardado = almacen.get(clave);
  if (guardado && guardado.caduca > ahora) return guardado.valor as T;

  /* Ya hay alguien trayéndolo: se espera a esa, no se lanza otra. */
  const volando = enVuelo.get(clave);
  if (volando) return volando as Promise<T>;

  const promesa = traer()
    .then((valor) => {
      almacen.set(clave, { valor, caduca: Date.now() + vidaMs });
      return valor;
    })
    .finally(() => {
      enVuelo.delete(clave);
    });

  enVuelo.set(clave, promesa);
  return promesa;
}

/** Tira la caché. Para el botón de «actualizar ahora». */
export function olvidar(): void {
  almacen.clear();
}

/** Ejecuta en tandas de `tope`, para no abrir veinte conexiones a la vez. */
async function enTandas<T, R>(cosas: T[], tope: number, fn: (c: T) => Promise<R>): Promise<R[]> {
  const salida: R[] = [];
  for (let i = 0; i < cosas.length; i += tope) {
    salida.push(...(await Promise.all(cosas.slice(i, i + tope).map(fn))));
  }
  return salida;
}

/* ───────────────── operaciones ───────────────── */

const VIDA_CURSOS = 30 * 60_000;
const VIDA_PLAN = 5 * 60_000;

/** Quién es el dueño del token. Prueba de vida barata. */
export function yo(senal?: AbortSignal): Promise<YoCanvas> {
  return conCache('yo', VIDA_CURSOS, () => pedir<YoCanvas>('/users/self', senal));
}

/** Las asignaturas del curso en marcha. */
export function cursos(senal?: AbortSignal): Promise<CursoCanvas[]> {
  return conCache('cursos', VIDA_CURSOS, async () => {
    const lista = await pedirTodo<CursoCanvas>('/courses?enrollment_state=active&per_page=100', senal);
    return lista.filter((c) => c.workflow_state !== 'unpublished' && Boolean(c.name));
  });
}

/**
 * Lo que vence en un rango de fechas, de todas las asignaturas, en una llamada.
 *
 * Es la operación principal y la razón de que esta integración merezca la pena: contesta
 * de una vez la pregunta que hace el escritorio, sin recorrer asignatura por asignatura.
 */
export function plan(desde: string, hasta: string, senal?: AbortSignal): Promise<ElementoPlan[]> {
  return conCache(`plan:${desde}:${hasta}`, VIDA_PLAN, () =>
    pedirTodo<ElementoPlan>(`/planner/items?start_date=${desde}&end_date=${hasta}`, senal),
  );
}

/**
 * Las entregas pendientes asignatura por asignatura.
 *
 * Es la red de seguridad, no el camino normal: cuesta una llamada por asignatura. Solo
 * tiene sentido cuando el planificador viene vacío, que pasa si los profesores publican
 * las entregas sin fecha o sin activarlas para el planificador.
 */
export function entregasPorCurso(senal?: AbortSignal): Promise<EventoImportado[]> {
  /* Con caché, y hace más falta aquí que en ninguna otra parte: es **una llamada por
     asignatura**, doce en este curso. Sin esto, cada visita al escritorio costaba doce
     peticiones y un segundo y medio, aunque el planificador y las asignaturas sí vinieran
     de memoria. Medido: 1,6 s en ambas llamadas hasta que se puso. */
  return conCache('entregas', VIDA_PLAN, () => traerEntregas(senal));
}

async function traerEntregas(senal?: AbortSignal): Promise<EventoImportado[]> {
  const lista = await cursos(senal);
  const porCurso = await enTandas(lista, 3, async (c) => {
    /* Sin `bucket=upcoming`, y con motivo: ese filtro solo devuelve lo que tiene fecha de
       vencimiento, y en este grado **casi ninguna entrega la tiene** —21 publicadas, 2 con
       fecha—. Pedirlo con el filtro puesto devolvía cero y parecía que Canvas estaba
       vacío. Se piden todas y se queda lo que sí está fechado, que es lo único que puede
       ir a un calendario. */
    const tareas = await pedirTodo<TareaCanvas>(
      `/courses/${c.id}/assignments?include[]=submission&order_by=due_at`,
      senal,
    ).catch(() => [] as TareaCanvas[]);
    return tareas.filter((t) => Boolean(t.due_at)).map((t) => deTarea(t, c.name));
  });
  return limpiar(porCurso.flat());
}

export interface ResumenCanvas {
  estado: 'ok' | 'sin-configurar' | 'credencial' | 'limite' | 'red' | 'canvas';
  /** Lo traído, ya en el modelo de Archicel. */
  eventos: EventoImportado[];
  asignaturas: { id: number; nombre: string }[];
  /** Cuánta cuota queda, si Canvas lo ha dicho. */
  cuota: number | null;
  /** Cuándo se trajo, para poder decir «hace tres minutos». */
  momento: number;
  mensaje?: string;
}

/**
 * Todo lo que Archicel necesita de Canvas, de una vez.
 *
 * Nunca lanza. Un fallo de Canvas no puede tumbar el escritorio: lo que devuelve es un
 * `estado` con nombre y una lista vacía, y la pantalla decide si dice algo o se calla.
 * Esa es la diferencia entre una integración y una dependencia.
 */
export async function resumen(desde: string, hasta: string, senal?: AbortSignal): Promise<ResumenCanvas> {
  const vacio = { eventos: [], asignaturas: [], cuota: cuota(), momento: Date.now() };
  if (!hayCanvas) return { estado: 'sin-configurar', ...vacio };

  try {
    /* Las dos a la vez: no dependen una de otra y así el tiempo total es el de la lenta. */
    const [elementos, lista] = await Promise.all([plan(desde, hasta, senal), cursos(senal)]);

    let eventos = limpiar(elementos.map(dePlan));

    /* Si el planificador no trae nada, se prueba la vía cara antes de decir que no hay
       nada. Un escritorio vacío por una integración a medias es peor que una llamada más. */
    if (eventos.length === 0 && lista.length > 0) {
      eventos = await entregasPorCurso(senal);
    }

    return {
      estado: 'ok',
      eventos,
      /* Con el nombre ya limpio de la coleta administrativa: «Matemáticas Aplic I» en vez
         de «Matemáticas Aplic I-G FUND ARQUIT - MU - PRE - CAST-Edición-0». Doce filas con
         veinte caracteres idénticos al final no son una lista, son un muro. */
      asignaturas: lista.map((c) => ({
        id: c.id,
        nombre: nombreDeCurso(c.name) ?? c.course_code ?? `Curso ${c.id}`,
      })),
      cuota: cuota(),
      momento: Date.now(),
    };
  } catch (e) {
    const tipo = e instanceof FalloCanvas ? e.tipo : 'red';
    return {
      estado: tipo,
      ...vacio,
      cuota: cuota(),
      mensaje: e instanceof Error ? e.message : 'Fallo desconocido',
    };
  }
}
