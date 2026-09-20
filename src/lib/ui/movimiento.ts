/**
 * El vocabulario de movimiento de Archicel.
 *
 * Esto es lo que separa una aplicación que *tiene* animaciones de una que *está*
 * animada. Sin un sitio único donde vivan las curvas y los tiempos, cada componente
 * inventa los suyos: una hoja entra en 280 ms, un panel en 320, el aviso en 250, y aunque
 * cada uno por separado esté bien, juntos no van a compás. Nadie sabe decir por qué, pero
 * se nota — igual que se nota una banda desafinada aunque no sepas qué instrumento falla.
 *
 * Aquí están los tiempos y las curvas, con nombre. Un componente elige **cuál** usa, no
 * **cuánto dura**.
 *
 * ## Por qué muelles y no duraciones
 *
 * Una duración describe cuánto tarda; un muelle describe cómo se comporta. Lo segundo es
 * lo que hace que dos cosas que se mueven a la vez parezcan del mismo material aunque
 * recorran distancias distintas: el muelle se adapta solo a la distancia, la duración no.
 *
 * Por eso lo que reacciona al dedo va con muelle, y solo lo que aparece o desaparece —
 * donde no hay distancia que recorrer, solo opacidad— va con duración.
 */

import type { Transition, Variants } from 'motion/react';

/* ───────────────────────── muelles ───────────────────────── */

/**
 * Los cuatro muelles de la casa. La diferencia entre ellos es la masa: cuanto más pesa,
 * más tarda en arrancar y más cuesta pararlo — que es exactamente lo que distingue un
 * panel grande de un icono pequeño.
 */
export const MUELLE = {
  /** Para lo pequeño que responde al dedo: iconos, botones, el dock. */
  vivo: { type: 'spring', mass: 0.1, stiffness: 170, damping: 12 },
  /** El de trabajo: paneles, hojas, cambios de vista. */
  normal: { type: 'spring', mass: 0.5, stiffness: 240, damping: 28 },
  /** Para lo que pesa: una hoja a pantalla completa, el lienzo. */
  denso: { type: 'spring', mass: 1, stiffness: 190, damping: 30 },
  /** Sin rebote, para lo que no debe pasarse ni un píxel: posiciones de widgets. */
  seco: { type: 'spring', mass: 0.6, stiffness: 300, damping: 40 },
} as const satisfies Record<string, Transition>;

/* ───────────────────────── curvas y tiempos ───────────────────────── */

/**
 * Las mismas curvas que ya usaba el CSS de la casa, para que lo que se anima con Motion y
 * lo que sigue en CSS no se distingan. Si estas dos listas dejan de coincidir, la interfaz
 * empieza a sonar a dos manos distintas.
 */
export const CURVA = {
  /** `--ease-out`: sale disparado y frena largo. Para lo que entra. */
  salida: [0.16, 1, 0.3, 1],
  /** `--ease-soft`: acompaña. Para lo que responde. */
  suave: [0.33, 1, 0.68, 1],
  /** Para lo que se va: rápido al final, sin ceremonia. */
  fuera: [0.4, 0, 1, 1],
} as const;

/**
 * Tres tiempos y no trece.
 *
 * `roce` es el tope de lo que se puede sentir instantáneo; `paso` es el ritmo normal de la
 * interfaz; `viaje` es para lo que cruza la pantalla. Cualquier número entre medias es una
 * decisión que nadie podrá defender dentro de tres meses.
 */
export const TIEMPO = { roce: 0.24, paso: 0.42, viaje: 0.72 } as const;

/** El retardo entre hermanos de una entrada escalonada. */
export const ESCALON = 0.052;

/* ───────────────────────── variantes compartidas ───────────────────────── */

/**
 * Aparecer y desaparecer.
 *
 * La salida no es la entrada al revés, y esa es la regla que más se incumple. Algo que
 * entra se presenta —sube, se enfoca, se toma su tiempo—; algo que se va ya no interesa a
 * nadie, así que se va en la mitad de tiempo y sin desplazarse apenas. Invertir la entrada
 * para la salida hace que cerrar una hoja se sienta tan lento como abrirla, que es el
 * defecto más común de las interfaces animadas.
 */
export const APARECER: Variants = {
  fuera: { opacity: 0, y: 12, scale: 0.985, filter: 'blur(6px)' },
  dentro: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: { duration: TIEMPO.paso, ease: CURVA.salida },
  },
  saliendo: {
    opacity: 0,
    y: 4,
    scale: 0.99,
    filter: 'blur(3px)',
    transition: { duration: TIEMPO.roce, ease: CURVA.fuera },
  },
};

/** Un contenedor que reparte la entrada de sus hijos. Se usa con `APARECER` en cada uno. */
export const ORQUESTA: Variants = {
  fuera: {},
  dentro: { transition: { staggerChildren: ESCALON, delayChildren: 0.06 } },
  /* Al salir, del último al primero: el grupo se deshace por donde se formó. */
  saliendo: { transition: { staggerChildren: ESCALON * 0.5, staggerDirection: -1 } },
};

/** El velo de las hojas modales. No se mueve: solo aparece y se va. */
export const VELO: Variants = {
  fuera: { opacity: 0 },
  dentro: { opacity: 1, transition: { duration: TIEMPO.roce, ease: CURVA.suave } },
  saliendo: { opacity: 0, transition: { duration: TIEMPO.roce, ease: CURVA.fuera } },
};

/** Una hoja que sube desde abajo. Entra con muelle, sale con prisa. */
export const HOJA: Variants = {
  fuera: { opacity: 0, y: 26, scale: 0.97 },
  dentro: { opacity: 1, y: 0, scale: 1, transition: MUELLE.normal },
  saliendo: { opacity: 0, y: 10, scale: 0.985, transition: { duration: TIEMPO.roce, ease: CURVA.fuera } },
};

/**
 * El aviso de abajo.
 *
 * El `-50%` del centrado viaja **dentro de la variante**, no en el CSS. Motion escribe su
 * propio `transform` en línea y pisaría cualquiera que pusiera la hoja de estilos: la
 * regla es que una propiedad la controla CSS o la controla Motion, nunca las dos.
 */
export const AVISO: Variants = {
  fuera: { opacity: 0, x: '-50%', y: 16 },
  dentro: { opacity: 1, x: '-50%', y: 0, transition: MUELLE.normal },
  saliendo: { opacity: 0, x: '-50%', y: 8, transition: { duration: TIEMPO.roce, ease: CURVA.fuera } },
};

/**
 * Lo que se anula cuando alguien pide menos movimiento.
 *
 * Se anula el **viaje**, nunca el estado final: quien pide menos movimiento quiere la
 * misma interfaz sin desplazamientos, no una interfaz que no le diga cuándo algo ha
 * cambiado. Por eso la opacidad sobrevive y el desplazamiento, la escala y el desenfoque
 * no.
 */
export const QUIETO: Variants = {
  fuera: { opacity: 0 },
  dentro: { opacity: 1, transition: { duration: 0.12 } },
  saliendo: { opacity: 0, transition: { duration: 0.1 } },
};

/** Elige el juego de variantes según lo que la usuaria haya pedido. */
export function segun(quieto: boolean, variantes: Variants): Variants {
  return quieto ? QUIETO : variantes;
}
