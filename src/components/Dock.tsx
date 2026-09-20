'use client';

/**
 * El dock de secciones.
 *
 * Dos comportamientos, y cada uno resuelto con la herramienta de Motion que le
 * corresponde. Mezclarlos —o resolver uno a mano— es lo que daba problemas antes.
 *
 * ## 1 · La magnificación: `MotionValue`
 *
 * La receta de [Build UI](https://buildui.com/recipes/magnified-dock): se guarda la X del
 * cursor, cada icono mide su distancia a ella y esa distancia se mapea a un tamaño que
 * pasa por un muelle.
 *
 * Lo que hace que valga la pena es que un `MotionValue` **no es estado de React**. El
 * cursor cruzando el dock actualiza un valor que Motion escribe directo en el DOM: cero
 * renderizados. Con `useState` serían sesenta por segundo, y se notaría en cuanto la
 * aplicación estuviera haciendo cualquier otra cosa.
 *
 * ## 2 · El activo: `layoutId`
 *
 * Aquí está el cambio grande. Antes había una gota con su posición, su velocidad, su
 * muelle y una medición por fotograma para saber dónde caer. Todo eso lo sustituye una
 * palabra: el agua blanca lleva `layoutId`, y **solo se dibuja en la sección activa**.
 * Cuando cambia cuál es la activa, Motion ve el mismo `layoutId` en otro sitio y la lleva
 * de uno a otro él solo.
 *
 * No es un atajo: es más correcto. La posición ya no se calcula, se **deduce** del DOM
 * real, así que no hay forma de que el indicador y el icono se desincronicen — que es
 * justo el fallo que aparecía al medir en mitad de una animación.
 *
 * ## Por qué se anima el tamaño y no la escala
 *
 * Es lo contrario de la regla general, así que hay que defenderlo: con `scale`, el borde
 * de 1 px pasa a 1,5 y el radio de 17 px a 25 — el icono no crece, se deforma. El coste de
 * tocar la maquetación está acotado a propósito: son **tres** elementos, en una fila
 * `position:fixed` que no tiene nada debajo a lo que empujar, y a cambio los vecinos se
 * apartan solos porque los coloca el flex.
 */

import Link from 'next/link';
import * as m from 'motion/react-m';
import { AnimatePresence, useMotionTemplate, useMotionValue, useSpring, useTransform, type MotionValue } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

import { MUELLE, TIEMPO, CURVA } from '@/lib/ui/movimiento';

export interface Seccion {
  href: string;
  titulo: string;
  icono: React.ReactNode;
  /** Rutas que son detalle de esta sección y la mantienen señalada. */
  tambien?: string[];
}

function estaActiva(s: Seccion, ruta: string): boolean {
  return ruta === s.href || (s.tambien?.includes(ruta) ?? false);
}

/* ── Los números del dock ──
   Un solo número manda: el lado del cuadrado. El radio de la esquina y el tamaño del
   glifo salen de él en la hoja de estilos, con la proporción que tienen en reposo —17/56
   y 24/56—, así que el icono crece exactamente lo mismo que su caja.

   Antes el SVG estaba clavado en 24 px: el cuadrado pasaba de 56 a 84 y el dibujo de
   dentro se quedaba igual, flotando en un hueco cada vez mayor. Se veía sobre todo en el
   activo, que es el que más rato está grande. */
const BASE = 56;
const BASE_ESTRECHO = 48; // en pantalla de móvil el plato entero es más pequeño
const CRECE = 1.5; // cuánto crece el que tiene el cursor encima
const ALCANCE = 110; // el DISTANCE de la receta de Build UI

/**
 * El lado en reposo, que no es el mismo en el móvil.
 *
 * Tiene que vivir aquí y no en un `@media` porque Motion escribe el lado en línea y el
 * estilo en línea gana a cualquier regla de la hoja: la media query que ponía 48 px no
 * llegaba a aplicarse nunca. Es el mismo error de siempre —una medida con dos dueños— y
 * la salida es la misma: que la tenga uno solo.
 */
function useLadoBase() {
  /* En el servidor no hay ventana: se arranca en la medida de escritorio, que es la que
     el CSS pinta antes de hidratar, y se corrige en cuanto hay DOM. */
  const [base, setBase] = useState(BASE);

  useEffect(() => {
    const consulta = window.matchMedia('(max-width: 700px)');
    const leer = () => setBase(consulta.matches ? BASE_ESTRECHO : BASE);
    leer();
    consulta.addEventListener('change', leer);
    return () => consulta.removeEventListener('change', leer);
  }, []);

  return base;
}

/* Fuera del render: un objeto nuevo en cada pasada obligaría a Motion a recalcular. */
/* El `-50%` del centrado viaja dentro de la variante y no en el CSS: Motion escribe su
   propio `transform` y pisaría cualquiera que pusiera la hoja de estilos. La regla vale
   para todo el proyecto — una propiedad la controla CSS o la controla Motion, nunca las
   dos, y cuando las dos tocan `transform` gana la última y se pierde el centrado. */
const ROTULO = {
  fuera: { opacity: 0, x: '-50%', y: 6, scale: 0.94 },
  dentro: { opacity: 1, x: '-50%', y: 0, scale: 1, transition: { duration: TIEMPO.roce, ease: CURVA.salida } },
  saliendo: { opacity: 0, x: '-50%', y: 4, scale: 0.96, transition: { duration: 0.14, ease: CURVA.fuera } },
};

export function Dock({ secciones, ruta }: { secciones: Seccion[]; ruta: string }) {
  /* Infinito en reposo: la distancia de todos es infinita y nadie crece. */
  const raton = useMotionValue(Number.POSITIVE_INFINITY);
  const base = useLadoBase();

  return (
    <nav className="dock" aria-label="Secciones">
      <m.div
        className="dock-plato"
        initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ ...MUELLE.denso, delay: 0.25 }}
        onPointerMove={(e) => {
          if (e.pointerType !== 'touch') raton.set(e.clientX);
        }}
        onPointerLeave={() => raton.set(Number.POSITIVE_INFINITY)}
      >
        {/* La `key` lleva el lado a propósito: al cruzar el ancho de móvil los iconos se
            rehacen en vez de quedarse con la medida vieja dentro de su muelle. Pasa una vez
            al girar el teléfono, y remontar tres nodos es más barato y mucho más predecible
            que reconstruir una cadena de valores animados. */}
        {secciones.map((s) => (
          <Icono key={`${s.href}-${base}`} seccion={s} raton={raton} base={base} activa={estaActiva(s, ruta)} />
        ))}
      </m.div>
    </nav>
  );
}

function Icono({
  seccion,
  raton,
  base,
  activa,
}: {
  seccion: Seccion;
  raton: MotionValue<number>;
  base: number;
  activa: boolean;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const [encima, setEncima] = useState(false);

  /**
   * La distancia del cursor al centro de este icono.
   *
   * Se mide en cada lectura y no una sola vez: el centro se mueve cuando crecen los
   * vecinos. Con un valor cacheado, la magnificación se desincroniza del cursor en cuanto
   * empieza el movimiento, y se nota como un tirón al entrar por un lado.
   */
  const distancia = useTransform(raton, (x) => {
    const b = caja.current?.getBoundingClientRect();
    return b ? x - b.left - b.width / 2 : Number.POSITIVE_INFINITY;
  });

  const crudo = useTransform(distancia, [-ALCANCE, 0, ALCANCE], [base, base * CRECE, base], { clamp: true });
  const lado = useSpring(crudo, MUELLE.vivo);

  /**
   * El lado sale a la hoja de estilos como `--lado`, en píxeles, y no como `width`.
   *
   * De esa variable cuelgan el ancho, el alto, el radio de la esquina y el tamaño del
   * glifo, todos con `calc()`. Así la proporción está escrita una sola vez y en un sitio,
   * y crecer no puede deformar nada: no hay forma de que la caja aumente y el dibujo se
   * quede quieto, que es exactamente lo que pasaba con el SVG fijo en 24 px.
   *
   * Y sigue sin ser un `scale`, que sería más barato: con `scale` el borde de 1 px pasaría
   * a 1,5 y se vería el pixelado del texto. Son tres elementos en una fila `fixed` que no
   * tiene nada debajo a lo que empujar, así que el coste de tocar la maquetación está
   * acotado a propósito.
   */
  const ladoPx = useMotionTemplate`${lado}px`;

  return (
    /* El `Link` de Next queda fuera y sin animar: es quien precarga la ruta y quien lleva
       la semántica. Lo que crece es la caja de dentro. Componerlos así evita convertir el
       Link en componente animado y deja el `aria` donde el lector de pantalla lo espera. */
    <Link
      href={seccion.href}
      prefetch
      className="dock-enlace"
      aria-label={seccion.titulo}
      aria-current={activa ? 'page' : undefined}
      onPointerEnter={() => setEncima(true)}
      onPointerLeave={() => setEncima(false)}
      onBlur={() => setEncima(false)}
      onFocus={() => setEncima(true)}
    >
      <m.div
        ref={caja}
        style={{ ['--lado' as string]: ladoPx }}
        className="dock-btn"
        whileTap={{ scale: 0.93, transition: MUELLE.vivo }}
      >
        {/*
          El agua solo existe en la activa. Al cambiar de sección, Motion encuentra el
          mismo `layoutId` en otro icono y la lleva de uno a otro: el indicador viaja sin
          que nadie calcule su posición.
        */}
        {activa && (
          <m.span
            layoutId="dock-agua"
            className="dock-agua"
            transition={MUELLE.normal}
            aria-hidden="true"
          />
        )}
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {seccion.icono}
        </svg>
        {activa && (
          <m.span layoutId="dock-punto" className="dock-punto" transition={MUELLE.normal} aria-hidden="true" />
        )}
      </m.div>

      {/* El rótulo aparece y desaparece de verdad: con CSS solo se desvanecía, y al salir
          del dock se quedaba ocupando sitio sin que se viera. */}
      <AnimatePresence>
        {encima && (
          <m.span
            key="rotulo"
            className="dock-nombre"
            variants={ROTULO}
            initial="fuera"
            animate="dentro"
            exit="saliendo"
            aria-hidden="true"
          >
            {seccion.titulo}
          </m.span>
        )}
      </AnimatePresence>
    </Link>
  );
}
