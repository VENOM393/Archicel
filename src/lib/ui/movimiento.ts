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

/**
 * Un bloque del escritorio posándose.
 *
 * El desenfoque de entrada es el mismo material del cristal aclarándose, no un efecto
 * añadido: el widget llega como si estuviera fuera de foco y se asienta. Se dispara solo
 * cuando el layout real ya está puesto — nadie debe ver un bloque aterrizar en su sitio de
 * fábrica y saltar después.
 */
export const POSARSE: Variants = {
  fuera: { opacity: 0, y: 16, scale: 0.985, filter: 'blur(7px)' },
  dentro: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: { duration: TIEMPO.viaje, ease: CURVA.salida },
  },
};

/**
 * El relevo entre dos vistas que ocupan el mismo hueco.
 *
 * Sale hacia arriba y entra desde abajo, nunca las dos a la vez: superponerlas las
 * mezcla durante 200 ms y se lee como un fallo. Quien lo garantiza es
 * `AnimatePresence mode="wait"`, no esta variante — aquí solo están las dos mitades
 * del gesto.
 *
 * Esto sustituye a un `setTimeout` que tenía que coincidir con una duración escrita en
 * el CSS. Dos números en dos ficheros que deben ser iguales y que nada obliga a serlo:
 * el día que alguien toca uno, la vista nueva entra encima de la vieja.
 */
export const RELEVO: Variants = {
  fuera: { opacity: 0, y: 12, scale: 0.994, filter: 'blur(5px)' },
  dentro: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: { duration: TIEMPO.paso, ease: CURVA.salida },
  },
  saliendo: {
    opacity: 0,
    y: -8,
    scale: 0.996,
    filter: 'blur(4px)',
    transition: { duration: 0.2, ease: CURVA.suave },
  },
};

/* ═══════════════════ el cambio de página ═══════════════════ */

/**
 * El orden del dock, que es el orden del mundo.
 *
 * Las tres secciones están puestas en fila y en este orden. Si el dock las reordena, esta
 * lista va con él: es de donde sale el sentido del viaje, y una transición que empuja a
 * la izquierda mientras el agua del dock viaja a la derecha se lee como un fallo aunque
 * las dos animaciones sean impecables por separado.
 */
const ORDEN = ['/', '/calendario', '/horario'] as const;

/**
 * Qué pantallas son el detalle de cuál.
 *
 * `/dia` no está en el dock porque no es un destino: se llega pulsando un día dentro de
 * la semana. Es una capa más adentro, y eso no se cruza de lado — se entra y se sale.
 */
const DENTRO_DE: Record<string, string> = { '/dia': '/calendario' };

/**
 * Cómo se va de una pantalla a otra.
 *
 * `lateral` con su sentido para las hermanas, `profundidad` para entrar y salir de un
 * detalle, y `quieto` cuando no hay de dónde venir — la primera carga, o un salto que no
 * está en el mapa. En ese caso no se inventa una dirección: se funde y ya.
 */
export type Viaje =
  | { eje: 'quieto' }
  | { eje: 'lateral'; sentido: 1 | -1 }
  | { eje: 'profundidad'; sentido: 1 | -1 };

export const SIN_VIAJE: Viaje = { eje: 'quieto' };

/** En qué sección del dock cae una ruta. Un detalle cuenta como la suya. */
function seccionDe(ruta: string): string {
  return DENTRO_DE[ruta] ?? ruta;
}

export function viajeEntre(desde: string | null, hasta: string): Viaje {
  if (!desde || desde === hasta) return SIN_VIAJE;

  /*
   * Lo que decide es la **sección del dock**, no la ruta, y esa distinción importa en un
   * caso concreto: de `/dia` a `/horario`. Comparando rutas no es ni un cambio lateral ni
   * uno de profundidad, así que saldría un fundido neutro — mientras el agua del dock
   * viaja hacia la derecha, porque desde la agenda del día lo que está señalado es
   * Calendario. La página quieta al lado del indicador viajando se lee como un fallo.
   *
   * Comparando secciones sale bien solo: mismas sección, es profundidad; secciones
   * distintas, es lateral y en el sentido en que se mueve el agua. Siempre.
   */
  const aqui = seccionDe(desde);
  const alla = seccionDe(hasta);

  /* misma sección del dock: se entra en su detalle o se sale de él */
  if (aqui === alla) return { eje: 'profundidad', sentido: DENTRO_DE[hasta] ? 1 : -1 };

  const a = ORDEN.indexOf(aqui as (typeof ORDEN)[number]);
  const b = ORDEN.indexOf(alla as (typeof ORDEN)[number]);
  if (a >= 0 && b >= 0) return { eje: 'lateral', sentido: b > a ? 1 : -1 };

  /* Una ruta que no está en el mapa —la pantalla de acceso, un 404—. Podría inventarse
     un sentido, pero sería una mentira que se nota. */
  return SIN_VIAJE;
}

/* Cuánto viaja una página de lado. Poco a propósito: esto se cruza cincuenta veces al día
   y una pantalla que se desplaza medio ancho es idioma de móvil, no de escritorio. Lo que
   hace legible la dirección no es la distancia, es que la salida y la entrada empujen
   hacia el mismo lado. */
const CRUZA = 40;
const APARTA = 28;

/* Y cuánto se acerca o se aleja al entrar en un detalle. Aún menos: la escala se nota
   mucho antes que el desplazamiento, y pasado el 3 % deja de leerse como profundidad y
   empieza a leerse como un zoom de presentación. */
const LEJOS = 0.975;
const CERCA = 1.022;

/**
 * El cambio de página, en dos ejes.
 *
 * ## El reparto: el envoltorio viaja, el contenido llega
 *
 * Esta variante **no lleva opacidad en la entrada**, y esa ausencia es el diseño entero.
 * Si el envoltorio se fundiera y además su contenido se escalonara, serían dos
 * animaciones apiladas sobre la misma cosa: el mismo gesto contado dos veces, que es como
 * se consigue que algo bien hecho parezca recargado.
 *
 * Así que el envoltorio solo **viaja** —se desplaza o se acerca— y lo que aparece es el
 * contenido, pieza a pieza, con `ORQUESTA` y `PIEZA`. La sincronización no sale de cuadrar
 * números entre dos ficheros: las páginas heredan el estado (`fuera`, `dentro`) de este
 * mismo envoltorio por el árbol de Motion. No hay dos relojes que mantener en hora.
 *
 * La salida sí lleva opacidad, y va entera de una pieza: lo que se va no necesita
 * articularse. Y es corta —155 ms— porque con `mode="wait"` la página nueva no se monta
 * hasta que la vieja termina, así que cada milisegundo de salida es un milisegundo de
 * espera después de pulsar. Ese es el sitio exacto donde una transición bonita se
 * convierte en una aplicación lenta.
 *
 * ## Por qué el muelle lateral es el del dock
 *
 * La entrada de lado usa `MUELLE.normal`, que es el mismo con el que el agua blanca viaja
 * entre iconos. No son dos animaciones parecidas: es la misma física. El indicador y la
 * página se mueven como si fueran una sola pieza, porque para quien mira lo son.
 *
 * La profundidad no usa muelle sino curva: un muelle sobre `scale` se pasa de frenada, y
 * una pantalla entera que rebota al llegar se lee como barata.
 *
 * ## Por qué aquí no hay desenfoque, a diferencia de todas las demás
 *
 * Porque esta variante envuelve páginas enteras, y dentro de una página hay cosas con
 * `position:fixed`: la barra del modo edición, el menú de un widget, el velón y la hoja de
 * una tarea.
 *
 * Un ancestro con `filter`, `transform` o `will-change` deja de ser transparente para
 * ellas: pasa a ser **su** bloque contenedor, y `inset:0` deja de significar la ventana
 * para significar la columna.
 *
 * Con `transform` se puede vivir porque Motion escribe `transform:none` en reposo
 * —comprobado en el navegador—, así que la trampa solo existe durante los milisegundos en
 * que no hay ninguna hoja abierta. Con `filter` no: el valor en reposo sería `blur(0px)`,
 * que no es `none` y crea el bloque contenedor para siempre.
 *
 * De ahí también que `dentro` deje cada valor en su identidad exacta —`x:0`, `scale:1`— y
 * no en un 0.999 que pasaría desapercibido: con cualquier otro número Motion escribe una
 * matriz y el envoltorio deja de ser transparente.
 */
export const PAGINA: Variants = {
  fuera: (v: Viaje = SIN_VIAJE) => {
    if (v.eje === 'lateral') return { opacity: 1, x: v.sentido * CRUZA, scale: 1 };
    if (v.eje === 'profundidad') return { opacity: 0, x: 0, scale: v.sentido === 1 ? LEJOS : CERCA };
    return { opacity: 0, x: 0, scale: 1 };
  },

  dentro: (v: Viaje = SIN_VIAJE) => ({
    opacity: 1,
    x: 0,
    scale: 1,
    transition:
      v.eje === 'lateral'
        ? { x: MUELLE.normal, opacity: { duration: 0 } }
        : { duration: TIEMPO.paso, ease: CURVA.salida },
  }),

  saliendo: (v: Viaje = SIN_VIAJE) => {
    const comun = { opacity: 0, transition: { duration: 0.155, ease: CURVA.fuera } };
    if (v.eje === 'lateral') return { ...comun, x: -v.sentido * APARTA, scale: 1 };
    if (v.eje === 'profundidad') return { ...comun, x: 0, scale: v.sentido === 1 ? CERCA : LEJOS };
    return { ...comun, x: 0, scale: 1 };
  },
};

/**
 * Una pieza de una página: la cabecera, la tira de la semana, el panel, la rejilla.
 *
 * Va siempre dentro de un contenedor con `ORQUESTA`, y no lleva `initial` ni `animate`
 * propios: hereda el estado del envoltorio de página por el árbol de Motion. Por eso está
 * sincronizada por construcción y no por haber acertado con los milisegundos.
 *
 * Aquí sí hay desenfoque, y no contradice lo de `PAGINA`: estas cajas no contienen nada
 * con `position:fixed` — las hojas modales y la barra del editor son hermanas de la
 * sección, no descendientes. Antes de poner `PIEZA` en una caja nueva, esa es la pregunta.
 *
 * **No tiene `saliendo` a propósito.** Al irse la página, sus partes se quedan quietas y
 * lo que se apaga es el bloque entero. Una página que se deshace por partes al salir hace
 * que irse dure más que llegar, y nadie quiere mirar cómo se va algo.
 */
export const PIEZA: Variants = {
  fuera: { opacity: 0, y: 12, filter: 'blur(5px)' },
  dentro: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: TIEMPO.paso, ease: CURVA.salida },
  },
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
