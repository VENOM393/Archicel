'use client';

/**
 * El cronómetro de estudio, en un solo sitio.
 *
 * Vivía dentro de `Metodos.tsx`, que era donde se usaba. Dejó de valer el día que el modo
 * foco del escritorio tuvo que enseñar **el mismo** pomodoro: dos motores leyendo el mismo
 * `localStorage` es la forma más rápida de que uno apunte una sesión y el otro no, o de
 * que los dos apunten la misma dos veces.
 *
 * Lo que se guarda es **cuándo empezó**, nunca cuánto queda. Es lo que hace que el
 * cronómetro sobreviva a recargar, a cambiar de sección y a cerrar la pestaña, y lo que
 * permite que dos pantallas distintas enseñen exactamente lo mismo sin hablarse.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useArchicel } from '@/lib/firebase/sesion';
import { useUI } from '@/lib/ui/contexto';
import { aFecha, type Almacen } from '@/lib/data';

/** Lo que se recuerda entre recargas. */
export interface EnMarcha {
  asignatura: string;
  /** Milisegundos desde la época. Lo que queda se calcula; un contador en memoria se pierde. */
  arranque: number;
  /** Minutos de **esta** fase. */
  largo: number;
  fase: 'estudio' | 'descanso';
}

const RECORDADO = 'archicel.pomodoro.v1';
/** Las otras pestañas se enteran por `storage`; dentro de esta, por este aviso. */
const LATIDO = 'archicel:pomodoro';

export function leerMarcha(): EnMarcha | null {
  try {
    const crudo = localStorage.getItem(RECORDADO);
    if (!crudo) return null;
    const g = JSON.parse(crudo) as EnMarcha;
    return g && typeof g.arranque === 'number' && typeof g.largo === 'number' ? g : null;
  } catch {
    /* almacenamiento bloqueado o contenido corrupto: no hay nada corriendo */
    return null;
  }
}

export function escribirMarcha(m: EnMarcha | null) {
  try {
    if (m) localStorage.setItem(RECORDADO, JSON.stringify(m));
    else localStorage.removeItem(RECORDADO);
  } catch {}
  window.dispatchEvent(new Event(LATIDO));
}

/** Segundos que quedan de `m`, contra el reloj real. Nunca negativo. */
export function quedanDe(m: EnMarcha): number {
  return Math.max(0, m.largo * 60 - Math.floor((Date.now() - m.arranque) / 1000));
}

/**
 * El identificador de la sesión que deja un pomodoro, **derivado de su arranque**.
 *
 * No es `nuevoId('s')` a propósito. Dos pantallas pueden estar montadas a la vez durante
 * una transición de página —el App Router mete la nueva dentro de la que sale—, y si las
 * dos ven terminar el mismo pomodoro con un id aleatorio cada una, el registro se queda
 * con la sesión contada dos veces. Con el arranque dentro del id, las dos escriben
 * **el mismo documento** y `guardar` se encarga del resto.
 */
function idDeSesion(m: EnMarcha): string {
  return `p${m.arranque}`;
}

/** Apunta un rato estudiado. Los descansos no cuentan y no llegan aquí. */
export async function apuntarSesion(almacen: Almacen, m: EnMarcha): Promise<void> {
  const inicio = new Date(m.arranque);
  await almacen.sesiones.guardar({
    id: idDeSesion(m),
    asignatura: m.asignatura,
    fecha: aFecha(inicio),
    minutos: m.largo,
    metodo: 'pomodoro',
    ini: inicio.getHours() * 60 + inicio.getMinutes(),
    creado: Date.now(),
  });
}

/**
 * Lo que hay corriendo ahora mismo, **para quien solo quiera mirarlo**.
 *
 * El latido solo late si hay algo que contar: sin pomodoro no hay `setInterval`, así que
 * una pantalla quieta no despierta a React una vez por segundo para no cambiar nada.
 */
export function useMarcha(): { marcha: EnMarcha | null; restante: number } {
  const [marcha, setMarcha] = useState<EnMarcha | null>(null);
  const [restante, setRestante] = useState(0);

  useEffect(() => {
    const mirar = () => setMarcha(leerMarcha());
    mirar();
    window.addEventListener(LATIDO, mirar);
    window.addEventListener('storage', mirar);
    return () => {
      window.removeEventListener(LATIDO, mirar);
      window.removeEventListener('storage', mirar);
    };
  }, []);

  useEffect(() => {
    if (!marcha) {
      setRestante(0);
      return;
    }
    const tic = () => setRestante(quedanDe(marcha));
    tic();
    const t = setInterval(tic, 1000);
    return () => clearInterval(t);
  }, [marcha]);

  return { marcha, restante };
}

/**
 * El cronómetro entero: lo que corre, lo que queda, y arrancarlo y pararlo.
 *
 * Lo usan las dos pantallas que lo pintan —la tarjeta de Métodos y el modo foco— y las
 * dos ven lo mismo porque el estado no está en ninguna de las dos: está en
 * `localStorage`, y cada una lo lee.
 */
export function usePomodoro() {
  const { almacen } = useArchicel();
  const { avisar } = useUI();

  const [estudio, setEstudio] = useState(25);
  const [descanso, setDescanso] = useState(5);
  const [marcha, setMarcha] = useState<EnMarcha | null>(null);
  const [restante, setRestante] = useState(0);
  const anotado = useRef<number | null>(null);

  /* Al montar se lee lo recordado y se calcula lo que queda desde el arranque. */
  useEffect(() => {
    const g = leerMarcha();
    if (!g) return;
    setMarcha(g);
    if (g.fase === 'estudio') setEstudio(g.largo);
  }, []);

  /* Y se sigue escuchando: si el foco para el pomodoro, la tarjeta de Métodos tiene que
     enterarse aunque esté montada, y al revés. */
  useEffect(() => {
    const mirar = () => setMarcha(leerMarcha());
    window.addEventListener(LATIDO, mirar);
    window.addEventListener('storage', mirar);
    return () => {
      window.removeEventListener(LATIDO, mirar);
      window.removeEventListener('storage', mirar);
    };
  }, []);

  const guardarSesion = useCallback(
    async (m: EnMarcha) => {
      if (m.fase !== 'estudio' || anotado.current === m.arranque) return;
      anotado.current = m.arranque;
      try {
        await apuntarSesion(almacen, m);
      } catch {
        avisar('No se pudo apuntar la sesión.');
      }
    },
    [almacen, avisar],
  );

  /* El latido. Se recalcula contra el reloj real, no se descuenta un segundo cada vez: si
     la pestaña se queda dormida, al volver el número es el correcto y no uno viejo. */
  useEffect(() => {
    if (!marcha) {
      setRestante(0);
      return;
    }
    const mirar = () => {
      const quedan = quedanDe(marcha);
      setRestante(quedan);
      if (quedan <= 0) {
        void guardarSesion(marcha);
        const siguiente: EnMarcha = {
          asignatura: marcha.asignatura,
          arranque: Date.now(),
          largo: marcha.fase === 'estudio' ? descanso : estudio,
          fase: marcha.fase === 'estudio' ? 'descanso' : 'estudio',
        };
        setMarcha(siguiente);
        escribirMarcha(siguiente);
        avisar(marcha.fase === 'estudio' ? 'Pomodoro terminado. Descansa.' : 'Descanso terminado.');
      }
    };
    mirar();
    const t = setInterval(mirar, 1000);
    return () => clearInterval(t);
  }, [marcha, descanso, estudio, guardarSesion, avisar]);

  const arrancar = useCallback(
    (asignatura: string, minutos?: number) => {
      const largo = minutos ?? estudio;
      const nueva: EnMarcha = { asignatura, arranque: Date.now(), largo, fase: 'estudio' };
      anotado.current = null;
      setEstudio(largo);
      setMarcha(nueva);
      escribirMarcha(nueva);
    },
    [estudio],
  );

  const parar = useCallback(() => {
    setMarcha(null);
    anotado.current = null;
    escribirMarcha(null);
  }, []);

  return { marcha, restante, estudio, setEstudio, descanso, setDescanso, arrancar, parar };
}
