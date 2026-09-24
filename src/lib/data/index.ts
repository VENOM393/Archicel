/**
 * Aquí se decide dónde viven los datos, y es el único sitio donde se decide.
 *
 *   hay sesión  → Firestore (y la app sigue a Celeste entre dispositivos)
 *   no la hay   → el navegador (y la app funciona igual, solo que sin salir de aquí)
 *
 * También vive aquí la migración: al entrar con su cuenta, lo que tenía guardado en el
 * navegador sube a la nube —cada colección una vez, con su propia marca— y no se pierde nada.
 */

import { crearAlmacenFirestore } from './almacen-firestore';
import { crearAlmacenLocal } from './almacen-local';
import { conEspejoLocal } from './espejo';
import type { Almacen, Coleccion, Documento } from './almacen';
import type { ID } from './tipos';

export * from './tipos';
export * from './curso';
export type { Almacen, Coleccion, Documento, Desuscribir } from './almacen';

/** Se avisa a quien quiera enterarse de que la nube rechazó una escritura. */
export type AvisoDeFallo = (error: unknown) => void;
let avisarDeFallo: AvisoDeFallo | null = null;

/**
 * Registra a quién avisar cuando una escritura en la nube falla.
 *
 * La capa de datos no sabe pintar un mensaje y la interfaz no debería saber de Firestore;
 * esto es el cable entre las dos. Sin él, un fallo de escritura se tragaba en un
 * `catch` vacío y la usuaria solo se enteraba al día siguiente, al ver su escritorio
 * como el primer día.
 */
export function registrarAvisoDeFallo(fn: AvisoDeFallo | null): void {
  avisarDeFallo = fn;
}

export function crearAlmacen(uid: string | null): Almacen {
  const local = crearAlmacenLocal();
  if (uid) {
    const nube = crearAlmacenFirestore(uid);
    if (nube) {
      return {
        ...nube,
        /**
         * La disposición del escritorio va siempre con copia en este equipo.
         *
         * Es el único dato que la usuaria coloca a mano, bloque a bloque, y el único que
         * no se puede volver a escribir de memoria si se pierde. El resto —tareas,
         * eventos— se teclea otra vez en un minuto; recolocar el escritorio, no.
         */
        layout: (superficie: string) =>
          conEspejoLocal(nube.layout(superficie), local.layout(superficie), {
            alFallar: (e) => avisarDeFallo?.(e),
          }),
      };
    }
  }
  return local;
}

/* ───────────────────────── la migración al entrar ───────────────────────── */

/**
 * Lo que sube, pieza a pieza. **Una colección nueva que tenga que sobrevivir a entrar
 * con una cuenta se añade aquí y en `PASOS`**, y nada más: su marca es suya, así que
 * quien ya migró el resto la recibe en su próximo arranque sin repetir lo anterior.
 */
export type ParteMigrada = 'eventos' | 'tareas' | 'ajustes' | 'layout' | 'carpetas' | 'apuntes';

/**
 * La marca de antes, que era una para todo.
 *
 * Quien la tiene ya subió eventos, tareas, ajustes y el layout —era lo único que la
 * migración conocía— y **nunca** subió apuntes ni carpetas. Por eso no basta con subir la
 * versión de la marca: repetirlo todo volvería a escribir encima de la nube lo que el
 * navegador tuviera de hace meses. Se lee como «estas cuatro partes, hechas».
 */
const MARCA_UNICA = 'archicel.migrado.v1';
const CUBRIA_LA_UNICA: readonly ParteMigrada[] = ['eventos', 'tareas', 'ajustes', 'layout'];

const marca = (uid: string, parte: ParteMigrada) => `archicel.migrado.${uid}.${parte}`;

function yaSubida(uid: string, parte: ParteMigrada): boolean {
  const ls = window.localStorage;
  if (ls.getItem(marca(uid, parte))) return true;
  return CUBRIA_LA_UNICA.includes(parte) && Boolean(ls.getItem(`${MARCA_UNICA}.${uid}`));
}

/**
 * Sube una colección **sin pisar nada de lo que ya esté en la nube**.
 *
 * Los ids se conservan, así que un documento que ya está arriba es este mismo —subido en
 * un intento anterior que se cortó a medias— o una versión más nueva que se editó desde
 * otro dispositivo. En los dos casos lo correcto es dejarlo: por eso se consulta la nube
 * primero y solo se escribe lo que falta. Eso es lo que hace que repetir sea inofensivo.
 */
async function subirColeccion<T extends { id: ID }>(
  local: Coleccion<T>,
  nube: Coleccion<T>,
  preparar: (doc: T) => T = (d) => d,
): Promise<number> {
  const aqui = await local.listar();
  if (aqui.length === 0) return 0;
  const arriba = new Set((await nube.listar()).map((d) => d.id));
  const faltan = aqui.filter((d) => !arriba.has(d.id));
  await Promise.all(faltan.map((d) => nube.guardar(preparar(d))));
  return faltan.length;
}

/** Lo mismo para un documento único: solo se escribe si arriba no hay nada. */
async function subirDocumento<T>(local: Documento<T>, nube: Documento<T>): Promise<number> {
  const aqui = await local.leer();
  if (aqui === null) return 0;
  if ((await nube.leer()) !== null) return 0;
  await nube.escribir(aqui);
  return 1;
}

const PASOS: Record<ParteMigrada, (local: Almacen, nube: Almacen) => Promise<number>> = {
  eventos: (l, n) => subirColeccion(l.eventos, n.eventos),
  tareas: (l, n) => subirColeccion(l.tareas, n.tareas),
  ajustes: (l, n) => subirDocumento(l.ajustes, n.ajustes),
  layout: (l, n) => subirDocumento(l.layout('escritorio'), n.layout('escritorio')),
  carpetas: (l, n) => subirColeccion(l.carpetas, n.carpetas),
  /* En la nube los apuntes se ordenan por `creado`, y Firestore **deja fuera de la
     consulta** al que no lo tenga: subiría y no se vería. Lo nuevo siempre lo lleva; lo
     muy antiguo quizá no, y ese es el único que se toca. */
  apuntes: (l, n) => subirColeccion(l.apuntes, n.apuntes, (a) => (a.creado ? a : { ...a, creado: Date.now() })),
};

/** Una migración por cuenta a la vez: la sesión puede avisar dos veces seguidas al entrar. */
const enCurso = new Map<string, Promise<Partial<Record<ParteMigrada, number>> | null>>();

/**
 * Sube a la nube lo que hubiera en el navegador, parte por parte.
 *
 * Cada parte deja **su propia marca** y solo cuando ha subido entera. Si algo falla a
 * medias —sin red, una regla que rechaza un documento—, esa parte se queda sin marca y
 * se reintenta en el siguiente arranque; lo que ya llegó no se duplica porque se
 * comprueba antes de escribir. Nada se borra del navegador: la copia local se queda
 * donde estaba.
 *
 * Devuelve cuántos documentos subió cada parte que se intentó en esta pasada.
 */
export function migrarLocalANube(uid: string): Promise<Partial<Record<ParteMigrada, number>> | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  const ya = enCurso.get(uid);
  if (ya) return ya;

  const tarea = (async () => {
    const pendientes = (Object.keys(PASOS) as ParteMigrada[]).filter((p) => !yaSubida(uid, p));
    if (pendientes.length === 0) return null;

    const local = crearAlmacenLocal();
    const nube = crearAlmacenFirestore(uid);
    if (!nube) return null;

    const hechas: Partial<Record<ParteMigrada, number>> = {};
    const fallos: unknown[] = [];
    await Promise.all(
      pendientes.map(async (parte) => {
        try {
          hechas[parte] = await PASOS[parte](local, nube);
          window.localStorage.setItem(marca(uid, parte), new Date().toISOString());
        } catch (e) {
          fallos.push(e);
        }
      }),
    );
    if (fallos.length) throw new AggregateError(fallos, 'La migración no subió todo; se reintentará al volver a entrar.');
    return hechas;
  })().finally(() => enCurso.delete(uid));

  enCurso.set(uid, tarea);
  return tarea;
}
