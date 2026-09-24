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
import { TOPES, acortar } from './limites';
import type { Apunte, Carpeta, ID } from './tipos';

export * from './tipos';
export * from './curso';
export * from './limites';
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

/** Lo que dejó una parte: cuántos subieron y cuáles rechazó la nube, con su motivo. */
interface Resultado {
  subidos: number;
  rechazados: Array<{ id: ID; motivo: string }>;
}

/**
 * Los errores que no se arreglan reintentando: las reglas dijeron que no a **ese**
 * documento. Un corte de red o una nube caída sí se arreglan, y esos dejan la parte sin
 * marca para el siguiente arranque.
 */
function esRechazo(e: unknown): boolean {
  const codigo = (e as { code?: string } | null)?.code ?? '';
  return ['permission-denied', 'invalid-argument', 'failed-precondition'].some((c) => codigo.endsWith(c));
}

/**
 * Sube una colección **sin pisar nada de lo que ya esté en la nube**.
 *
 * Los ids se conservan, así que un documento que ya está arriba es este mismo —subido en
 * un intento anterior que se cortó a medias— o una versión más nueva que se editó desde
 * otro dispositivo. En los dos casos lo correcto es dejarlo: por eso se consulta la nube
 * primero y solo se escribe lo que falta. Eso es lo que hace que repetir sea inofensivo.
 *
 * **Cada documento falla por su cuenta.** Antes bastaba uno que las reglas rechazaran —un
 * nombre de 301 caracteres— para que la parte entera se quedara sin marca y se reintentara
 * en cada arranque, para siempre, fallando siempre en el mismo. Ahora ese se apunta como
 * rechazado y el resto sigue; solo un fallo que se pueda arreglar esperando —la red— hace
 * que la parte se repita.
 */
async function subirColeccion<T extends { id: ID }>(
  local: Coleccion<T>,
  nube: Coleccion<T>,
  preparar: (doc: T) => T = (d) => d,
): Promise<Resultado> {
  const aqui = await local.listar();
  if (aqui.length === 0) return { subidos: 0, rechazados: [] };
  const arriba = new Set((await nube.listar()).map((d) => d.id));
  const faltan = aqui.filter((d) => !arriba.has(d.id));
  const hechos = await Promise.allSettled(faltan.map((d) => nube.guardar(preparar(d))));

  const rechazados: Resultado['rechazados'] = [];
  const pasajeros: unknown[] = [];
  hechos.forEach((h, i) => {
    if (h.status === 'fulfilled') return;
    if (esRechazo(h.reason)) rechazados.push({ id: faltan[i].id, motivo: String((h.reason as Error)?.message ?? h.reason).slice(0, 200) });
    else pasajeros.push(h.reason);
  });
  if (pasajeros.length) throw new AggregateError(pasajeros, 'Algunos documentos no llegaron a la nube.');
  return { subidos: faltan.length - rechazados.length, rechazados };
}

/** Lo mismo para un documento único: solo se escribe si arriba no hay nada. */
async function subirDocumento<T>(local: Documento<T>, nube: Documento<T>): Promise<Resultado> {
  const aqui = await local.leer();
  if (aqui === null) return { subidos: 0, rechazados: [] };
  if ((await nube.leer()) !== null) return { subidos: 0, rechazados: [] };
  await nube.escribir(aqui);
  return { subidos: 1, rechazados: [] };
}

/* Lo que se sabe que las reglas rechazarían, arreglado antes de subir: nombres de más, un
   tipo MIME absurdo. El navegador los aceptaba porque el almacén local no valida nada. */
const carpetaSubible = (c: Carpeta): Carpeta => ({
  ...c,
  nombre: acortar(c.nombre, TOPES.nombreCarpeta),
});
const apunteSubible = (a: Apunte): Apunte => ({
  ...a,
  nombre: acortar(a.nombre, TOPES.nombreApunte),
  tipo: (a.tipo ?? '').slice(0, TOPES.tipo),
  /* En la nube los apuntes se ordenan por `creado`, y Firestore **deja fuera de la
     consulta** al que no lo tenga: subiría y no se vería. Lo nuevo siempre lo lleva; lo
     muy antiguo quizá no. */
  creado: a.creado ?? Date.now(),
});

const PASOS: Record<ParteMigrada, (local: Almacen, nube: Almacen) => Promise<Resultado>> = {
  eventos: (l, n) => subirColeccion(l.eventos, n.eventos),
  tareas: (l, n) => subirColeccion(l.tareas, n.tareas),
  ajustes: (l, n) => subirDocumento(l.ajustes, n.ajustes),
  layout: (l, n) => subirDocumento(l.layout('escritorio'), n.layout('escritorio')),
  carpetas: (l, n) => subirColeccion(l.carpetas, n.carpetas, carpetaSubible),
  apuntes: (l, n) => subirColeccion(l.apuntes, n.apuntes, apunteSubible),
};

/** Dónde queda constancia de lo que la nube rechazó al migrar una parte. */
export const rechazadosAlMigrar = (uid: string, parte: ParteMigrada) => `${marca(uid, parte)}.rechazados`;

/** Una migración por cuenta a la vez: la sesión puede avisar dos veces seguidas al entrar. */
const enCurso = new Map<string, Promise<Partial<Record<ParteMigrada, number>> | null>>();

/**
 * Sube a la nube lo que hubiera en el navegador, parte por parte.
 *
 * Cada parte deja **su propia marca**. Si falla algo que se arregla esperando —sin red,
 * la nube caída—, esa parte se queda sin marca y se reintenta en el siguiente arranque; lo
 * que ya llegó no se duplica porque se comprueba antes de escribir. Si lo que pasa es que
 * las reglas rechazan un documento concreto, la parte se marca igual —repetirla fallaría
 * siempre en el mismo— y ese documento queda apuntado en `rechazadosAlMigrar`. Nada se
 * borra del navegador: la copia local se queda donde estaba.
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
    const rechazos: string[] = [];
    await Promise.all(
      pendientes.map(async (parte) => {
        try {
          const { subidos, rechazados } = await PASOS[parte](local, nube);
          hechas[parte] = subidos;
          /* La parte se marca aunque la nube rechazara alguno: repetirla no lo arreglaría.
             Lo rechazado queda apuntado —id y motivo— y sigue en el navegador. */
          if (rechazados.length) {
            window.localStorage.setItem(rechazadosAlMigrar(uid, parte), JSON.stringify(rechazados));
            rechazos.push(`${parte}: ${rechazados.map((r) => r.id).join(', ')}`);
          }
          window.localStorage.setItem(marca(uid, parte), new Date().toISOString());
        } catch (e) {
          fallos.push(e);
        }
      }),
    );
    if (rechazos.length) {
      fallos.push(new Error(`La nube rechazó algunos documentos, que siguen en este navegador (${rechazos.join('; ')}).`));
    }
    if (fallos.length) throw new AggregateError(fallos, 'La migración no subió todo.');
    return hechas;
  })().finally(() => enCurso.delete(uid));

  enCurso.set(uid, tarea);
  return tarea;
}
