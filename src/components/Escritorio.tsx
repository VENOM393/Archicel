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
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useUI } from '@/lib/ui/contexto';
import { WIDGETS } from '@/lib/widgets/registro';

/**
 * Los iconos del menú, dibujados aquí mismo.
 *
 * Son tres y solo viven en este menú: no justifican una dependencia. Lo que sí importa
 * es que compartan trazo, tamaño y remates con el resto del chrome — 14 px, 1.7 de
 * grosor, extremos redondeados — para que el menú no parezca ensamblado.
 */
function Icono({ d, children }: { d?: string; children?: React.ReactNode }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {d ? <path d={d} /> : children}
    </svg>
  );
}

const MARCO = 'M4 5h16v14H4z';
const SIN_MARCO = 'M4 5h4M16 5h4M20 9v6M4 9v6M4 19h4M16 19h4';
const AL_FRENTE = 'M12 19V5M6 11l6-6 6 6';
const ORIGINAL = 'M3.5 9A8.5 8.5 0 1 0 6 5.5L3 8m0-4v4h4';

/**
 * Si los bloques ya se posaron una vez en esta visita.
 *
 * La entrada escalonada de 760 ms es una presentación: está bien la primera vez que se
 * abre Archicel. Repetirla cada vez que se vuelve del calendario la convierte en una
 * espera, y volver al escritorio es de lo que más se hace. A partir de la segunda vez
 * los bloques simplemente aparecen.
 */
let yaSePosaron = false;

export function Escritorio() {
  const lienzo = useRef<HTMLDivElement>(null);
  const guia = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const { editando, setEditando, opacidad, setOpacidad, avisar, onda } = useUI();
  const esc = useEscritorio(lienzo, editando);
  const [estreno] = useState(() => !yaSePosaron);

  useEffect(() => {
    if (esc.listo) yaSePosaron = true;
  }, [esc.listo]);

  /**
   * El reflejo especular que sigue al cursor.
   *
   * Un solo escuchador en el lienzo en vez de uno por widget, y una escritura por
   * fotograma: mover el ratón sobre ocho paneles no debe costar ocho renders de React.
   * Por eso las coordenadas van a variables CSS y no al estado.
   */
  useEffect(() => {
    const nodo = lienzo.current;
    if (!nodo) return;
    let pendiente = 0;
    let ultimo: PointerEvent | null = null;

    const pintar = () => {
      pendiente = 0;
      const e = ultimo;
      if (!e) return;
      const w = (e.target as HTMLElement).closest<HTMLElement>('.widget');
      if (!w) return;
      const r = w.getBoundingClientRect();
      w.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
      w.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
    };

    const mover = (e: PointerEvent) => {
      ultimo = e;
      if (!pendiente) pendiente = requestAnimationFrame(pintar);
    };

    nodo.addEventListener('pointermove', mover, { passive: true });
    return () => {
      nodo.removeEventListener('pointermove', mover);
      if (pendiente) cancelAnimationFrame(pendiente);
    };
  }, [lienzo]);

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
      {/* Hasta que no se sabe dónde va cada bloque no se enseña ninguno: `posado` es la
          señal de que el layout real está puesto, y sin ella los widgets están ocultos.
          `vuelta` distingue el regreso desde otra vista, donde ya no toca la entrada
          larga sino aparecer y ya. */}
      <div
        className={`canvas${esc.listo ? ' posado' : ''}${estreno ? '' : ' vuelta'}`}
        ref={lienzo}
        style={{ minHeight: esc.altoLienzo }}
      >
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
              className={`widget${def.solido ? ' solid' : ''}${caja.desnudo ? ' desnudo' : ''}`}
              aria-label={def.titulo}
              style={{
                left: `${caja.fx * 100}%`,
                top: caja.y,
                width: `${caja.fw * 100}%`,
                height: caja.h,
                ['--i' as string]: esc.orden[def.id],
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
                esc.alternarMarco(menu.id);
                setMenu(null);
              }}
            >
              {esc.layout[menu.id]?.desnudo ? 'Poner marco' : 'Quitar marco'}
              <span>
                <Icono d={esc.layout[menu.id]?.desnudo ? MARCO : SIN_MARCO} />
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                esc.alFrente(menu.id);
                setMenu(null);
              }}
            >
              Traer al frente
              <span>
                <Icono d={AL_FRENTE} />
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                esc.restablecerUno(menu.id);
                setMenu(null);
              }}
            >
              Posición original
              <span>
                <Icono d={ORIGINAL} />
              </span>
            </button>
          </div>
        </>
      )}

      <div className="editbar">
        <span className="txt">
          <b>Modo edición</b> · <kbd>Alt</kbd> sin imantar
        </span>
        <div className="dial-opa">
          <span>Fondo</span>
          {/* El deslizador nativo no se puede teñir igual en todos los navegadores y cada
              uno dibuja su pulgar: este es el mismo control en todas partes, y responde
              a las flechas del teclado sin que haya que programarlo. */}
          <Slider
            className="opa-slider"
            min={0}
            max={100}
            step={1}
            value={[opacidad]}
            aria-label="Opacidad de los bloques"
            onValueChange={([v]) => setOpacidad(v)}
          />
          <b>{opacidad}%</b>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            const quitados = esc.alternarMarcoTodos();
            avisar(quitados ? 'Sin marcos' : 'Marcos puestos');
          }}
        >
          Marcos
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            esc.restablecer();
            setOpacidad(70);
            avisar('Diseño restablecido');
          }}
        >
          Restablecer
        </Button>
        <Button type="button" onClick={salir}>
          Hecho
        </Button>
      </div>
    </>
  );
}
