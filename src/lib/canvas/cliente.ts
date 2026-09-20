import 'server-only';

/**
 * El motor de llamadas a Canvas.
 *
 * Todo lo que hable con el campus pasa por aquí. Es la única pieza del proyecto que ve el
 * token, y resuelve de una vez las cinco cosas que cualquier cliente de una API ajena
 * acaba necesitando y que casi nunca se ponen a la primera:
 *
 *   1 · **Tiempo máximo.** Una petición sin plazo no falla: se queda colgada, y con ella
 *       la pantalla que la espera. Quince segundos y fuera.
 *   2 · **Reintentos con espera creciente y desordenada.** Solo en `GET` —que es todo lo
 *       que hacemos— y solo ante fallos que se arreglan solos: cortes de red, 5xx y 429.
 *       La espera lleva un desorden de hasta 250 ms a propósito: si varias peticiones
 *       fallan a la vez y todas reintentan al mismo milisegundo, vuelven a tumbarlo.
 *   3 · **Respeto al límite de uso.** Canvas usa un cubo con fugas: cada token empieza en
 *       700 y cada petición descuenta su coste. El motor lee lo que queda en cada
 *       respuesta y, por debajo de un suelo, deja de pedir en vez de esperar a que Canvas
 *       le cierre la puerta. Quedarse sin cuota no es un error que se pueda reintentar.
 *   4 · **Paginación por cabecera `Link`.** Con las tres trampas que tiene: las URL son
 *       opacas y se siguen tal cual, el nombre de la cabecera no garantiza mayúsculas, y
 *       si el token va por parámetro no viaja en el enlace. Además hay tope de páginas:
 *       un bucle de paginación desbocado es una factura, no un fallo visible.
 *   5 · **Errores con nombre.** Quien llama necesita distinguir «falta el token» de «el
 *       token caducó» de «Canvas está caído». Los tres se ven igual desde fuera —no llegan
 *       datos— y se arreglan de forma completamente distinta.
 *
 * Lo que **no** hace: escribir. Archicel solo lee de Canvas. Entregar un trabajo desde
 * aquí sería técnicamente posible y una pésima idea — el día que fallara, fallaría en la
 * única operación del curso que no admite un «vuelve a intentarlo».
 */

import { CANVAS_TOKEN, CANVAS_URL, hayCanvas } from './config';

export type TipoFalloCanvas =
  /** No hay token: la integración está apagada, no rota. */
  | 'sin-configurar'
  /** El token no vale o caducó. Lo arregla Celeste generando otro. */
  | 'credencial'
  /** Cuota agotada. Se arregla solo esperando. */
  | 'limite'
  /** No se llegó al servidor. */
  | 'red'
  /** Se llegó y contestó mal. */
  | 'canvas';

export class FalloCanvas extends Error {
  readonly tipo: TipoFalloCanvas;
  readonly estado?: number;

  constructor(tipo: TipoFalloCanvas, mensaje: string, estado?: number) {
    super(mensaje);
    this.name = 'FalloCanvas';
    this.tipo = tipo;
    this.estado = estado;
  }
}

const TIEMPO_MAXIMO = 15_000;
const INTENTOS = 3;
/** Por debajo de esto se deja de pedir: queda margen para lo que ya esté en vuelo. */
const SUELO_DE_CUOTA = 60;
const PAGINAS_MAXIMAS = 25;
/** 100 es lo que Canvas sirve como máximo en la práctica, aunque no lo documente. */
const POR_PAGINA = 100;

/** Lo último que dijo Canvas sobre la cuota. Vive aquí porque es por token, no por llamada. */
let cuotaRestante = Number.POSITIVE_INFINITY;

/** Lo que queda de cuota, para poder enseñarlo sin hacer una llamada de más. */
export function cuota(): number | null {
  return Number.isFinite(cuotaRestante) ? cuotaRestante : null;
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Espera creciente y desordenada: 400 ms, 800 ms, 1600 ms, ±250 ms. */
function respiro(intento: number): number {
  return 400 * 2 ** intento + Math.random() * 250;
}

/** Si el servidor dice cuánto esperar, manda él; si no, la espera creciente. */
function esperaIndicada(res: Response, intento: number): number {
  const dice = Number(res.headers.get('retry-after'));
  return Number.isFinite(dice) && dice > 0 ? Math.min(dice * 1000, 30_000) : respiro(intento);
}

/**
 * Una llamada, con plazo y reintentos.
 *
 * `ruta` es relativa (`/planner/items?...`) o una URL absoluta del propio Canvas, que es
 * lo que devuelven los enlaces de paginación.
 */
async function pedirRespuesta(ruta: string, senal?: AbortSignal): Promise<Response> {
  if (!hayCanvas) throw new FalloCanvas('sin-configurar', 'No hay token de Canvas');

  const url = ruta.startsWith('http') ? ruta : `${CANVAS_URL}/api/v1${ruta}`;

  if (!url.startsWith(`${CANVAS_URL}/`)) {
    /* Los enlaces de paginación vienen del propio Canvas, pero se comprueban igual: es lo
       único que impide que una respuesta manipulada mande el token a otro dominio. */
    throw new FalloCanvas('canvas', 'Enlace fuera del dominio del campus');
  }

  if (cuotaRestante < SUELO_DE_CUOTA) {
    throw new FalloCanvas('limite', 'Cuota de Canvas casi agotada; se reintentará más tarde');
  }

  let ultimo: unknown;

  for (let intento = 0; intento < INTENTOS; intento++) {
    const reloj = new AbortController();
    const plazo = setTimeout(() => reloj.abort(), TIEMPO_MAXIMO);
    /* El plazo propio y la cancelación de quien llama valen las dos. */
    const corte = () => reloj.abort();
    senal?.addEventListener('abort', corte);

    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${CANVAS_TOKEN}`,
          Accept: 'application/json',
        },
        signal: reloj.signal,
        cache: 'no-store',
      });

      const queda = Number(res.headers.get('x-rate-limit-remaining'));
      if (Number.isFinite(queda)) cuotaRestante = queda;

      if (res.ok) return res;

      if (res.status === 401) {
        /* No se reintenta: un token que no vale no va a valer dentro de 400 ms. */
        throw new FalloCanvas('credencial', 'Canvas rechazó el token', 401);
      }

      /* Canvas usa 403 para dos cosas muy distintas: «no tienes permiso» y «te has pasado
         de cuota». Se distinguen solo por el cuerpo, y confundirlas cuesta caro — tratar
         un exceso de cuota como credencial inválida haría que la aplicación pidiera un
         token nuevo por algo que se arregla esperando treinta segundos. */
      if (res.status === 403) {
        const cuerpo = await res.text().catch(() => '');
        if (/rate limit/i.test(cuerpo)) {
          cuotaRestante = 0;
          await esperar(esperaIndicada(res, intento));
          continue;
        }
        throw new FalloCanvas('credencial', 'Canvas denegó el acceso', 403);
      }

      if (res.status === 429) {
        await esperar(esperaIndicada(res, intento));
        continue;
      }

      if (res.status >= 500) {
        ultimo = new FalloCanvas('canvas', `Canvas respondió ${res.status}`, res.status);
        await esperar(respiro(intento));
        continue;
      }

      throw new FalloCanvas('canvas', `Canvas respondió ${res.status}`, res.status);
    } catch (e) {
      if (e instanceof FalloCanvas) throw e;
      /* Si quien llamó canceló, no es un fallo: es que ya no interesa. */
      if (senal?.aborted) throw new FalloCanvas('red', 'Petición cancelada');
      ultimo = e;
      if (intento < INTENTOS - 1) await esperar(respiro(intento));
    } finally {
      clearTimeout(plazo);
      senal?.removeEventListener('abort', corte);
    }
  }

  if (ultimo instanceof FalloCanvas) throw ultimo;
  throw new FalloCanvas('red', 'No se pudo hablar con Canvas');
}

/** Una página. Para lo que se sabe que viene suelto, como `/users/self`. */
export async function pedir<T>(ruta: string, senal?: AbortSignal): Promise<T> {
  const res = await pedirRespuesta(ruta, senal);
  return (await res.json()) as T;
}

/**
 * Todas las páginas, siguiendo `Link`.
 *
 * El enlace `next` se toma **tal cual**: ya trae dentro los parámetros opacos de Canvas y
 * reconstruirlo a mano es la forma clásica de acabar releyendo la primera página para
 * siempre.
 */
export async function pedirTodo<T>(ruta: string, senal?: AbortSignal): Promise<T[]> {
  const separador = ruta.includes('?') ? '&' : '?';
  let siguiente: string | null = `${ruta}${separador}per_page=${POR_PAGINA}`;
  const todo: T[] = [];

  for (let pagina = 0; siguiente && pagina < PAGINAS_MAXIMAS; pagina++) {
    const res: Response = await pedirRespuesta(siguiente, senal);
    const lote = (await res.json()) as T[];
    if (Array.isArray(lote)) todo.push(...lote);
    siguiente = siguienteEnlace(res.headers);
  }

  return todo;
}

/** `Link: <url>; rel="next", <url>; rel="last"` — y el nombre puede venir en cualquier caja. */
function siguienteEnlace(cabeceras: Headers): string | null {
  const bruto = cabeceras.get('link') ?? cabeceras.get('Link');
  if (!bruto) return null;
  for (const trozo of bruto.split(',')) {
    const m = trozo.match(/<([^>]+)>\s*;\s*rel\s*=\s*"?next"?/i);
    if (m) return m[1];
  }
  return null;
}
