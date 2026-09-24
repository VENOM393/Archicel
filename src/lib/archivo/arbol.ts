/**
 * Borrar una carpeta con todo lo que tiene dentro, sin dejar nada a medias.
 *
 * Es la operación más delicada de la página de una asignatura, y por eso vive aparte y sin
 * pantalla: se puede leer entera sin saber nada de React.
 *
 * ## Una llamada a Drive, no una por fichero
 *
 * En Drive, mandar una carpeta a la papelera **se lleva todo lo que tiene dentro**, y
 * sacarla de allí lo trae todo de vuelta. Así que no se manda a la papelera cada apunte:
 * se manda la carpeta de arriba y ya. Es más rápido, y es lo correcto para quien se
 * arrepienta — si cada fichero fuera a la papelera por su cuenta, restaurar la carpeta la
 * traería vacía.
 *
 * Lo que no está físicamente dentro en Drive sí necesita su propia llamada: un apunte de
 * Drive metido en una carpeta antigua del navegador vive, en Drive, en la carpeta de la
 * asignatura. Esas son las «raíces»: lo mínimo que hay que mandar a la papelera para que
 * todo el árbol acabe allí.
 *
 * ## Solo se borra la ficha de lo que Drive confirmó
 *
 * Si una raíz falla, se conserva su ficha, la de todo lo que cuelga de ella y la de cada
 * carpeta del camino hasta arriba. Así nunca queda un apunte con una carpeta madre que ya
 * no existe —invisible en el árbol— ni una ficha borrada de algo que sigue vivo en Drive.
 */

import type { Apunte, Carpeta } from '@/lib/data';

/** Tope de profundidad: un ciclo en los datos no puede colgar la pestaña. */
const HONDO = 24;

export type Pieza = { tipo: 'carpeta'; c: Carpeta } | { tipo: 'apunte'; a: Apunte };

export interface Arbol {
  carpetas: Carpeta[];
  apuntes: Apunte[];
}

/** La carpeta y todo lo que cuelga de ella, a cualquier profundidad. */
export function arbolDe(raiz: Carpeta, carpetas: Carpeta[], apuntes: Apunte[]): Arbol {
  const dentro = new Set<string>([raiz.id]);
  const lista: Carpeta[] = [raiz];
  for (let i = 0; i < lista.length && i < 5000; i++) {
    for (const c of carpetas) {
      if (c.madre === lista[i].id && !dentro.has(c.id)) {
        dentro.add(c.id);
        lista.push(c);
      }
    }
  }
  return { carpetas: lista, apuntes: apuntes.filter((a) => a.carpeta && dentro.has(a.carpeta)) };
}

export interface PlanDeBorrado {
  arbol: Arbol;
  /** Lo que hay que mandar a la papelera de Drive, una llamada por cada una. */
  raices: Pieza[];
  /** Los apuntes antiguos del navegador, cuyos bytes se borran aquí. */
  locales: Apunte[];
  /** Para cada pieza de Drive, la raíz de la que depende. */
  raizDe: Map<string, string>;
}

export function planDeBorrado(raiz: Carpeta, carpetas: Carpeta[], apuntes: Apunte[]): PlanDeBorrado {
  const arbol = arbolDe(raiz, carpetas, apuntes);
  const porId = new Map(arbol.carpetas.map((c) => [c.id, c]));
  const raizDe = new Map<string, string>();

  /* Una pieza de Drive está cubierta si su madre, dentro del árbol, es una carpeta de
     Drive: en Drive está físicamente dentro de ella y se va a la papelera con ella. */
  const subir = (id: string, madre: string | undefined): string => {
    let actual = id;
    let m = madre;
    for (let i = 0; i < HONDO; i++) {
      if (actual === raiz.id || !m) return actual;
      const c = porId.get(m);
      if (!c || c.remoto.proveedor !== 'drive') return actual;
      actual = c.id;
      m = c.madre;
    }
    return actual;
  };

  const raices: Pieza[] = [];
  for (const c of arbol.carpetas) {
    if (c.remoto.proveedor !== 'drive') continue;
    const r = subir(c.id, c.madre);
    raizDe.set(c.id, r);
    if (r === c.id) raices.push({ tipo: 'carpeta', c });
  }
  for (const a of arbol.apuntes) {
    if (a.remoto.proveedor !== 'drive') continue;
    const r = subir(a.id, a.carpeta);
    raizDe.set(a.id, r);
    if (r === a.id) raices.push({ tipo: 'apunte', a });
  }
  return { arbol, raices, locales: arbol.apuntes.filter((a) => a.remoto.proveedor !== 'drive'), raizDe };
}

/**
 * Qué fichas se pueden borrar, sabiendo qué raíces y qué locales fallaron.
 *
 * Se conserva lo que falló, lo que depende de ello y cada carpeta del camino hasta arriba;
 * todo lo demás, Drive (o el navegador) ya lo confirmó.
 */
export function queSeBorra(plan: PlanDeBorrado, fallidos: Set<string>): { carpetas: Carpeta[]; apuntes: Apunte[] } {
  const { arbol, raizDe } = plan;
  const porId = new Map(arbol.carpetas.map((c) => [c.id, c]));
  const queda = new Set<string>();

  const conservar = (id: string, madre: string | undefined) => {
    queda.add(id);
    let m = madre;
    for (let i = 0; m && i < HONDO && !queda.has(m); i++) {
      queda.add(m);
      m = porId.get(m)?.madre;
    }
  };

  for (const c of arbol.carpetas) {
    const r = raizDe.get(c.id);
    if (r && fallidos.has(r)) conservar(c.id, c.madre);
  }
  for (const a of arbol.apuntes) {
    const r = a.remoto.proveedor === 'drive' ? raizDe.get(a.id) : a.id;
    if (r && fallidos.has(r)) conservar(a.id, a.carpeta);
  }
  return {
    carpetas: arbol.carpetas.filter((c) => !queda.has(c.id)),
    apuntes: arbol.apuntes.filter((a) => !queda.has(a.id)),
  };
}
