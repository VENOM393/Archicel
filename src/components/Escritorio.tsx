'use client';

/**
 * El lienzo de widgets y su modo edición.
 *
 * El fondo, el raíl y la cabecera los pone el Marco: aquí solo viven las cajas,
 * la cuadrícula de referencia, las guías de alineación y la barra del editor.
 */

import { useEffect, useRef, useState } from 'react';

import { CONTENIDOS } from '@/components/widgets';
import { useEscritorio } from '@/hooks/useEscritorio';
import { useUI } from '@/lib/ui/contexto';
import { WIDGETS } from '@/lib/widgets/registro';

export function Escritorio() {
  const lienzo = useRef<HTMLDivElement>(null);
  const guia = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const { editando, setEditando, opacidad, setOpacidad, avisar, onda } = useUI();
  const esc = useEscritorio(lienzo, editando);

  /* la cuadrícula se abre como un círculo desde donde se pulsó el lápiz */
  useEffect(() => {
    const g = guia.current;
    if (!g) return;
    const destino = editando ? 'circle(155% at 50% 0%)' : 'circle(0% at 50% 0%)';
    const t = setTimeout(() => {
      g.style.clipPath = destino;
    }, 20);
    return () => clearTimeout(t);
  }, [editando]);

  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && editando) setEditando(false);
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [editando, setEditando]);

  const salir = (e: React.MouseEvent) => {
    onda(e.clientX, e.clientY);
    setEditando(false);
    avisar('Diseño guardado');
  };

  return (
    <>
      <div className="canvas" ref={lienzo} style={{ minHeight: esc.altoLienzo }}>
        <div className="grid-guide" ref={guia} aria-hidden="true" />
        {esc.guias.v !== null && (
          <span className="guia guia-v" style={{ transform: `translateX(${esc.guias.v}px)`, opacity: 1 }} />
        )}
        {esc.guias.h !== null && (
          <span className="guia guia-h" style={{ transform: `translateY(${esc.guias.h}px)`, opacity: 1 }} />
        )}

        {WIDGETS.map((def) => {
          const caja = esc.layout[def.id];
          const Contenido = CONTENIDOS[def.id];
          if (!caja || !Contenido) return null;
          return (
            <article
              key={def.id}
              data-id={def.id}
              className={`widget${def.solido ? ' solid' : ''}`}
              aria-label={def.titulo}
              style={{
                left: `${caja.fx * 100}%`,
                top: caja.y,
                width: `${caja.fw * 100}%`,
                height: caja.h,
              }}
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest('.menu-btn, .resize')) return;
                esc.empezarArrastre(e, def.id);
              }}
            >
              <span className="grip" aria-hidden="true">
                <i />
              </span>
              <button
                className="menu-btn"
                type="button"
                aria-label={`Opciones de ${def.titulo}`}
                onClick={(e) => {
                  e.stopPropagation();
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setMenu({ id: def.id, x: Math.min(r.right - 186, window.innerWidth - 196), y: r.bottom + 8 });
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <circle cx="5" cy="12" r=".6" />
                  <circle cx="12" cy="12" r=".6" />
                  <circle cx="19" cy="12" r=".6" />
                </svg>
              </button>
              <div className="inner">
                <Contenido />
              </div>
              <span className="resize" role="presentation" onPointerDown={(e) => esc.empezarResize(e, def.id)} />
            </article>
          );
        })}
      </div>

      {menu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 39 }} onClick={() => setMenu(null)} />
          <div className="menu on" style={{ position: 'fixed', left: menu.x, top: menu.y }}>
            {[
              { n: 'Un tercio', fw: 1 / 3 },
              { n: 'La mitad', fw: 0.5 },
              { n: 'Dos tercios', fw: 2 / 3 },
              { n: 'Todo el ancho', fw: 1 },
            ].map((t) => (
              <button
                key={t.n}
                type="button"
                onClick={() => {
                  esc.cambiarAncho(menu.id, t.fw);
                  setMenu(null);
                }}
              >
                {t.n}
                <span>{Math.round(t.fw * 100)}%</span>
              </button>
            ))}
            <hr />
            <button
              type="button"
              onClick={() => {
                esc.alFrente(menu.id);
                setMenu(null);
              }}
            >
              Traer al frente<span>↑</span>
            </button>
            <button
              type="button"
              onClick={() => {
                esc.restablecerUno(menu.id);
                setMenu(null);
              }}
            >
              Posición original<span>↺</span>
            </button>
          </div>
        </>
      )}

      <div className="editbar">
        <span className="txt">
          <b>Modo edición</b> · <kbd>Alt</kbd> sin imantar
        </span>
        <label className="dial-opa" htmlFor="opa">
          <span>Fondo</span>
          <input
            id="opa"
            type="range"
            min={0}
            max={100}
            step={1}
            value={opacidad}
            aria-label="Opacidad de los bloques"
            style={{ ['--pct' as string]: `${opacidad}%` }}
            onChange={(e) => setOpacidad(Number(e.target.value))}
          />
          <b>{opacidad}%</b>
        </label>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => {
            esc.restablecer();
            setOpacidad(70);
            avisar('Diseño restablecido');
          }}
        >
          Restablecer
        </button>
        <button type="button" onClick={salir}>
          Hecho
        </button>
      </div>
    </>
  );
}
