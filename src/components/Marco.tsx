'use client';

/**
 * El marco de la aplicación: fondo, raíl y cabecera.
 *
 * Envuelve a las tres vistas. Como vive por encima de ellas, cambiar de vista no
 * reinicia el shader ni vuelve a cargar la fotografía.
 */

import { usePathname } from 'next/navigation';
import * as m from 'motion/react-m';
import { AnimatePresence } from 'motion/react';
import type { ReactNode } from 'react';

import { Fondo } from '@/components/Fondo';
import { Instalable } from '@/components/Instalable';
import { MenuCuenta } from '@/components/MenuCuenta';
import { Dock } from '@/components/Dock';
import { Button } from '@/components/ui/button';
import { useUI } from '@/lib/ui/contexto';
import { AVISO } from '@/lib/ui/movimiento';


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
    /* un reloj: el horario responde a "a qué hora", no a "qué día" — esa es la del
       calendario, y con dos rejillas seguidas en el raíl no se distinguirían */
    icono: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5.2l3.4 2" />
      </>
    ),
  },
];

export function Marco({ children }: { children: ReactNode }) {
  const ruta = usePathname();
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
            <span className="marca" aria-hidden="true">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 20 12 4l9 16" />
                <path d="M7.5 20 12 11l4.5 9" />
              </svg>
              <b>Archicel</b>
            </span>
            <span className="hueco" />
            <div className="tools">
              {/* Solo se pinta cuando el navegador ofrece instalar; el resto del tiempo
                  no devuelve nada y la cabecera queda como estaba. */}
              <Instalable />
              {ruta === '/' && (
                <button
                  className={`icon-btn${editando ? ' is-on' : ''}`}
                  type="button"
                  aria-pressed={editando}
                  aria-label="Editar el escritorio"
                  onClick={(e) => {
                    onda(e.clientX, e.clientY);
                    setEditando(!editando);
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                </button>
              )}
              <MenuCuenta />
            </div>
          </header>

          {children}
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
