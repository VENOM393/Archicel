'use client';

/**
 * El dock de secciones, con la magnificación de macOS.
 *
 * Es la receta de [Build UI](https://buildui.com/recipes/magnified-dock), la misma que
 * usan Magic UI y Aceternity: se guarda la X del cursor en un `MotionValue`, cada icono
 * calcula su distancia al puntero, esa distancia se mapea a una escala y el resultado pasa
 * por un muelle.
 *
 * Lo importante del `MotionValue` es que **no es estado de React**. Mover el ratón sobre
 * el dock actualiza un valor que Motion escribe directamente en el DOM: cero renderizados
 * mientras el cursor viaja. Es la diferencia entre un dock que responde y uno que se
 * atasca cuando la aplicación está haciendo otra cosa.
 *
 * ## Lo que se cambió de la receta original
 *
 * **La escala.** El original usa 2.25, pensada para docks de ocho o diez iconos pequeños.
 * Aquí hay tres y grandes: a 2.25 sería una caricatura. Se queda en 1.5.
 *
 * **El tamaño se anima, no la escala** — y esto se salta la regla general de animar solo
 * transformaciones, así que hay que justificarlo. Con `scale`, el borde de 1 px pasa a
 * 1,5 y el radio de 17 px a 25: el icono no crece, se deforma. Con `width`/`height` el
 * material se queda como es. El coste de recalcular la maquetación está acotado a
 * propósito: son **tres** elementos, en una fila `position:fixed` que no tiene nada
 * debajo a lo que empujar, y a cambio los vecinos se apartan solos —los coloca el flex—
 * en vez de repartirlos a mano cada fotograma.
 *
 * **Se ancla abajo.** `align-items: flex-end` en el plato: el icono crece hacia arriba,
 * apoyado en el suelo del dock, como en macOS. Sin eso crece hacia los dos lados y se ve
 * flotar.
 */

import Link from 'next/link';
import * as m from 'motion/react-m';
import { useMotionValue, useSpring, useTransform, type MotionValue } from 'motion/react';
import { useRef } from 'react';

import { MUELLE } from '@/lib/ui/movimiento';

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

/* ── Los números del dock ── */
const BASE = 56;
const MAXIMO = 84;   // 1.5 veces la base
const ALCANCE = 110; // el DISTANCE de la receta

export function Dock({ secciones, ruta }: { secciones: Seccion[]; ruta: string }) {
  /* Infinito en reposo: así la distancia de todos es infinita y nadie crece. */
  const raton = useMotionValue(Number.POSITIVE_INFINITY);

  return (
    <nav className="dock" aria-label="Secciones">
      <div
        className="dock-plato"
        onPointerMove={(e) => {
          if (e.pointerType !== 'touch') raton.set(e.clientX);
        }}
        onPointerLeave={() => raton.set(Number.POSITIVE_INFINITY)}
      >
        {secciones.map((s) => (
          <Icono key={s.href} seccion={s} raton={raton} activa={estaActiva(s, ruta)} />
        ))}
      </div>
    </nav>
  );
}

function Icono({ seccion, raton, activa }: { seccion: Seccion; raton: MotionValue<number>; activa: boolean }) {
  const caja = useRef<HTMLDivElement>(null);

  /**
   * La distancia del cursor al centro de este icono.
   *
   * Se mide en cada lectura y no una sola vez: el centro se mueve cuando crecen los
   * vecinos, y con un valor cacheado la magnificación se desincroniza del cursor en cuanto
   * empieza el movimiento — se nota como un tirón al entrar por un lado.
   */
  const distancia = useTransform(raton, (x) => {
    const b = caja.current?.getBoundingClientRect();
    if (!b) return Number.POSITIVE_INFINITY;
    return x - b.left - b.width / 2;
  });

  const crudo = useTransform(distancia, [-ALCANCE, 0, ALCANCE], [BASE, MAXIMO, BASE], { clamp: true });
  const lado = useSpring(crudo, MUELLE.vivo);

  return (
    /* El `Link` de Next se queda por fuera y sin animar: es quien precarga la ruta y quien
       lleva la semántica del enlace. Lo que crece es la caja de dentro. Componerlos así
       —en vez de convertir el Link en componente animado— evita depender de APIs
       obsoletas y deja el `aria` donde el lector de pantalla lo espera. */
    <Link
      href={seccion.href}
      prefetch
      className="dock-enlace"
      aria-label={seccion.titulo}
      aria-current={activa ? 'page' : undefined}
    >
      {/* `m.div` y no `motion.div`: el proveedor va en modo estricto con las funciones
          cargadas aparte, y el componente pesado rompería ese ahorro. */}
      <m.div
        ref={caja}
        style={{ width: lado, height: lado }}
        className="dock-btn"
        whileTap={{ scale: 0.93, transition: MUELLE.vivo }}
      >
        <span className="dock-agua" aria-hidden="true" />
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
        <span className="dock-punto" aria-hidden="true" />
      </m.div>
      <span className="dock-nombre" aria-hidden="true">
        {seccion.titulo}
      </span>
    </Link>
  );
}
