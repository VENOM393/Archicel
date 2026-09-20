'use client';

/**
 * Instalar Archicel como un programa del ordenador.
 *
 * Dos piezas que van juntas y por eso viven en el mismo sitio:
 *
 *   1 · **Registra el service worker.** Es lo que le da a la aplicación su arranque
 *       instantáneo y su modo sin conexión, y también el requisito que Chrome exige
 *       antes de ofrecer la instalación.
 *   2 · **Enseña el botón de instalar**, y solo cuando de verdad se puede.
 *
 * ## Por qué el botón aparece y desaparece
 *
 * El navegador no deja pedir la instalación cuando uno quiera: avisa él, una sola vez y
 * cuando le parece, con el evento `beforeinstallprompt`. Ese evento llega a veces antes
 * de que React haya montado nada, así que quien lo recoge es un guion diminuto del
 * `layout` que lo guarda en `window.__instalar`; aquí solo se lee lo que ya esté
 * guardado y se escucha por si llega después.
 *
 * Que no haya botón no es un fallo. Significa una de tres:
 *
 *   · ya está instalada (entonces sobra),
 *   · el navegador no sabe hacerlo — Firefox de escritorio no, Safari se instala a mano
 *     desde Compartir → Añadir al Dock,
 *   · o se está en desarrollo: el service worker se registra solo en producción, porque
 *     en desarrollo se queda con copias viejas y se pasa uno la tarde preguntándose por
 *     qué no se ven los cambios.
 */

import { useCallback, useEffect, useState } from 'react';

import { useUI } from '@/lib/ui/contexto';

/** El evento no está en las definiciones estándar: lo declara cada quien. */
interface EventoInstalacion extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    __instalar?: EventoInstalacion | null;
  }
}

/** Si ya se abrió como aplicación, no hay nada que ofrecer. */
function yaEsPrograma() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    /* el de Safari, que no implementa display-mode */
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function Instalable() {
  const [puede, setPuede] = useState(false);
  const { avisar } = useUI();

  /* El service worker, una vez por carga. */
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    /* Tras `load` y no antes: registrarlo durante el arranque compite por el ancho de
       banda justo con lo que hay que pintar. */
    const registrar = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* Sin service worker la aplicación funciona igual, solo que sin instalar ni
           modo sin conexión. No es motivo para molestar a nadie con un error. */
      });
    };
    if (document.readyState === 'complete') registrar();
    else window.addEventListener('load', registrar, { once: true });
    return () => window.removeEventListener('load', registrar);
  }, []);

  useEffect(() => {
    if (yaEsPrograma()) return;
    setPuede(Boolean(window.__instalar));

    const llego = () => setPuede(true);
    const instalada = () => {
      window.__instalar = null;
      setPuede(false);
      avisar('Archicel ya está en tu escritorio');
    };

    window.addEventListener('archicel:instalable', llego);
    window.addEventListener('appinstalled', instalada);
    return () => {
      window.removeEventListener('archicel:instalable', llego);
      window.removeEventListener('appinstalled', instalada);
    };
  }, [avisar]);

  const instalar = useCallback(async () => {
    const evento = window.__instalar;
    if (!evento) return;
    /* Se gasta al usarlo: el navegador no deja volver a lanzarlo con el mismo evento. */
    window.__instalar = null;
    setPuede(false);
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    /* Si dice que no, el botón vuelve en la siguiente visita: el navegador emite otra
       vez `beforeinstallprompt`. Insistir dentro de la misma sesión es dar la lata. */
    if (outcome === 'dismissed') avisar('Otro día será');
  }, [avisar]);

  if (!puede) return null;

  return (
    <button className="btn-instalar" type="button" onClick={instalar}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3v11" />
        <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
        <path d="M4 17.5v1A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5v-1" />
      </svg>
      <span>Instalar</span>
    </button>
  );
}
