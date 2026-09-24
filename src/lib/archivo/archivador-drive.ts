/**
 * El archivador contra Google Drive.
 *
 * Los bytes van **del navegador a Google directamente**. Archicel no los ve pasar, y no
 * es una preferencia estética: Vercel corta el cuerpo de una petición en 4,5 MB y una
 * lámina escaneada se pasa de ahí sin esfuerzo, así que pasar los apuntes por `/api`
 * significa que el día que suba algo grande se rompe — y se rompe con un error que no
 * dice por qué.
 *
 * Que el token viva en el navegador es aceptable **precisamente** por `drive.file`:
 * aunque alguien lo robase, no abre nada más que los ficheros que esta aplicación creó.
 * Con `drive` completo esta decisión sería indefendible.
 *
 * ## La carpeta
 *
 * ```
 * Archicel/
 *   Asignaturas/
 *     Geometría Descriptiva I/
 * ```
 *
 * Con el **nombre largo** de la asignatura y no con su clave interna: quien abra esto
 * desde Drive tiene que entender qué está mirando sin saber que existe un `curso.ts`.
 *
 * Y con `drive.file` se pueden buscar: la búsqueda solo devuelve lo que esta aplicación
 * creó, así que encontrar «la carpeta Archicel» encuentra la nuestra y no una tuya que se
 * llame igual. Por eso no hace falta guardar identificadores en ningún sitio — se buscan
 * una vez por pestaña, **las tres de una sola consulta**, y se recuerdan en memoria. Si
 * alguien las borra desde Drive a mitad de sesión, la primera escritura que se tropiece
 * con el identificador muerto las olvida, las busca otra vez y, si hace falta, las crea.
 *
 * ## Cuando Drive dice que no
 *
 * Cada fallo se clasifica por la **razón estructurada** que manda Drive
 * (`error.errors[].reason`, `error.details[].reason`), nunca buscando palabras en su
 * texto: el límite de peticiones dice «…exceed configured project quota» y eso no es que
 * falte espacio. Lo que es pasajero —demasiadas peticiones, un 5xx— se reintenta aquí con
 * espera exponencial antes de molestar a nadie.
 */

import { ASIGNATURAS } from '@/lib/data';
import {
  FalloDeArchivo,
  type Archivador,
  type Destino,
  type OpcionesDeLectura,
  type Remoto,
} from './archivador';
import { caducarToken, conseguirToken, hayPermiso } from './google';

const API = 'https://www.googleapis.com/drive/v3';
const SUBIDA = 'https://www.googleapis.com/upload/drive/v3/files';
const CARPETA = 'application/vnd.google-apps.folder';

/** Por encima de esto, subida reanudable. Una sola petición aguanta bien hasta 5 MB. */
const DE_UNA_VEZ = 5 * 1024 * 1024;

/** Trozos de 8 MB: múltiplo de 256 KB, que es lo que Drive exige. */
const TROZO = 8 * 1024 * 1024;

/**
 * Cuántas veces se reintenta algo pasajero antes de rendirse: 1 + 2 + 4 s, unos siete
 * segundos. Más que eso ya no es un tropiezo, y quien espera con la fila apagada merece
 * saberlo.
 */
const REINTENTOS = 3;

/** Una subida de una tanda aguanta más: un corte de wifi dura lo que dura. ~1 min. */
const REINTENTOS_DE_SUBIDA = 6;

const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Espera exponencial con un poco de azar, para que cinco peticiones no vuelvan a la vez. */
function espera(intento: number, retryAfter?: string | null): number {
  const s = Number(retryAfter);
  if (retryAfter && Number.isFinite(s) && s > 0) return Math.min(s * 1000, 30_000);
  return Math.min(1000 * 2 ** intento, 30_000) + Math.random() * 400;
}

/* ───────────────────────── lo que dice Drive ───────────────────────── */

interface CuerpoDeError {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    errors?: Array<{ reason?: string; message?: string }>;
    details?: Array<{ reason?: string }>;
  };
}

/**
 * El texto y las razones de un error de Drive, sacados de su propio JSON.
 *
 * Drive contesta `{"error":{"errors":[{"reason":"…"}],"message":"…"}}`, y las APIs de
 * Google más nuevas añaden `details[].reason` (`SERVICE_DISABLED`,
 * `ACCESS_TOKEN_SCOPE_INSUFFICIENT`). La razón es lo que se clasifica; el mensaje es lo
 * que se enseña.
 */
function leerError(cuerpo?: string): { dijo: string; razones: string[] } {
  if (!cuerpo) return { dijo: '', razones: [] };
  try {
    const e = (JSON.parse(cuerpo) as CuerpoDeError).error ?? {};
    const razones = [...(e.errors ?? []).map((x) => x.reason), ...(e.details ?? []).map((x) => x.reason), e.status]
      .filter((x): x is string => Boolean(x));
    return { dijo: e.message ?? '', razones };
  } catch {
    return { dijo: cuerpo.slice(0, 200), razones: [] };
  }
}

const SIN_SITIO = ['storageQuotaExceeded'];
/** El límite de cada día no se arregla esperando un minuto: no se reintenta. */
const DIARIO = ['dailyLimitExceeded'];
const LIMITE = [
  'rateLimitExceeded',
  'userRateLimitExceeded',
  'sharingRateLimitExceeded',
  'quotaExceeded',
  'RATE_LIMIT_EXCEEDED',
  'RESOURCE_EXHAUSTED',
];
const API_APAGADA = ['accessNotConfigured', 'SERVICE_DISABLED', 'API_DISABLED'];
const ALCANCE = ['insufficientPermissions', 'insufficientScopes', 'ACCESS_TOKEN_SCOPE_INSUFFICIENT'];
const AJENO = ['appNotAuthorizedToFile', 'insufficientFilePermissions', 'forbidden'];
const DOMINIO = ['domainPolicy'];

/** De qué es el 404: del propio fichero, o de la carpeta a la que iba. */
type Que = 'fichero' | 'destino';

export function traducir(estado: number, cuerpo?: string, que: Que = 'fichero'): FalloDeArchivo {
  const { dijo, razones } = leerError(cuerpo);
  const de = (lista: string[]) => razones.find((r) => lista.includes(r));
  const fallo = (causa: FalloDeArchivo['causa'], mensaje: string, razon?: string) =>
    new FalloDeArchivo(causa, mensaje, undefined, { estado, razon: razon ?? razones[0], dijo });

  let r: string | undefined;
  if (estado === 401 || (r = de(['authError', 'UNAUTHENTICATED']))) return fallo('caducada', 'Drive rechazó la sesión.', r);
  if ((r = de(SIN_SITIO))) return fallo('sin-sitio', 'No queda espacio en tu Drive.', r);
  if ((r = de(DIARIO))) return fallo('limite', 'Se agotó la cuota diaria de Drive.', r);
  if (estado === 429 || (r = de(LIMITE))) return fallo('limite', 'Demasiadas peticiones a Drive.', r);
  if ((r = de(API_APAGADA)) || /has not been used in project|is disabled/i.test(dijo)) {
    return fallo('api-apagada', 'La API de Drive está desactivada.', r ?? 'accessNotConfigured');
  }
  if (estado === 403) {
    if ((r = de(ALCANCE))) return fallo('sin-permiso', 'El permiso concedido no incluye Drive.', r);
    if ((r = de(AJENO))) return fallo('sin-permiso', 'Ese fichero no es de esta conexión.', r);
    if ((r = de(DOMINIO))) return fallo('sin-permiso', 'La organización no deja usar Drive.', r);
    return fallo('sin-permiso', 'Drive no lo permite.');
  }
  if (estado === 404) {
    return que === 'destino'
      ? fallo('sin-carpeta', 'La carpeta de destino ya no está en tu Drive.')
      : fallo('no-esta', 'Ya no está en tu Drive.');
  }
  if (estado >= 500) return fallo('servidor', `Drive no responde (${estado}).`);
  return fallo('desconocida', `Drive respondió ${estado}${dijo ? `: ${dijo}` : '.'}`);
}

/**
 * Si merece la pena volver a intentarlo sin preguntar a nadie.
 *
 * El límite de peticiones siempre: Drive no hizo nada y pide que se espere. Un 5xx o un
 * corte solo si repetir no puede duplicar nada — crear un fichero dos veces porque la
 * primera respuesta se perdió sería peor que el fallo.
 */
function sePuedeReintentar(f: FalloDeArchivo, idempotente: boolean): boolean {
  if (f.causa === 'limite') return !DIARIO.includes(f.detalle.razon ?? '');
  if (f.causa === 'servidor' || f.causa === 'red') return idempotente;
  return false;
}

/** Si el 404 de Drive habla de este identificador («File not found: …»). */
function falta(e: unknown, id: string): boolean {
  return e instanceof FalloDeArchivo && e.detalle.estado === 404 && (e.detalle.dijo ?? '').includes(id);
}

/* ───────────────────────── las llamadas ───────────────────────── */

/**
 * El token, o un fallo con nombre.
 *
 * `interactivo` dice si se viene de un gesto —pulsar subir, soltar un fichero, abrir un
 * apunte—, que es lo único que permite a Google abrir su ventana para renovarlo.
 */
async function token(interactivo: boolean): Promise<string> {
  try {
    return await conseguirToken(interactivo);
  } catch (e) {
    throw new FalloDeArchivo('sin-conexion', e instanceof Error && e.message ? e.message : 'Drive no está conectado.', e);
  }
}

interface OpcionesDeLlamada {
  /** Por defecto `true`: todo lo que llega aquí nace de un gesto. */
  interactivo?: boolean;
  /** De qué sería un 404. */
  que?: Que;
  /** Si repetirla tras un corte o un 5xx no puede duplicar nada. Por defecto, todo salvo POST. */
  idempotente?: boolean;
}

/**
 * Una llamada a Drive con el token puesto, y con los reintentos que tocan.
 *
 * Si Drive rechaza el token (401) se tira, para que «Reconectar» pida uno nuevo en vez de
 * devolver el mismo muerto.
 */
async function llamar(url: string, init: RequestInit = {}, op: OpcionesDeLlamada = {}): Promise<Response> {
  const { interactivo = true, que = 'fichero' } = op;
  const idempotente = op.idempotente ?? (init.method ?? 'GET').toUpperCase() !== 'POST';

  for (let intento = 0; ; intento++) {
    const t = await token(interactivo);
    let fallo: FalloDeArchivo;
    let retryAfter: string | null = null;
    try {
      const r = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${t}` } });
      if (r.ok) return r;
      retryAfter = r.headers.get('Retry-After');
      fallo = traducir(r.status, await r.text().catch(() => ''), que);
    } catch (e) {
      fallo = e instanceof FalloDeArchivo ? e : new FalloDeArchivo('red', 'Se cortó la conexión con Drive.', e);
    }
    if (fallo.causa === 'caducada') caducarToken(t);
    if (intento < REINTENTOS && sePuedeReintentar(fallo, idempotente)) {
      await esperar(espera(intento, retryAfter));
      continue;
    }
    throw fallo;
  }
}

interface RespuestaXhr {
  estado: number;
  texto: string;
  cabecera(nombre: string): string | null;
}

/**
 * Una petición con `XMLHttpRequest`, que es lo único que informa del progreso de subida.
 *
 * `fetch` no lo hace: se puede con flujos, pero no en todos los navegadores y con bastante
 * más código. Aquí el progreso no es un adorno: es lo único que distingue «está subiendo
 * una lámina de 60 MB» de «se ha colgado». Solo rechaza si se corta la conexión; cualquier
 * respuesta, buena o mala, la decide quien llama.
 */
function xhr(
  metodo: string,
  url: string,
  { cabeceras = {}, cuerpo = null, alSubir }: {
    cabeceras?: Record<string, string>;
    cuerpo?: XMLHttpRequestBodyInit | null;
    alSubir?: (hecho: number, total: number) => void;
  } = {},
): Promise<RespuestaXhr> {
  return new Promise((resolver, rechazar) => {
    const p = new XMLHttpRequest();
    p.open(metodo, url, true);
    for (const [k, v] of Object.entries(cabeceras)) p.setRequestHeader(k, v);
    if (alSubir) {
      p.upload.onprogress = (e) => {
        if (e.lengthComputable) alSubir(e.loaded, e.total);
      };
    }
    const cortada = () => rechazar(new FalloDeArchivo('red', 'Se cortó la subida.'));
    p.onerror = cortada;
    p.ontimeout = cortada;
    p.onload = () =>
      resolver({
        estado: p.status,
        texto: p.responseText,
        cabecera: (n) => {
          try {
            return p.getResponseHeader(n);
          } catch {
            return null;
          }
        },
      });
    p.send(cuerpo);
  });
}

function idDe(texto: string): string {
  try {
    const id = (JSON.parse(texto) as { id?: string }).id;
    if (id) return id;
  } catch {}
  throw new FalloDeArchivo('desconocida', 'Drive respondió algo que no se entiende.', undefined, { dijo: texto.slice(0, 200) });
}

/* ───────────────────────── las carpetas fijas ───────────────────────── */

const RAIZ = 'Archicel';
const NOMBRE = 'Asignaturas';
/** Cómo se llamó esta carpeta antes, para no dejar huérfano lo ya subido. */
const NOMBRE_VIEJO = 'Apuntes';

/**
 * La carpeta de cada asignatura, recordada por pestaña **como promesa**, no como valor.
 *
 * Con cinco ficheros subiendo a la vez, recordar el valor dejaría que los cinco buscaran y
 * —si no existía— crearan cinco carpetas `Archicel`. Recordando la promesa, el segundo
 * espera a la búsqueda del primero.
 */
const rutas = new Map<string, Promise<string>>();

/** Crear carpetas fijas, de una en una: dos asignaturas a la vez no crean dos `Archicel`. */
let turno: Promise<unknown> = Promise.resolve();

/** Se olvida lo recordado. La siguiente escritura busca otra vez, y crea lo que falte. */
export function olvidarCarpetas(): void {
  rutas.clear();
}

/** Las comillas y las barras del nombre romperían la consulta: Drive las escapa con barra. */
const escapar = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const nombreDe = (clave: string) => ASIGNATURAS[clave as keyof typeof ASIGNATURAS]?.nombre ?? clave;

/**
 * Las tres carpetas fijas, **en una sola petición**.
 *
 * Antes se buscaban una a una, porque cada búsqueda necesitaba el identificador de la
 * anterior: cuatro viajes seguidos a Google antes de empezar a subir nada. Pidiendo de una
 * vez todas las carpetas que se llamen como alguna de las tres —y `Archicel` solo en la
 * raíz—, el árbol se reconstruye aquí siguiendo los padres. Con `drive.file` solo vuelven
 * las que creó Archicel, así que la lista es corta.
 */
async function buscarRuta(nombreAsig: string, interactivo: boolean) {
  const q = [
    `mimeType='${CARPETA}'`,
    'trashed=false',
    `((name='${RAIZ}' and 'root' in parents) or name='${NOMBRE}' or name='${NOMBRE_VIEJO}' or name='${escapar(nombreAsig)}')`,
  ].join(' and ');
  const r = await llamar(
    `${API}/files?q=${encodeURIComponent(q)}&fields=files(id,name,parents)&orderBy=createdTime&pageSize=1000`,
    {},
    { interactivo },
  );
  const { files = [] } = (await r.json()) as { files?: Array<{ id: string; name: string; parents?: string[] }> };
  /* La más antigua gana: si alguna vez se crearon dos, lo de siempre está en la primera. */
  const hija = (padre: string | null, nombre: string) =>
    padre ? (files.find((f) => f.name === nombre && f.parents?.includes(padre))?.id ?? null) : null;

  const raiz = files.find((f) => f.name === RAIZ)?.id ?? null;
  const asignaturas = hija(raiz, NOMBRE);
  return {
    raiz,
    asignaturas,
    vieja: asignaturas ? null : hija(raiz, NOMBRE_VIEJO),
    asig: hija(asignaturas, nombreAsig),
  };
}

async function crearCarpetaEn(nombre: string, padre: string): Promise<string> {
  const r = await llamar(
    `${API}/files?fields=id`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nombre, mimeType: CARPETA, parents: [padre] }),
    },
    { que: 'destino' },
  );
  return idDe(await r.text());
}

/**
 * La carpeta de una asignatura: se busca, y lo que falte se crea.
 *
 * Si existe `Archicel/Apuntes` (el nombre antiguo) se renombra a `Asignaturas` en vez de
 * crear una segunda: los ficheros viejos seguirían abriéndose —la ficha guarda su
 * identificador, no su ruta— pero quien entrara en Drive vería el trabajo repartido en dos
 * sitios sin saber por qué. Renombrarla se puede porque la creó esta misma aplicación.
 */
async function resolverRuta(clave: string): Promise<string> {
  const nombre = nombreDe(clave);
  const b = await buscarRuta(nombre, true);
  if (b.asig) return b.asig;

  const crear = turno.then(async () => {
    const raiz = b.raiz ?? (await crearCarpetaEn(RAIZ, 'root'));
    let asignaturas = b.asignaturas;
    if (!asignaturas && b.vieja) {
      await llamar(`${API}/files/${b.vieja}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: NOMBRE }),
      });
      asignaturas = b.vieja;
    }
    asignaturas ??= await crearCarpetaEn(NOMBRE, raiz);
    return crearCarpetaEn(nombre, asignaturas);
  });
  turno = crear.catch(() => {});
  return crear;
}

function carpetaDeAsignatura(clave: string): Promise<string> {
  let p = rutas.get(clave);
  if (!p) {
    const nueva = resolverRuta(clave);
    rutas.set(clave, nueva);
    /* Un fallo no se recuerda: la siguiente vez se vuelve a intentar. */
    nueva.catch(() => {
      if (rutas.get(clave) === nueva) rutas.delete(clave);
    });
    p = nueva;
  }
  return p;
}

/**
 * Busca la carpeta de la asignatura **sin crear nada y sin abrir ninguna ventana**, para
 * que la primera subida no tenga que esperarla.
 *
 * Solo busca: crear carpetas en el Drive de alguien por haber abierto una página sería
 * tocar su Drive sin que haya hecho nada. Si no existen, se crearán al subir.
 */
export function prepararCarpeta(clave: string): void {
  if (rutas.has(clave) || !hayPermiso()) return;
  void buscarRuta(nombreDe(clave), false)
    .then((b) => {
      if (b.asig && !rutas.has(clave)) rutas.set(clave, Promise.resolve(b.asig));
    })
    .catch(() => {});
}

/**
 * Hace algo dentro de la carpeta de destino, y se recupera si la carpeta fija ya no está.
 *
 * Si el destino es una carpeta de la usuaria y Drive dice que no existe, no hay nada que
 * recrear: se dice (`sin-carpeta`). Si es la de la asignatura —que Archicel recordaba—, se
 * olvida, se busca o se crea otra vez, y se repite **una** vez. Sin recargar.
 */
async function enCarpeta<T>(destino: Destino, hacer: (padre: string) => Promise<T>): Promise<T> {
  if (destino.padre?.proveedor === 'drive') return hacer(destino.padre.id);
  const padre = await carpetaDeAsignatura(destino.asignatura);
  try {
    return await hacer(padre);
  } catch (e) {
    if (!(e instanceof FalloDeArchivo) || e.causa !== 'sin-carpeta') throw e;
    olvidarCarpetas();
    return hacer(await carpetaDeAsignatura(destino.asignatura));
  }
}

/* ───────────────────────── subir ───────────────────────── */

/** Lo pequeño, de una vez, con progreso. */
async function subirDeUnaVez(fichero: File, meta: object, alAvanzar?: (tanto: number) => void): Promise<string> {
  for (let intento = 0; ; intento++) {
    const t = await token(true);
    const cuerpo = new FormData();
    cuerpo.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
    cuerpo.append('file', fichero);
    const r = await xhr('POST', `${SUBIDA}?uploadType=multipart&fields=id`, {
      cabeceras: { Authorization: `Bearer ${t}` },
      cuerpo,
      alSubir: (hecho, total) => alAvanzar?.(Math.min(0.98, hecho / total)),
    });
    if (r.estado === 200 || r.estado === 201) {
      alAvanzar?.(1);
      return idDe(r.texto);
    }
    const fallo = traducir(r.estado, r.texto, 'destino');
    if (fallo.causa === 'caducada') caducarToken(t);
    if (intento < REINTENTOS && sePuedeReintentar(fallo, false)) {
      await esperar(espera(intento, r.cabecera('Retry-After')));
      continue;
    }
    throw fallo;
  }
}

/**
 * Las subidas por trozos que se quedaron a medias, por fichero.
 *
 * La tira de fallos guarda el mismo `File`, así que «Reintentar» llega aquí con él y la
 * subida **sigue donde se quedó**, en la misma sesión y por tanto en la misma carpeta de
 * destino que la primera vez. Una sesión de Drive vale una semana; un `WeakMap` la suelta
 * sola cuando nadie guarda ya el fichero.
 */
const aMedias = new WeakMap<File, string>();

/** La sesión de subida caducó o no existe: hay que abrir otra. */
class SesionPerdida extends FalloDeArchivo {
  constructor() {
    super('desconocida', 'La sesión de subida de Drive caducó.');
  }
}

/** Lo que Drive dice que ya tiene, de su cabecera `Range` («bytes=0-N»). */
function recibido(r: RespuestaXhr): number | null {
  const m = r.cabecera('Range')?.match(/bytes=0-(\d+)/);
  return m ? Number(m[1]) + 1 : null;
}

async function abrirSesion(meta: object): Promise<string> {
  const r = await llamar(
    `${SUBIDA}?uploadType=resumable&fields=id`,
    { method: 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body: JSON.stringify(meta) },
    /* Abrir una sesión dos veces no duplica nada: la que no se use caduca sola. */
    { que: 'destino', idempotente: true },
  );
  /*
   * Una respuesta de otro origen **solo deja leer siete cabeceras** salvo que el servidor
   * exponga más, y `Location` no está entre esas siete. Google la expone, pero si algún día
   * deja de hacerlo esto devuelve `null` — de ahí que el mensaje diga qué cabecera falta.
   */
  const url = r.headers.get('Location');
  if (!url) {
    throw new FalloDeArchivo('desconocida', 'Drive no devolvió la dirección de subida (cabecera Location no legible).');
  }
  return url;
}

/**
 * Manda el fichero por trozos, **y reanuda de verdad**.
 *
 * Tres cosas que hacen que reanudar sea reanudar:
 *
 *   · Tras cada trozo, Drive contesta 308 con `Range`: lo que tiene **de verdad**, que puede
 *     ser menos de lo enviado. El siguiente trozo sale de ahí, no de donde acabó el anterior.
 *   · Tras un corte, un 5xx o un límite, se espera y se **pregunta** cuánto llegó
 *     (`Content-Range: bytes *\/total`, cuerpo vacío) en vez de suponerlo.
 *   · Si la sesión ya no existe (404/410), se avisa con `SesionPerdida` y `subir` abre otra.
 */
async function enviarPorTrozos(
  url: string,
  fichero: File,
  alAvanzar: ((tanto: number) => void) | undefined,
  preguntarPrimero: boolean,
): Promise<string> {
  const total = fichero.size;
  let desde = 0;
  let preguntar = preguntarPrimero;
  let seguidos = 0;

  for (;;) {
    let r: RespuestaXhr | null = null;
    try {
      if (preguntar) {
        r = await xhr('PUT', url, { cabeceras: { 'Content-Range': `bytes */${total}` } });
        if (r.estado === 308) {
          /* Sin `Range`, Drive no tiene nada todavía. */
          desde = recibido(r) ?? 0;
          preguntar = false;
          alAvanzar?.(desde / total);
          continue;
        }
      } else {
        const hasta = Math.min(desde + TROZO, total);
        const base = desde;
        r = await xhr('PUT', url, {
          cabeceras: { 'Content-Range': `bytes ${desde}-${hasta - 1}/${total}` },
          cuerpo: fichero.slice(desde, hasta),
          alSubir: (hecho) => alAvanzar?.(Math.min(0.99, (base + hecho) / total)),
        });
        if (r.estado === 308) {
          /*
           * Si el navegador no deja leer `Range` (Google la expone, pero una respuesta de otro
           * origen solo enseña lo que el servidor declara), lo único razonable es dar por
           * recibido el trozo: suponer cero repetiría el mismo trozo para siempre.
           */
          desde = recibido(r) ?? hasta;
          seguidos = 0;
          continue;
        }
      }
    } catch (e) {
      if (!(e instanceof FalloDeArchivo) || e.causa !== 'red') throw e;
      r = null;
    }

    if (r && (r.estado === 200 || r.estado === 201)) {
      alAvanzar?.(1);
      return idDe(r.texto);
    }
    if (r && (r.estado === 404 || r.estado === 410)) throw new SesionPerdida();

    const fallo = r ? traducir(r.estado, r.texto) : new FalloDeArchivo('red', 'Se cortó la subida.');
    const pasajero = !r || r.estado >= 500 || (fallo.causa === 'limite' && sePuedeReintentar(fallo, true));
    if (!pasajero || seguidos >= REINTENTOS_DE_SUBIDA) throw fallo;
    await esperar(espera(seguidos++, r?.cabecera('Retry-After')));
    preguntar = true;
  }
}

/* ───────────────────────── leer ───────────────────────── */

/**
 * Lo ya abierto, en memoria, para que volver a abrirlo sea instantáneo.
 *
 * Con tope: 96 MB en total y nada de más de 32 MB por fichero, que una lámina enorme no
 * eche a todo lo demás. El más antiguo sale primero.
 */
const recordados = new Map<string, Blob>();
let ocupado = 0;
const CABEN = 96 * 1024 * 1024;
const POR_FICHERO = 32 * 1024 * 1024;

function recordarBlob(id: string, blob: Blob): void {
  if (blob.size > POR_FICHERO) return;
  const antes = recordados.get(id);
  if (antes) ocupado -= antes.size;
  recordados.delete(id);
  recordados.set(id, blob);
  ocupado += blob.size;
  for (const [k, b] of recordados) {
    if (ocupado <= CABEN) break;
    recordados.delete(k);
    ocupado -= b.size;
  }
}

interface Descarga {
  promesa: Promise<Blob>;
  oyentes: Set<(hastaAhora: Blob, tanto: number) => void>;
  ultimo?: [Blob, number];
}

/** Lo que está bajando: abrir mientras se precarga se engancha a la misma descarga. */
const bajando = new Map<string, Descarga>();

/**
 * Baja un fichero **leyendo el flujo**, y avisa de lo que va llegando.
 *
 * Una `<img>` o un `<iframe>` no saben mandar la cabecera de autorización, así que el
 * fichero hay que bajarlo aquí. Pero no hace falta esperar al último byte para enseñar
 * algo: cada ~200 ms se entrega un `Blob` con lo recibido, y una imagen se va pintando de
 * arriba abajo mientras baja. Los trozos se encadenan como `Blob` de `Blob`, que el
 * navegador no copia: entregar veinte parciales de una lámina de 80 MB no cuesta 800 MB.
 */
function descargar(id: string, op: OpcionesDeLectura, interactivo: boolean): Descarga {
  const d: Descarga = { oyentes: new Set(), promesa: Promise.resolve(new Blob()) };
  d.promesa = (async () => {
    const r = await llamar(`${API}/files/${encodeURIComponent(id)}?alt=media`, {}, { interactivo });
    const tipo = op.tipo || r.headers.get('Content-Type') || '';
    const total = Number(r.headers.get('Content-Length')) || op.tam || 0;
    if (!r.body) return new Blob([await r.blob()], { type: tipo });

    const lector = r.body.getReader();
    const partes: Blob[] = [];
    let sueltos: Uint8Array<ArrayBuffer>[] = [];
    let llegado = 0;
    let avisado = 0;
    try {
      for (;;) {
        const { done, value } = await lector.read();
        if (done) break;
        sueltos.push(value as Uint8Array<ArrayBuffer>);
        llegado += value.byteLength;
        const ahora = performance.now();
        if (d.oyentes.size > 0 && ahora - avisado > 200) {
          partes.push(new Blob(sueltos));
          sueltos = [];
          d.ultimo = [new Blob(partes, { type: tipo }), total ? Math.min(0.99, llegado / total) : 0];
          for (const o of d.oyentes) o(...d.ultimo);
          avisado = ahora;
        }
      }
    } catch (e) {
      throw new FalloDeArchivo('red', 'Se cortó la conexión mientras bajaba.', e);
    }
    if (sueltos.length) partes.push(new Blob(sueltos));
    const blob = new Blob(partes, { type: tipo });
    recordarBlob(id, blob);
    return blob;
  })();
  bajando.set(id, d);
  d.promesa.then(
    () => bajando.delete(id),
    () => bajando.delete(id),
  );
  return d;
}

/** Hasta este tamaño, pasar el puntero por encima ya lo va bajando. */
const PRECARGA = 8 * 1024 * 1024;

/**
 * Empieza a bajar un apunte antes de que se abra, cuando el puntero se posa en su fila.
 *
 * Entre posarse y hacer clic pasan unos cientos de milisegundos, que es justo lo que tarda
 * en llegar un PDF de teoría: cuando se abre, ya está. Solo con el token vigente —nunca
 * abre una ventana— y solo lo pequeño, que precargar una lámina de 80 MB por pasar por
 * encima sería gastar datos de alguien por nada.
 */
export function precargar(remoto: Remoto, op: { tipo?: string; tam?: number }): void {
  if (remoto.proveedor !== 'drive' || !hayPermiso()) return;
  if ((op.tam ?? Infinity) > PRECARGA || recordados.has(remoto.id) || bajando.has(remoto.id)) return;
  descargar(remoto.id, op, false).promesa.catch(() => {});
}

/* ───────────────────────── de quién es ───────────────────────── */

/**
 * De quién es el Drive conectado.
 *
 * Hace falta porque cada persona conecta el suyo: «En tu Drive» no dice cuál, y con dos
 * cuentas de Google abiertas en el mismo navegador —que es lo normal— es perfectamente
 * posible conceder con la que no era y no enterarse hasta que los apuntes no aparecen
 * donde deberían.
 *
 * `about` funciona con `drive.file` sin pedir ningún permiso extra: devuelve quién ha
 * autorizado, no una lista de nada.
 *
 * Se recuerda por pestaña: la cuenta no cambia sin volver a conectar.
 */
let quienEs: string | null = null;

export async function deQuienEsElDrive(): Promise<string | null> {
  if (quienEs) return quienEs;
  if (!hayPermiso()) return null;
  try {
    const r = await llamar(`${API}/about?fields=user(emailAddress,displayName)`, {}, { interactivo: false });
    const { user } = (await r.json()) as { user?: { emailAddress?: string; displayName?: string } };
    quienEs = user?.emailAddress ?? user?.displayName ?? null;
    return quienEs;
  } catch {
    /* Saber de quién es es una comodidad, no un requisito: si falla, la pantalla dice
       «En tu Drive» como antes y todo lo demás sigue funcionando. */
    return null;
  }
}

/** Al desconectar hay que olvidarlo, o la pantalla seguiría enseñando la cuenta anterior. */
export function olvidarQuien(): void {
  quienEs = null;
}

/* ───────────────────────── el archivador ───────────────────────── */

export function crearArchivadorDrive(): Archivador {
  return {
    nombre: 'drive',

    disponible: () => hayPermiso(),

    async conectar() {
      await token(true);
    },

    async subir(fichero, destino: Destino, alAvanzar) {
      /*
       * El token, **antes que nada**, y ese orden es el arreglo.
       *
       * Renovarlo puede abrir una ventana de Google, y un navegador solo lo permite
       * mientras dura el permiso que deja un gesto — unos segundos desde el clic o desde
       * soltar el fichero. Buscando primero la carpeta se gastaba ese presupuesto en red, y
       * la ventana llegaba tarde y la bloqueaban. Con el permiso ya concedido, esa ventana
       * se abre y se cierra sin enseñar nada.
       */
      await token(true);

      /* Una subida por trozos que se cortó: se sigue, a la carpeta de la primera vez. */
      const pendiente = aMedias.get(fichero);
      if (pendiente) {
        try {
          const id = await enviarPorTrozos(pendiente, fichero, alAvanzar, true);
          aMedias.delete(fichero);
          return { proveedor: 'drive', id };
        } catch (e) {
          if (!(e instanceof SesionPerdida)) throw e;
          aMedias.delete(fichero);
        }
      }

      const id = await enCarpeta(destino, async (padre) => {
        const meta = {
          name: fichero.name,
          parents: [padre],
          /* Sin tipo, Drive adivina por la extensión y a veces se equivoca. */
          ...(fichero.type ? { mimeType: fichero.type } : {}),
        };
        if (fichero.size <= DE_UNA_VEZ) return subirDeUnaVez(fichero, meta, alAvanzar);

        const url = await abrirSesion(meta);
        aMedias.set(fichero, url);
        const hecho = await enviarPorTrozos(url, fichero, alAvanzar, false);
        aMedias.delete(fichero);
        return hecho;
      });
      return { proveedor: 'drive', id };
    },

    async crearCarpeta(nombre, destino: Destino) {
      await token(true);
      const id = await enCarpeta(destino, (padre) => crearCarpetaEn(nombre, padre));
      return { proveedor: 'drive' as const, id };
    },

    async renombrar(remoto: Remoto, nombre: string) {
      if (remoto.proveedor !== 'drive') return;
      await llamar(`${API}/files/${encodeURIComponent(remoto.id)}?fields=id`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nombre }),
      });
    },

    async mover(remoto: Remoto, desde: Remoto | null, hasta: Remoto | null, destino: Destino) {
      if (remoto.proveedor !== 'drive') return;
      /*
       * Drive no tiene «mover»: tiene **padres**, y mover es quitar uno y poner otro en la
       * misma llamada. Si se hiciera en dos, un fallo entre medias dejaría el fichero en
       * los dos sitios o en ninguno.
       *
       * La raíz de la asignatura es un destino como otro cualquiera, solo que hay que
       * preguntársela a Drive — y solo si hace falta: entre dos carpetas de la usuaria no
       * se busca nada.
       */
      const deDrive = (r: Remoto | null) => (r?.proveedor === 'drive' ? r.id : null);
      const hacer = async (raiz: string | null) => {
        const nuevo = deDrive(hasta) ?? (raiz as string);
        const viejo = deDrive(desde) ?? (raiz as string);
        if (nuevo === viejo) return;
        await llamar(
          `${API}/files/${encodeURIComponent(remoto.id)}?addParents=${nuevo}&removeParents=${viejo}&fields=id`,
          { method: 'PATCH' },
        );
      };
      /* Un 404 que nombra la carpeta de destino no es que falte el fichero. */
      const nombrar = (e: unknown): never => {
        const id = deDrive(hasta);
        if (id && falta(e, id)) {
          throw new FalloDeArchivo('sin-carpeta', 'La carpeta de destino ya no está en tu Drive.', e, (e as FalloDeArchivo).detalle);
        }
        throw e;
      };

      if (deDrive(hasta) && deDrive(desde)) return hacer(null).catch(nombrar);
      const raiz = await carpetaDeAsignatura(destino.asignatura);
      try {
        await hacer(raiz);
      } catch (e) {
        /* La carpeta de la asignatura recordada ya no existe: se busca otra vez y se repite. */
        if (!falta(e, raiz)) nombrar(e);
        olvidarCarpetas();
        await hacer(await carpetaDeAsignatura(destino.asignatura)).catch(nombrar);
      }
    },

    async borrar(remoto: Remoto) {
      if (remoto.proveedor !== 'drive') throw new FalloDeArchivo('no-esta', 'Ese apunte no está en Drive.');
      /*
       * A la papelera, no destruido.
       *
       * Treinta días para arrepentirse, que es lo que hace Drive con todo lo demás. Un
       * `DELETE` de verdad borraría sin vuelta atrás desde un botón que en el resto del
       * sistema significa «se puede recuperar». Mandar una carpeta a la papelera se lleva
       * todo lo que tiene dentro, y sacarla de allí lo trae todo de vuelta.
       *
       * Si ya no estaba, está hecho: es la única respuesta de error que confirma lo que se
       * pedía. Cualquier otra se lanza, y quien llama conserva la ficha.
       */
      try {
        await llamar(`${API}/files/${encodeURIComponent(remoto.id)}?fields=id`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trashed: true }),
        });
      } catch (e) {
        if (e instanceof FalloDeArchivo && e.causa === 'no-esta') return;
        throw e;
      }
    },

    async leer(remoto: Remoto, op: OpcionesDeLectura = {}) {
      if (remoto.proveedor !== 'drive') throw new FalloDeArchivo('no-esta', 'Ese apunte no está en Drive.');
      const ya = recordados.get(remoto.id);
      if (ya) {
        recordarBlob(remoto.id, ya);
        op.alAvanzar?.(ya, 1);
        return ya;
      }
      const d = bajando.get(remoto.id) ?? descargar(remoto.id, op, true);
      const oyente = op.alAvanzar;
      if (oyente) {
        d.oyentes.add(oyente);
        if (d.ultimo) oyente(...d.ultimo);
      }
      try {
        return await d.promesa;
      } finally {
        if (oyente) d.oyentes.delete(oyente);
      }
    },
  };
}
