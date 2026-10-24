'use client';

/**
 * El marco de la aplicación: fondo, raíl y cabecera.
 *
 * Envuelve a las tres vistas. Como vive por encima de ellas, cambiar de vista no
 * reinicia el shader ni vuelve a cargar la fotografía.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Enfoque } from '@/components/Foco';
import * as m from 'motion/react-m';
import { AnimatePresence } from 'motion/react';
import { useState, type ReactNode } from 'react';

import { Fondo } from '@/components/Fondo';
import { Instalable } from '@/components/Instalable';
import { MenuCuenta } from '@/components/MenuCuenta';
import { Dock } from '@/components/Dock';
import { Button } from '@/components/ui/button';
import { useUI } from '@/lib/ui/contexto';
import { AVISO, MUELLE, PAGINA, SIN_VIAJE, TIEMPO, CURVA, viajeEntre, type Viaje } from '@/lib/ui/movimiento';
import { RutaCongelada } from '@/lib/ui/RutaCongelada';


/* La agenda del día NO está aquí a propósito: se entra desde el calendario semanal
   pulsando un día. Es una vista de detalle de la semana, no un destino propio, y tener
   las tres en el raíl obligaba a elegir entre dos pantallas que muestran lo mismo. */
const SECCIONES = [
  {
    href: '/',
    titulo: 'Escritorio',
    icono: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
  },
  {
    href: '/calendario',
    titulo: 'Calendario',
    /* La agenda de un día es una vista de detalle del calendario: mientras se está en
       ella el raíl sigue señalando aquí, en vez de quedarse sin nada marcado. */
    tambien: ['/dia'],
    icono: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M8 3v4M16 3v4M3 10h18M9 10v11M15 10v11" />
      </>
    ),
  },
  {
    href: '/horario',
    titulo: 'Horario de clases',
    /* Ya no lleva `tambien: ['/asignatura']`: la casa de una asignatura es la sección
       Asignaturas, que es la que existe para elegirla. Pulsar una clase sigue llevando a
       su asignatura, pero entonces lo que se enciende es Asignaturas, que es donde se ha
       ido — señalar Horario desde una pantalla que no cuelga de él era mentira. */
    /* un reloj: el horario responde a "a qué hora", no a "qué día" — esa es la del
       calendario, y con dos rejillas seguidas en el raíl no se distinguirían */
    icono: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5.2l3.4 2" />
      </>
    ),
  },
  {
    href: '/asignaturas',
    titulo: 'Asignaturas',
    /* La página de una asignatura es su detalle: mientras se está dentro, el dock sigue
       señalando aquí. Por prefijo, así que `/asignatura/geometria` también la enciende. */
    tambien: ['/asignatura'],
    /* Tres libros sobre una balda, y el tercero apoyado en los otros.
       Esa inclinación no es un adorno: con los tres de pie el icono se leía como un
       gráfico de barras —tres rectángulos sobre una línea son barras, y no hay grosor
       desigual que lo arregle—. Un libro ladeado no se parece a ningún gráfico.
       El giro va en el atributo del SVG, que es suyo y no el `transform` que Motion
       escribe en el botón de fuera. */
    icono: (
      <>
        <rect x="2.9" y="7" width="5.5" height="12" rx="1.2" />
        <rect x="10.1" y="4.6" width="3.8" height="14.4" rx="1.2" />
        <rect x="14.9" y="8" width="4" height="11" rx="1.2" transform="rotate(12 14.9 19)" />
        <path d="M2.2 21.1h19.6" />
      </>
    ),
  },
  {
    href: '/metodos',
    titulo: 'Métodos de estudio',
    /* un reloj de arena: lo que mide el pomodoro es tiempo que pasa, no una hora del día
       —esa ya es el reloj del horario— y con dos relojes seguidos en el raíl no se
       distinguirían */
    icono: (
      <>
        <path d="M6.5 3h11M6.5 21h11" />
        <path d="M7.5 3v3.2c0 2 1.6 3.4 3 4.4 1 .7 1 1.1 0 1.8-1.4 1-3 2.4-3 4.4V21" />
        <path d="M16.5 3v3.2c0 2-1.6 3.4-3 4.4-1 .7-1 1.1 0 1.8 1.4 1 3 2.4 3 4.4V21" />
      </>
    ),
  },
];

/**
 * El lápiz de edición, en dos capas.
 *
 * `HUECO` es el sitio que ocupa y `LAPIZ` es el botón dentro de él. Separarlos no es
 * ceremonia: si el botón se encogiera a sí mismo hasta cero, su medida la escribiría
 * Motion en línea y pisaría los 44 px que la hoja de estilos le da en pantalla táctil.
 * Así el botón conserva siempre la suya y lo que se cierra es el hueco.
 *
 * `width: 'auto'` en vez de un número por lo mismo: Motion mide la caja real, de modo
 * que el gesto sigue siendo correcto cuando esa caja mide 44 y no 34.
 *
 * El lápiz gira al entrar y al salir porque es una herramienta que se recoge, no un
 * panel que se apaga. El `y` del roce del ratón vive también aquí y no en el CSS: una
 * propiedad la controla Motion o la controla CSS, nunca las dos.
 */
const HUECO = {
  fuera: { width: 0, marginRight: -7 },
  dentro: { width: 'auto', marginRight: 0, transition: MUELLE.normal },
  saliendo: { width: 0, marginRight: -7, transition: { duration: TIEMPO.roce, ease: CURVA.fuera } },
};

const LAPIZ = {
  fuera: { opacity: 0, scale: 0.8, rotate: -12 },
  dentro: { opacity: 1, scale: 1, rotate: 0, transition: { ...MUELLE.normal, delay: 0.06 } },
  saliendo: { opacity: 0, scale: 0.85, rotate: 10, transition: { duration: 0.14, ease: CURVA.fuera } },
};

export function Marco({ children }: { children: ReactNode }) {
  const ruta = usePathname();

  /**
   * De dónde se viene, que es lo único que la transición necesita saber.
   *
   * Se calcula **durante el render** y no en un efecto, a propósito: `AnimatePresence`
   * arranca la salida en el mismo render en que la ruta cambia, así que un efecto llegaría
   * un fotograma tarde y el primer viaje de cada navegación saldría con la dirección del
   * anterior. Ajustar estado durante el render comparando con el valor guardado es el
   * patrón que React documenta justo para esto: no pinta el resultado intermedio, lo
   * vuelve a renderizar antes de llegar a la pantalla.
   */
  const [rumbo, setRumbo] = useState<{ ruta: string; viaje: Viaje }>(() => ({ ruta, viaje: SIN_VIAJE }));
  if (rumbo.ruta !== ruta) setRumbo({ ruta, viaje: viajeEntre(rumbo.ruta, ruta) });
  const { editando, setEditando, onda, aviso, mandoFondo } = useUI();

  /* La pantalla de acceso no lleva chrome: ni raíl ni cabecera. Todavía no se está
     dentro de nada, así que ofrecer navegación sería enseñar puertas de una casa en la
     que aún no se ha entrado. El fondo sí se queda: es lo que la hace reconocible. */
  const desnuda = ruta === '/entrar';

  if (desnuda) {
    return (
      <>
        <Fondo editando={false} mandoRef={mandoFondo} />
        {children}
      </>
    );
  }

  return (
    <>
      <Fondo editando={editando} mandoRef={mandoFondo} />

      <div className="app">
        <Dock secciones={SECCIONES} ruta={ruta} />

        <div className="body">
          <header className="topbar rise">
            {/* El saludo vive en el widget de bienvenida del escritorio, que es donde
                tiene sentido. Repetirlo en la cabecera de todas las paginas lo convertia
                en ruido: se lee una vez al entrar y estorba las otras veinte. */}
            {/* El logo lleva al escritorio.
                Era un `span` con `aria-hidden`: ni se podía pulsar ni existía para un lector
                de pantalla. Que la marca de una aplicación vuelva al principio es lo que
                todo el mundo intenta sin pensarlo, y no hacer nada al pulsarla se lee como
                que la página está medio rota. */}
            <Link href="/" className="marca" prefetch aria-label="Ir al escritorio">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 20 12 4l9 16" />
                <path d="M7.5 20 12 11l4.5 9" />
              </svg>
              <b>Archicel</b>
            </Link>
            <span className="hueco" />
            <div className="tools">
              {/* Solo se pinta cuando el navegador ofrece instalar; el resto del tiempo
                  no devuelve nada y la cabecera queda como estaba. */}
              <Instalable />
              {/* El foco, solo en el escritorio y con la misma salida que el lápiz: dos
                  cosas que aparecen al lado del avatar en cada viaje, y una de ellas sin
                  animar se leería como un parpadeo y no como un botón que se va. */}
              <AnimatePresence>
                {ruta === '/' && (
                  <m.div key="foco" className="lapiz-hueco" variants={HUECO} initial="fuera" animate="dentro" exit="saliendo">
                    <Enfoque />
                  </m.div>
                )}
              </AnimatePresence>
              {/* El lápiz solo existe en el escritorio, así que aparece y desaparece en
                  cada viaje entre secciones — dos veces por navegación, justo al lado
                  del avatar, que no se mueve. Sin salida se lee como un parpadeo del
                  avatar, no como un botón que se va. */}
              <AnimatePresence>
                {ruta === '/' && (
                  <m.div
                    key="lapiz"
                    className="lapiz-hueco"
                    variants={HUECO}
                    initial="fuera"
                    animate="dentro"
                    exit="saliendo"
                  >
                    <m.button
                      className={`icon-btn${editando ? ' is-on' : ''}`}
                      type="button"
                      aria-pressed={editando}
                      aria-label="Editar el escritorio"
                      variants={LAPIZ}
                      whileHover={{ y: -2, transition: MUELLE.vivo }}
                      whileTap={{ y: 0, scale: 0.94, transition: MUELLE.vivo }}
                      onClick={(e) => {
                        onda(e.clientX, e.clientY);
                        setEditando(!editando);
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </m.button>
                  </m.div>
                )}
              </AnimatePresence>
              <MenuCuenta />
            </div>
          </header>

          {/*
            El cambio de sección.

            Antes las páginas se cambiaban de golpe: el App Router desmonta una y monta la
            otra en el mismo fotograma, y todo el trabajo del dock —el agua viajando de un
            icono a otro con su muelle— ocurría al lado de un corte seco.

            Ahora la página viaja **en la misma dirección que el agua**: hacia la derecha si
            la sección nueva está a la derecha en el dock, hacia dentro si es el detalle de
            la que se deja. Esa es toda la idea, y es la razón de que `viajeEntre` viva
            junto al orden de las secciones y no aquí.

            `custom` va en los dos sitios. En el `m.div` para la entrada, y **también en el
            `AnimatePresence`** para la salida: la página que se va ya no se está
            renderizando, así que sin esto se quedaría con el `custom` de cuando llegó y
            saldría hacia el lado del viaje anterior. Es el fallo que no se ve hasta que se
            navega tres veces seguidas.

            `mode="wait"` porque las dos páginas ocupan el mismo hueco: solapándolas, la que
            entra empuja a la que sale y la columna da un salto de alto.
          */}
          {/*
            Sin `initial={false}`, y el motivo cuesta encontrarlo: esa propiedad no se
            queda en la página, **se propaga a todo lo que lleva dentro** y anula la
            animación de montaje de cada descendiente en la primera carga. Con ella puesta,
            el escritorio aparecía de golpe —sus bloques nacían ya en `opacity:1`, sin
            posarse— y lo mismo las piezas de las demás pantallas. Se veía comparando con
            el plato del dock, que está fuera de aquí y sí se animaba.

            Lo que esa propiedad evitaba —que la página entrara viajando recién abierta la
            aplicación— lo resuelve ahora el propio viaje: en la primera carga no hay de
            dónde venir, el viaje es `quieto` y su estado de partida es el de reposo.
          */}
          <AnimatePresence mode="wait" custom={rumbo.viaje}>
            <m.div
              key={ruta}
              className="pagina"
              variants={PAGINA}
              custom={rumbo.viaje}
              initial="fuera"
              animate="dentro"
              exit="saliendo"
            >
              {/* Cada envoltorio se queda con el contenido que tenía al montarse. Sin
                  esto, el router mete la página nueva dentro del envoltorio que está
                  saliendo, y el mismo contenido se anima dos veces: una al salir y otra
                  al entrar. El porqué, entero, en `RutaCongelada`. */}
              <RutaCongelada>{children}</RutaCongelada>
            </m.div>
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {aviso && (
          <m.div key="aviso" className="toast" role="status" aria-live="polite"
            variants={AVISO} initial="fuera" animate="dentro" exit="saliendo">
            {aviso}
          </m.div>
        )}
      </AnimatePresence>
    </>
  );
}
