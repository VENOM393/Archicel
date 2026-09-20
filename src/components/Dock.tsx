'use client';

/**
 * El dock de secciones.
 *
 * Copia el comportamiento del dock de macOS, que es el que popularizaron
 * [Build UI](https://buildui.com/recipes/magnified-dock) y Magic UI: se mide la distancia
 * del cursor al centro de cada icono, esa distancia se mapea al tamaño con una caída
 * suave, y el resultado pasa por un muelle. El icono bajo el puntero crece, sus vecinos
 * crecen menos, y el resto se queda quieto.
 *
 * ## Lo que cambia respecto a la receta original
 *
 * **La escala.** La receta usa 2.25, pensada para un dock de ocho o diez iconos pequeños.
 * Aquí hay tres y grandes: a 2.25 se convertiría en una caricatura. Se queda en 1.5, que
 * es lo que se nota sin dar risa.
 *
 * **El empujón lateral.** La receta lo aproxima con un desplazamiento fijo. Aquí se
 * calcula de verdad: cada fotograma se reparten los anchos ya escalados a lo largo de la
 * fila y cada icono va a donde le toca. Sale gratis y no hay forma de que se solapen ni
 * de que la fila se descentre, que es justo lo que pasaba antes.
 *
 * **Sin Framer Motion.** No es dependencia del proyecto, y el muelle son ocho líneas. Todo
 * ocurre en un `requestAnimationFrame` escribiendo `transform` directamente: mover el
 * ratón sobre el dock no provoca ni un renderizado de React.
 *
 * ## El activo
 *
 * No se eleva. Antes subía siete píxeles y se salía de la fila — parecía despegado, no
 * seleccionado. Ahora lo marca el relleno: el agua blanca del proyecto, con su brillo y su
 * cónico girando, detrás del icono; y un punto debajo, como en macOS. El icono baja a
 * tinta oscura porque encima de blanco es lo único que se lee.
 */

import Link from 'next/link';
import { useCallback, useEffect, useRef } from 'react';

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
const BASE = 56;      // lado del icono en reposo
const ESCALA = 1.5;   // cuánto crece el que está bajo el cursor
const ALCANCE = 110;  // a partir de aquí ya no crece (el DISTANCE de la receta)
const HUECO = 12;     // separación en reposo

/* El muelle de la receta, tal cual. */
const MASA = 0.1;
const RIGIDEZ = 170;
const AMORTIGUACION = 12;

/**
 * Un paso del muelle, integrado a mano (Euler semiimplícito).
 *
 * Es lo único que hace falta de Framer Motion aquí. Lo que no es opcional es **subdividir
 * el paso**: con masa 0.1 y amortiguación 12, el término de rozamiento avanza `c·dt/m` por
 * fotograma, que a 60 Hz vale 4 — y por encima de 2 la integración explícita diverge en
 * vez de frenar. Probado: los iconos se iban a dieciséis mil píxeles de ancho en tres
 * fotogramas. Con pasos internos de 1/240 s el factor baja a 0.5 y el muelle se comporta.
 */
const PASO = 1 / 240;

function muelle(x: number, v: number, objetivo: number, dt: number): [number, number] {
  const n = Math.max(1, Math.ceil(dt / PASO));
  const h = dt / n;
  let px = x;
  let pv = v;
  for (let i = 0; i < n; i++) {
    const a = (-RIGIDEZ * (px - objetivo) - AMORTIGUACION * pv) / MASA;
    pv += a * h;
    px += pv * h;
  }
  return [px, pv];
}

interface Pieza {
  nodo: HTMLElement;
  centro: number;   // su centro en reposo, medido desde el borde del plato
  f: number;        // escala actual
  vf: number;       // velocidad de la escala
  x: number;        // desplazamiento lateral actual
  vx: number;
}

export function Dock({ secciones, ruta }: { secciones: Seccion[]; ruta: string }) {
  const plato = useRef<HTMLDivElement>(null);
  const piezas = useRef<Pieza[]>([]);
  const raton = useRef(Number.POSITIVE_INFINITY);
  const bucle = useRef(0);

  /** Mide los centros en reposo. Hay que rehacerlo si cambia el tamaño o el catálogo. */
  const medir = useCallback(() => {
    const caja = plato.current;
    if (!caja) return;
    const r = caja.getBoundingClientRect();
    piezas.current = [...caja.querySelectorAll<HTMLElement>('.dock-btn')].map((nodo, i) => {
      const anterior = piezas.current[i];
      const b = nodo.getBoundingClientRect();
      return {
        nodo,
        /* Con la escala aplicada el rectángulo miente, así que el centro en reposo se
           reconstruye del ancho base y no de lo medido. */
        centro: b.left - r.left + BASE / 2 - (anterior?.x ?? 0),
        f: anterior?.f ?? 1,
        vf: anterior?.vf ?? 0,
        x: anterior?.x ?? 0,
        vx: anterior?.vx ?? 0,
      };
    });
  }, []);

  useEffect(() => {
    medir();
    const t = setTimeout(medir, 120);
    window.addEventListener('resize', medir);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', medir);
    };
  }, [medir, secciones.length]);

  useEffect(() => {
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let anterior = performance.now();

    const paso = (ahora: number) => {
      bucle.current = requestAnimationFrame(paso);
      /* El paso se acota: al volver de una pestaña oculta llega un salto de segundos y un
         muelle integrado con ese dt sale disparado. */
      const dt = Math.min((ahora - anterior) / 1000, 1 / 30);
      anterior = ahora;

      const lista = piezas.current;
      if (lista.length === 0) return;
      const m = raton.current;

      /* 1 · el objetivo de cada uno, por distancia al cursor */
      let total = 0;
      const objetivo = lista.map((p) => {
        const d = Math.abs(m - p.centro);
        const cerca = Math.max(0, 1 - d / ALCANCE);
        /* Caída suavizada: lineal deja una esquina al entrar y al salir del alcance. */
        const suave = cerca * cerca * (3 - 2 * cerca);
        const f = 1 + (ESCALA - 1) * suave;
        total += BASE * f;
        return f;
      });
      total += HUECO * (lista.length - 1);

      /* 2 · dónde cae cada uno repartiendo los anchos ya crecidos, sin solapes */
      const anchoBase = BASE * lista.length + HUECO * (lista.length - 1);
      let cursor = (anchoBase - total) / 2;
      const destino = lista.map((_, i) => {
        const c = cursor + (BASE * objetivo[i]) / 2;
        cursor += BASE * objetivo[i] + HUECO;
        return c;
      });

      /* 3 · el muelle, y a escribir */
      lista.forEach((p, i) => {
        if (quieto) {
          p.f = objetivo[i];
          p.x = destino[i] - p.centro;
        } else {
          [p.f, p.vf] = muelle(p.f, p.vf, objetivo[i], dt);
          [p.x, p.vx] = muelle(p.x, p.vx, destino[i] - p.centro, dt);
        }
        p.nodo.style.transform = `translateX(${p.x.toFixed(2)}px) scale(${p.f.toFixed(3)})`;
      });
    };

    bucle.current = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(bucle.current);
  }, []);

  const seguir = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    const caja = plato.current;
    if (!caja) return;
    raton.current = e.clientX - caja.getBoundingClientRect().left;
  };

  return (
    <nav className="dock" aria-label="Secciones">
      <div
        className="dock-plato"
        ref={plato}
        onPointerMove={seguir}
        onPointerLeave={() => {
          raton.current = Number.POSITIVE_INFINITY;
        }}
      >
        {secciones.map((s) => {
          const activa = estaActiva(s, ruta);
          return (
            <Link
              key={s.href}
              href={s.href}
              /* Son tres y están siempre en pantalla: precargarlas convierte el salto
                 entre secciones en instantáneo. */
              prefetch
              className="dock-btn"
              aria-label={s.titulo}
              aria-current={activa ? 'page' : undefined}
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
                {s.icono}
              </svg>
              <span className="dock-nombre" aria-hidden="true">
                {s.titulo}
              </span>
              <span className="dock-punto" aria-hidden="true" />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
