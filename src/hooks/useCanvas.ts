'use client';

/**
 * Lo que trae Canvas, visto desde una pantalla.
 *
 * La interfaz no sabe que Canvas existe: pide esto y recibe eventos del modelo de la
 * casa. Igual que con Firestore, hay una capa por medio y el día que la universidad
 * cambie de plataforma no se entera ni una pantalla.
 *
 * Tres cosas que este hook hace y que suelen faltar:
 *
 *   · **Cancela al desmontar.** Si se cambia de vista mientras la petición vuela, se
 *     aborta. Sin eso, la respuesta llega a un componente que ya no existe.
 *   · **No parpadea al refrescar.** Mientras trae de nuevo se conserva lo anterior en
 *     pantalla; `cargando` distingue la primera vez de las siguientes.
 *   · **Falla en silencio.** Canvas caído no puede vaciar el escritorio: se queda lo
 *     último que se supo y el estado dice por qué no hay nada nuevo.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { Evento, TipoEvento } from '@/lib/data';

export type EstadoCanvas = 'ok' | 'sin-configurar' | 'credencial' | 'limite' | 'red' | 'canvas';

export interface EventoDeCanvas extends Omit<Evento, 'id'> {
  origen: 'canvas';
  origenId: string;
  enlace?: string;
  entregado?: boolean;
  tipo: TipoEvento;
}

export interface DatosCanvas {
  estado: EstadoCanvas;
  eventos: EventoDeCanvas[];
  asignaturas: { id: number; nombre: string }[];
  cuota: number | null;
  momento: number;
  mensaje?: string;
}

const VACIO: DatosCanvas = { estado: 'sin-configurar', eventos: [], asignaturas: [], cuota: null, momento: 0 };

/** Lo que se le dice a la usuaria de cada estado. Silencio cuando no hay nada que contar. */
export const AVISO_CANVAS: Record<EstadoCanvas, string | null> = {
  ok: null,
  /* Que no esté configurado no es un fallo: es que esta parte está apagada. */
  'sin-configurar': null,
  credencial: 'El campus no acepta la credencial. Hay que generar un token nuevo en Canvas.',
  limite: 'El campus ha pedido una pausa. Se vuelve a intentar en un rato.',
  red: 'No se ha podido hablar con el campus.',
  canvas: 'El campus no responde bien ahora mismo.',
};

/** Cada cuánto se vuelve a preguntar. Canvas no es tiempo real y tratarlo como tal solo gasta cuota. */
const CADA = 15 * 60_000;

export function useCanvas(desde?: string, hasta?: string) {
  const [datos, setDatos] = useState<DatosCanvas>(VACIO);
  const [cargando, setCargando] = useState(true);
  const vivo = useRef(true);

  const traer = useCallback(
    async (refrescar = false, senal?: AbortSignal) => {
      const p = new URLSearchParams();
      if (desde) p.set('desde', desde);
      if (hasta) p.set('hasta', hasta);
      const url = `/api/canvas${p.size ? `?${p}` : ''}`;

      try {
        const res = await fetch(url, { method: refrescar ? 'POST' : 'GET', signal: senal });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as DatosCanvas;
        if (vivo.current) setDatos(json);
      } catch {
        /* Se conserva lo último que se supo: media pantalla con datos de hace diez
           minutos es infinitamente mejor que una pantalla vacía. */
        if (vivo.current) setDatos((d) => ({ ...d, estado: 'red' }));
      } finally {
        if (vivo.current) setCargando(false);
      }
    },
    [desde, hasta],
  );

  useEffect(() => {
    vivo.current = true;
    const mando = new AbortController();
    traer(false, mando.signal);

    const reloj = setInterval(() => {
      /* Con la pestaña oculta no se pregunta: nadie lo está mirando. */
      if (!document.hidden) traer(false);
    }, CADA);

    return () => {
      vivo.current = false;
      mando.abort();
      clearInterval(reloj);
    };
  }, [traer]);

  const refrescar = useCallback(() => {
    setCargando(true);
    return traer(true);
  }, [traer]);

  return { ...datos, cargando, refrescar };
}
