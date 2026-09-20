/**
 * El curso: las asignaturas y el horario de clases.
 *
 * Esto vive en el código y no en Firestore a propósito. Un horario cambia dos veces al
 * año, no dos veces al día: guardarlo en la base obligaría a construir una pantalla para
 * editarlo, y mientras tanto nadie podría cambiar una hora sin ella. Aquí se edita este
 * fichero, se guarda y ya está.
 *
 * **Este fichero es la única fuente del color de cada asignatura.** El horario lo usa, y
 * también lo usa cualquier tarea que se asigne a una asignatura: por eso el formulario de
 * tareas no deja elegir color, porque lo decide la asignatura y contradecirla sería un
 * error, no una opción.
 *
 * Cuando cambie el cuatrimestre: se reescriben `ASIGNATURAS` y `HORARIO`. Nada más.
 */

import { registrarCatalogoDeAsignaturas, type Color } from './tipos';

export interface Asignatura {
  /** El código oficial de la escuela, que es lo que aparece en los listados. */
  codigo: string;
  nombre: string;
  /** Para donde no cabe el nombre entero: rejillas estrechas, chips. */
  corto: string;
  color: Color;
}

/**
 * Las asignaturas del cuatrimestre, indexadas por una clave estable.
 *
 * La clave se escribe en las tareas, así que **no se renombra a la ligera**: cambiarla
 * deja huérfanas las tareas que ya la usaban. El nombre visible sí se puede cambiar
 * libremente, porque nadie lo guarda.
 */
export const ASIGNATURAS = {
  matematicas: { codigo: '16003', nombre: 'Matemáticas Aplicadas I', corto: 'Matemáticas', color: 'azul' },
  fisica: { codigo: '16005', nombre: 'Física Aplicada I', corto: 'Física', color: 'verde' },
  geometria: { codigo: '16009', nombre: 'Geometría Descriptiva I', corto: 'Geometría', color: 'naranja' },
  dibujo: { codigo: '16011', nombre: 'Dibujo Arquitectónico I', corto: 'Dibujo', color: 'violeta' },
  teologia: { codigo: '16054', nombre: 'Teología I', corto: 'Teología', color: 'amarillo' },
  analisis: { codigo: '16007', nombre: 'Análisis de Formas en la Arquitectura I', corto: 'Análisis de Formas', color: 'rojo' },
} as const satisfies Record<string, Asignatura>;

export type ClaveAsignatura = keyof typeof ASIGNATURAS;

/** Las claves en orden de listado, para leyendas y selectores. */
export const CLAVES_ASIGNATURA = Object.keys(ASIGNATURAS) as ClaveAsignatura[];

export interface Clase {
  asignatura: ClaveAsignatura;
  /** 1 = lunes … 5 = viernes. Se usa el mismo criterio que en el resto de la app. */
  dia: 1 | 2 | 3 | 4 | 5;
  /** Minutos desde medianoche, como las tareas. */
  ini: number;
  fin: number;
  grupo: string;
  aula: string;
  /** `true` cuando la clase no es presencial: la ficha lo marca. */
  online?: boolean;
}

const h = (hora: number, min = 0) => hora * 60 + min;

const AULA = 'P5_2_A03 · Aula 3, 2ª planta, Pab. 5';
const ONLINE = 'ONLINE 2';

/**
 * El horario semanal. Una entrada por clase; el orden no importa, la vista las coloca.
 *
 * Añadir una clase es añadir una línea. Si aparece una asignatura nueva, primero su
 * entrada en `ASIGNATURAS` — TypeScript no deja referenciar una que no exista.
 */
export const HORARIO: Clase[] = [
  { asignatura: 'matematicas', dia: 1, ini: h(9), fin: h(11), grupo: 'Grupo 1 · Teoría', aula: AULA },
  { asignatura: 'geometria', dia: 1, ini: h(11, 30), fin: h(13, 30), grupo: 'Grupo 1 · Teoría', aula: AULA },

  { asignatura: 'fisica', dia: 2, ini: h(9), fin: h(11), grupo: 'Grupo 1 · Teoría', aula: AULA },
  { asignatura: 'teologia', dia: 2, ini: h(11, 30), fin: h(13, 30), grupo: 'Grupo 1 · Teoría', aula: AULA },

  { asignatura: 'dibujo', dia: 3, ini: h(9), fin: h(11), grupo: 'Grupo 1 · Teoría', aula: ONLINE, online: true },
  { asignatura: 'matematicas', dia: 3, ini: h(12), fin: h(14), grupo: 'Grupo 1 · Teoría', aula: AULA },

  { asignatura: 'fisica', dia: 4, ini: h(9), fin: h(11), grupo: 'Grupo 1 · Teoría', aula: AULA },
  { asignatura: 'dibujo', dia: 4, ini: h(12), fin: h(14), grupo: 'Grupo 1 · Teoría', aula: ONLINE, online: true },

  { asignatura: 'analisis', dia: 5, ini: h(9, 30), fin: h(11, 30), grupo: 'Grupo 1 · Teoría', aula: AULA },
  { asignatura: 'geometria', dia: 5, ini: h(12), fin: h(14), grupo: 'Grupo 1 · Teoría', aula: AULA },
];

/** La primera y la última hora con clase, para que la rejilla no dibuje horas vacías. */
export function franjaDelHorario(): { desde: number; hasta: number } {
  const inicios = HORARIO.map((c) => c.ini);
  const finales = HORARIO.map((c) => c.fin);
  return { desde: Math.floor(Math.min(...inicios) / 60), hasta: Math.ceil(Math.max(...finales) / 60) };
}

/**
 * La asignatura de una tarea, buscada con tolerancia.
 *
 * Una tarea guarda el nombre que se escribió a mano, no una clave, así que aquí se acepta
 * tanto la clave (`fisica`) como el nombre visible o el corto, sin tildes ni mayúsculas.
 * Devuelve `null` si no encaja con ninguna: eso es legítimo —una tarea puede no ser de
 * ninguna asignatura— y quien llama decide qué color darle.
 */
export function buscarAsignatura(texto: string | undefined): Asignatura | null {
  if (!texto?.trim()) return null;
  const limpio = normalizar(texto);
  for (const clave of CLAVES_ASIGNATURA) {
    const a = ASIGNATURAS[clave];
    if (
      limpio === normalizar(clave) ||
      limpio === normalizar(a.nombre) ||
      limpio === normalizar(a.corto) ||
      limpio === a.codigo ||
      /* "física" encuentra "Física Aplicada I", que es como se escribe de memoria */
      normalizar(a.nombre).startsWith(limpio) ||
      normalizar(a.corto).startsWith(limpio)
    ) {
      return a;
    }
  }
  return null;
}

/** Sin tildes, sin mayúsculas y sin espacios de sobra: para comparar lo que se teclea. */
function normalizar(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/* El catálogo se registra al cargarse el módulo: desde aquí en adelante, `colorDeAsignatura`
   de `tipos.ts` responde con el color real de la asignatura en vez de un gris. Se hace en
   esta dirección —el catálogo se ofrece, los tipos no lo buscan— para que la capa de datos
   básica no dependa de los contenidos concretos de un curso. */
registrarCatalogoDeAsignaturas(buscarAsignatura);
