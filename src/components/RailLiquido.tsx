'use client';

/**
 * El raíl de secciones, con el indicador líquido.
 *
 * El efecto se llama *gooey* (o metaball): dos formas que al acercarse se funden con un
 * cuello, como dos gotas de agua. Se consigue con un filtro SVG —desenfoque fuerte y
 * después un contraste brutal sobre el canal alfa— que convierte los bordes difuminados
 * en un contorno nítido y orgánico. Es lo que hace que el borde del raíl se abombe
 * alrededor del icono activo en vez de ser una línea recta.
 *
 * El truco para que parezca agua y no un rectángulo que se desliza son **dos gotas a
 * distinta velocidad**: la rápida sale disparada hacia el destino y la lenta se queda
 * atrás. Mientras viajan están separadas, el filtro las une con un hilo que se estira, y
 * al llegar se funden otra vez en una. Ese estirón es toda la ilusión; con una sola gota
 * el movimiento se lee como un bloque que resbala.
 *
 * Dos capas, y el orden importa:
 *
 *   1 · `.rail-fluido`  una burbuja por sección más las gotas, todas bajo el filtro. De
 *                       aquí sale el cuerpo y la fusión. No recibe puntero.
 *   2 · los enlaces, encima y sin filtro, cada uno con su propio `backdrop-filter`: el
 *                       cristal de verdad vive aquí, porque el desenfoque de fondo no
 *                       sobrevive dentro de un filtro SVG, y un icono pasado por un gooey
 *                       se vuelve una mancha.
 */

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface Seccion {
  href: string;
  titulo: string;
  icono: React.ReactNode;
  /** Rutas que son detalle de esta sección y la mantienen señalada. */
  tambien?: string[];
}

/** Una sección está activa en su propia ruta y en las que declara como suyas. */
function estaActiva(s: Seccion, ruta: string): boolean {
  return ruta === s.href || (s.tambien?.includes(ruta) ?? false);
}

/** Dónde está una gota: a lo largo del raíl (`pos`) y si debe verse. */
interface Gota {
  pos: number;
  visible: boolean;
}

/**
 * Dónde se quedó el líquido la última vez, fuera del ciclo de vida de React.
 *
 * Cambiar de sección remonta este componente, así que sin esto las gotas nacerían ya en
 * su destino y no habría viaje: la transición de CSS necesita un valor anterior del que
 * partir. Guardando la posición en el módulo, el primer render la pinta donde estaba y
 * el efecto la manda a la nueva, que es lo que dispara el estirón.
 */
const memoria: { pos: number; visto: boolean } = { pos: 0, visto: false };

export function RailLiquido({ secciones, ruta }: { secciones: Seccion[]; ruta: string }) {
  const caja = useRef<HTMLElement>(null);
  const nucleo = useRef<HTMLDivElement>(null);
  const rapida = useRef<HTMLSpanElement>(null);
  const lenta = useRef<HTMLSpanElement>(null);
  /* desde donde sale el liquido la proxima vez que se mueva */
  const desde = useRef(memoria.pos);
  const [activa, setActiva] = useState<Gota>({ pos: memoria.pos, visible: memoria.visto });
  const [roce, setRoce] = useState<Gota>({ pos: 0, visible: false });
  /* el centro de cada burbuja, para que el líquido las funda al pasar entre ellas */
  const [burbujas, setBurbujas] = useState<number[]>([]);
  /* en móvil el raíl es una barra superior: las gotas se mueven en X, no en Y */
  const [horizontal, setHorizontal] = useState(false);

  /** El centro del enlace activo, medido en el eje que corresponda. */
  const medir = useCallback(() => {
    const nodo = nucleo.current;
    if (!nodo) return;
    const filaAncha = nodo.clientWidth > nodo.clientHeight;
    setHorizontal(filaAncha);
    const c0 = nodo.getBoundingClientRect();
    setBurbujas(
      [...nodo.querySelectorAll<HTMLElement>('.nav-btn')].map((el) => {
        const b = el.getBoundingClientRect();
        return filaAncha ? b.left - c0.left + b.width / 2 : b.top - c0.top + b.height / 2;
      }),
    );
    const activo = nodo.querySelector<HTMLElement>('[aria-current="page"]');
    if (!activo) {
      setActiva((g) => ({ ...g, visible: false }));
      return;
    }
    const r = activo.getBoundingClientRect();
    const c = nodo.getBoundingClientRect();
    const pos = filaAncha ? r.left - c.left + r.width / 2 : r.top - c.top + r.height / 2;
    memoria.pos = pos;
    memoria.visto = true;
    setActiva({ pos, visible: true });
  }, []);

  useEffect(() => {
    /**
     * Se mide dos veces a propósito.
     *
     * La primera en el fotograma siguiente al montaje: el navegador ya ha pintado la gota
     * donde estaba, así que al cambiarla de sitio hay un valor anterior del que partir y
     * la transición se dispara. Medir en el mismo fotograma la dejaría en su destino sin
     * viajar.
     *
     * La segunda, un poco más tarde, es la red de seguridad: en desarrollo React monta,
     * desmonta y vuelve a montar, y un `requestAnimationFrame` pendiente se pierde por el
     * camino. Sin esta segunda pasada el indicador no aparece — y es exactamente lo que
     * pasaba. Medir de más es barato; no medir deja el raíl sin indicador.
     */
    const a = requestAnimationFrame(medir);
    const b = setTimeout(medir, 120);
    window.addEventListener('resize', medir);
    return () => {
      cancelAnimationFrame(a);
      clearTimeout(b);
      window.removeEventListener('resize', medir);
    };
  }, [medir, ruta]);

  /**
   * El viaje del líquido, animado a mano.
   *
   * Con transiciones de CSS el indicador saltaba: React conserva el nodo —comprobado— y
   * aun así el navegador no interpolaba el cambio de `transform` que llega junto con el
   * resto del renderizado de la navegación. La Web Animations API no depende de eso: se
   * le dan los dos extremos y los recorre siempre.
   *
   * Y es justo lo que hace falta aquí, porque las dos gotas tienen que salir a
   * velocidades distintas: la rápida se adelanta, la lenta se rezaga, el filtro las une
   * con un cuello que se estira y al llegar se funden. Ese desfase es el efecto entero.
   */
  useEffect(() => {
    if (!activa.visible) return;
    const origen = desde.current;
    desde.current = activa.pos;
    const t = (y: number) => `translate(-50%,-50%) translateY(${y}px)`;
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    [
      { nodo: rapida.current, ms: 400, curva: 'cubic-bezier(.22,1,.28,1)' },
      { nodo: lenta.current, ms: 900, curva: 'cubic-bezier(.5,0,.2,1)' },
    ].forEach(({ nodo, ms, curva }) => {
      if (!nodo) return;
      nodo.style.transform = t(activa.pos);
      if (quieto || origen === activa.pos) return;
      nodo.animate([{ transform: t(origen) }, { transform: t(activa.pos) }], {
        duration: ms,
        easing: curva,
      });
    });
  }, [activa]);

  /**
   * La gota del ratón sigue al puntero por el eje del raíl, no al enlace más cercano:
   * así el líquido responde al movimiento continuo y no a saltos. Se apaga al salir para
   * que no quede una burbuja huérfana.
   */
  const seguir = (e: React.PointerEvent) => {
    const nodo = nucleo.current;
    if (!nodo || e.pointerType === 'touch') return;
    const c = nodo.getBoundingClientRect();
    setRoce({ pos: horizontal ? e.clientX - c.left : e.clientY - c.top, visible: true });
  };

  return (
    <nav
      className="rail"
      aria-label="Secciones"
      ref={caja}
      onPointerMove={seguir}
      onPointerLeave={() => setRoce((g) => ({ ...g, visible: false }))}
    >
      {/* El filtro vive aquí y no en un fichero suelto: sin él las gotas son círculos
          corrientes, así que van juntos. `stdDeviation` marca cuánto se estira el cuello
          y la última fila de la matriz es el contraste de alfa que recorta el desenfoque
          en un borde limpio. Subir el desenfoque sin subir el contraste da niebla. */}
      <svg className="rail-filtro" aria-hidden="true" focusable="false">
        <defs>
          <filter id="gooey" x="-60%" y="-20%" width="260%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="difuso" />
            <feColorMatrix
              in="difuso"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 26 -12"
              result="pegado"
            />
            <feComposite in="SourceGraphic" in2="pegado" operator="atop" />
          </filter>
        </defs>
      </svg>

      <span className="brand" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 20 12 4l9 16" />
          <path d="M7.5 20 12 11l4.5 9" />
        </svg>
      </span>

      {/* El núcleo no pinta nada: solo apila las burbujas y centra el conjunto. Crece
          solo al añadir una página, porque el alto sale del contenido. */}
      <div className="rail-nucleo" ref={nucleo}>
      <div className="rail-fluido" aria-hidden="true">
        {/* Una burbuja por sección: el filtro las funde con la gota cuando pasa cerca, así
            el indicador no salta de hueco en hueco sino que fluye entre ellas.

            TODOS los hijos de esta capa llevan `key`, y no es decorativo. Las burbujas se
            miden despues del montaje, asi que la lista pasa de 0 a 3 elementos; sin keys
            estables React reconcilia por posicion, recrea las gotas, y un nodo recien
            creado nace en su destino: la transicion no llega a existir y el indicador
            salta. Con keys, los nodos persisten y el liquido viaja. */}
        {burbujas.map((p, i) => (
          <span className="rail-burbuja" key={`b${i}`} style={{ transform: `translate(-50%,-50%) translateY(${p}px)` }} />
        ))}
        {activa.visible && (
          <>
            {/* la lenta va detrás y es la que forma el hilo */}
            <span key="lenta" ref={lenta} className="rail-gota lenta" />
            <span key="rapida" ref={rapida} className="rail-gota rapida" />
          </>
        )}
        <span
          key="roce"
          className={`rail-roce${roce.visible ? ' on' : ''}`}
          style={{ transform: `translate(-50%,-50%) translateY(${roce.pos}px) scale(${roce.visible ? 1 : 0.35})` }}
        />
      </div>

      {secciones.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          /* Son tres y están siempre en pantalla: precargarlas es barato y convierte el
             salto entre secciones en instantáneo. Sin esto, cuando la caché del router
             caduca, el primer clic vuelve al servidor y se nota. */
          prefetch
          className="nav-btn"
          aria-label={s.titulo}
          aria-current={estaActiva(s, ruta) ? 'page' : undefined}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            {s.icono}
          </svg>
        </Link>
      ))}
      </div>
    </nav>
  );
}
