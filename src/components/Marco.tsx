'use client';

/**
 * El marco de la aplicación: fondo, raíl y cabecera.
 *
 * Envuelve a las tres vistas. Como vive por encima de ellas, cambiar de vista no
 * reinicia el shader ni vuelve a cargar la fotografía.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { Fondo } from '@/components/Fondo';
import { useUI } from '@/lib/ui/contexto';

const USUARIA = 'Celeste';

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
    icono: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M8 3v4M16 3v4M3 10h18M9 10v11M15 10v11" />
      </>
    ),
  },
  {
    href: '/dia',
    titulo: 'Agenda del día',
    icono: (
      <>
        <path d="M4 6h3M4 12h3M4 18h3" />
        <path d="M10 6h10M10 12h10M10 18h6" />
      </>
    ),
  },
];

export function Marco({ children }: { children: ReactNode }) {
  const ruta = usePathname();
  const { dia, alternarAmbiente, editando, setEditando, onda, aviso, mandoFondo } = useUI();

  const saludo = (() => {
    const h = new Date().getHours();
    return h < 6 ? 'Aún despierta' : h < 13 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
  })();

  return (
    <>
      <Fondo editando={editando} dia={dia} mandoRef={mandoFondo} />

      <div className="app">
        <nav className="rail" aria-label="Secciones">
          <span className="brand" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 20 12 4l9 16" />
              <path d="M7.5 20 12 11l4.5 9" />
            </svg>
          </span>
          {SECCIONES.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="nav-btn"
              aria-label={s.titulo}
              aria-current={ruta === s.href ? 'page' : undefined}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                {s.icono}
              </svg>
            </Link>
          ))}
          <span className="spacer" />
        </nav>

        <div className="body">
          <header className="topbar rise">
            <div className="hello">
              <span className="sub">{saludo}</span>
              <span className="name">{USUARIA}</span>
            </div>
            <div className="tools">
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
              <button
                className="icon-btn"
                type="button"
                aria-label={dia ? 'Cambiar a modo noche' : 'Cambiar a modo día'}
                onClick={alternarAmbiente}
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

          {children}
        </div>
      </div>

      <div className={`toast${aviso ? ' on' : ''}`} role="status" aria-live="polite">
        {aviso}
      </div>
    </>
  );
}
