'use client';

/**
 * La firma del autor.
 *
 * Una placa pequeña, como la que se atornilla bajo un cuadro o junto a la puerta de un
 * edificio terminado. Archicel es un regalo, y un regalo lleva firma.
 *
 * ## Por qué lleva una tipografía que no usa el resto de la aplicación
 *
 * Todo Archicel está escrito en Outfit, que es geométrica, y en monoespaciada para las
 * medidas. Esta placa lleva **Instrument Serif en cursiva**, y es la única excepción del
 * proyecto. Una firma con la misma letra que la interfaz no se lee como una firma: se lee
 * como otra etiqueta más del producto. El cambio de familia es lo que dice «esto no lo
 * escribió la aplicación, lo escribió una persona». Está justificado en
 * `docs/design/DESIGN.md`, donde vive la regla que rompe.
 *
 * ## El movimiento, que es casi todo
 *
 * **Al entrar** — la última de la pantalla, cuando todo lo demás ya se ha posado; una
 * firma se pone al final. La placa sube y se enfoca; después el nombre **se escribe letra
 * a letra**, cada una desde abajo, girada e inclinada, desenfocándose hacia dentro. No es
 * un adorno: es la diferencia entre un texto que aparece y un nombre que alguien traza.
 * Al terminar la última letra, la línea se dibuja debajo de izquierda a derecha, como el
 * remate de una rúbrica.
 *
 * **Al pasar por encima** — tres cosas a la vez y ninguna se nota por separado:
 *
 *   · una luz **sigue al cursor** por dentro de la placa, como el reflejo sobre latón;
 *   · un barrido cruza la superficie una sola vez, de izquierda a derecha, y al salir no
 *     vuelve — un reflejo que va y viene es un efecto, uno que solo pasa es un material;
 *   · las letras suben dos píxeles **en cascada**, cada una con su retardo, y al apartar
 *     el ratón bajan en el mismo orden. Esa onda es lo que lo hace parecer vivo.
 *
 * La luz del cursor se escribe en variables CSS desde un solo `pointermove` con freno de
 * fotograma. Ni una sola de estas tres cosas pasa por el estado de React: mover el ratón
 * sobre una placa de ciento setenta píxeles no puede costar un renderizado.
 */

import { useEffect, useRef } from 'react';

import { instrumentSerif } from '@/lib/ui/fuentes';

export function Firma({ nombre = 'Cristian' }: { nombre?: string }) {
  const caja = useRef<HTMLElement>(null);

  useEffect(() => {
    const nodo = caja.current;
    if (!nodo) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let pendiente = 0;
    let ultimo: PointerEvent | null = null;

    const pintar = () => {
      pendiente = 0;
      const e = ultimo;
      if (!e) return;
      const r = nodo.getBoundingClientRect();
      nodo.style.setProperty('--fx', `${((e.clientX - r.left) / r.width) * 100}%`);
      nodo.style.setProperty('--fy', `${((e.clientY - r.top) / r.height) * 100}%`);
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
  }, []);

  const letras = [...nombre];

  return (
    <aside className="firma" ref={caja} aria-label={`Hecho por ${nombre}`}>
      <span className="firma-luz" aria-hidden="true" />
      <span className="firma-brillo" aria-hidden="true" />

      <span className="firma-marca" aria-hidden="true">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 20 12 4l9 16" />
          <path d="M7.5 20 12 11l4.5 9" />
        </svg>
      </span>

      <span className="firma-raya" aria-hidden="true" />

      <span className="firma-txt">
        <span className="firma-eti">Made by</span>
        <span className={`firma-nombre ${instrumentSerif.className}`}>
          {/* El nombre completo va en el `aria-label` de la placa; aquí las letras se
              separan solo para poder escalonarlas, así que el lector de pantalla no
              debe deletrearlas. */}
          <span aria-hidden="true">
            {letras.map((l, i) => (
              <span key={`${l}-${i}`} className="firma-letra" style={{ ['--i' as string]: i }}>
                {l}
              </span>
            ))}
          </span>
          <i className="firma-linea" aria-hidden="true" style={{ ['--n' as string]: letras.length }} />
        </span>
      </span>
    </aside>
  );
}
