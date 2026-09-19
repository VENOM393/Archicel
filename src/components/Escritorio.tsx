'use client';

/**
 * El escritorio: raíl, cabecera, lienzo de widgets y modo edición.
 *
 * Las posiciones vienen del almacén, así que la disposición sigue a Celeste entre
 * dispositivos. El modo edición no toca los datos: solo mueve cajas.
 */

import { useRef, useState } from 'react';

import { Fondo, type MandoFondo } from '@/components/Fondo';
import { CONTENIDOS } from '@/components/widgets';
import { useEscritorio } from '@/hooks/useEscritorio';
import { useArchicel } from '@/lib/firebase/sesion';
import { WIDGETS } from '@/lib/widgets/registro';

const USUARIA = 'Celeste';

export function Escritorio() {
  const lienzo = useRef<HTMLDivElement>(null);
  const mandoFondo = useRef<MandoFondo | null>(null);
  const [dia, setDia] = useState(false);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const { enLaNube } = useArchicel();
  const esc = useEscritorio(lienzo);

  const alternarEdicion = (e: React.MouseEvent) => {
    mandoFondo.current?.onda(e.clientX, e.clientY);
    esc.setEditando(!esc.editando);
    setMenu(null);
  };

  const saludo = (() => {
    const h = new Date().getHours();
    return h < 6 ? 'Aún despierta' : h < 13 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
  })();

  return (
    <>
      <Fondo editando={esc.editando} dia={dia} mandoRef={mandoFondo} />

      <div className={`app${esc.editando ? '' : ''}`}>
        <nav className="rail" aria-label="Secciones">
          <span className="brand" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 20 12 4l9 16" />
              <path d="M7.5 20 12 11l4.5 9" />
            </svg>
          </span>
          <button className="nav-btn" type="button" aria-current="page" aria-label="Escritorio">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="2" />
              <rect x="14" y="3" width="7" height="7" rx="2" />
              <rect x="3" y="14" width="7" height="7" rx="2" />
              <rect x="14" y="14" width="7" height="7" rx="2" />
            </svg>
          </button>
          <span className="spacer" />
        </nav>

        <div className="body">
          <header className="topbar rise">
            <div className="hello">
              <span className="sub">{saludo}</span>
              <span className="name">{USUARIA}</span>
            </div>
            <div className="tools">
              <button
                className={`icon-btn${esc.editando ? ' is-on' : ''}`}
                type="button"
                aria-pressed={esc.editando}
                aria-label="Editar el escritorio"
                onClick={alternarEdicion}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </button>
              <button
                className="icon-btn"
                type="button"
                aria-label={dia ? 'Cambiar a modo noche' : 'Cambiar a modo día'}
                onClick={() => setDia((v) => !v)}
              >
                {dia ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                    <circle cx="12" cy="12" r="4.2" />
                    <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
                  </svg>
                )}
              </button>
              <span className="avatar" aria-hidden="true">
                {USUARIA.slice(0, 2).toUpperCase()}
              </span>
            </div>
          </header>

          <div className="canvas" ref={lienzo} style={{ minHeight: esc.altoLienzo }}>
            <div className="grid-guide" id="guide" aria-hidden="true" />
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

          <div className="foot">
            <span>{enLaNube ? 'Datos en Firestore' : 'Datos en este navegador'}</span>
            <span>{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          </div>
        </div>
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

      <div className="editbar" style={esc.editando ? { opacity: 1, transform: 'translate(-50%,0)', pointerEvents: 'auto' } : undefined}>
        <span className="txt">
          <b>Modo edición</b> · <kbd>Alt</kbd> sin imantar
        </span>
        <button type="button" className="ghost-btn" onClick={esc.restablecer}>
          Restablecer
        </button>
        <button type="button" onClick={(e) => alternarEdicion(e)}>
          Hecho
        </button>
      </div>
    </>
  );
}
