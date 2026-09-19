'use client';

/**
 * Acceso a los datos vivos. Cada hook se suscribe una vez y se actualiza solo cuando
 * algo cambia — también si el cambio viene de otro dispositivo.
 */

import { useEffect, useMemo, useState } from 'react';

import { useArchicel } from '@/lib/firebase/sesion';
import { aFecha, deFecha, hoy, type Evento, type Rango, type Tarea } from '@/lib/data';

export function useEventos(rango?: Rango) {
  const { almacen } = useArchicel();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const clave = `${rango?.desde ?? ''}|${rango?.hasta ?? ''}`;

  useEffect(() => {
    return almacen.eventos.escuchar(setEventos, rango);
    // el rango se compara por su contenido, no por identidad de objeto
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [almacen, clave]);

  return eventos;
}

export function useTareas(rango?: Rango) {
  const { almacen } = useArchicel();
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const clave = `${rango?.desde ?? ''}|${rango?.hasta ?? ''}`;

  useEffect(() => {
    return almacen.tareas.escuchar(setTareas, rango);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [almacen, clave]);

  return tareas;
}

/** La entrega que viene: de ella cuelgan la cuenta atrás y el mensaje de bienvenida. */
export function useProximaEntrega() {
  const eventos = useEventos();
  return useMemo(() => {
    const desdeHoy = hoy();
    const proxima = eventos
      .filter((e) => e.tipo === 'entrega' && e.fecha >= desdeHoy)
      .sort((a, b) => (a.fecha < b.fecha ? -1 : 1))[0];
    if (!proxima) return null;
    const dias = Math.max(
      0,
      Math.round((deFecha(proxima.fecha).getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000),
    );
    return { evento: proxima, dias };
  }, [eventos]);
}

export function useTareasDeHoy() {
  const clave = aFecha(new Date());
  const tareas = useTareas({ desde: clave, hasta: clave });
  return useMemo(() => tareas.slice().sort((a, b) => a.ini - b.ini), [tareas]);
}
