'use client';

/**
 * Acceso a los datos vivos. Cada hook se suscribe una vez y se actualiza solo cuando
 * algo cambia — también si el cambio viene de otro dispositivo.
 *
 * Dos garantías que dan estos hooks y de las que depende que la interfaz no parpadee:
 *
 *   · **Orden estable.** Las listas se ordenan aquí con un desempate final por `id`, así
 *     que dos elementos con la misma fecha y hora salen siempre en el mismo orden. Sin
 *     ese desempate su posición relativa puede bailar entre una lectura y otra, React
 *     mueve los nodos en el DOM, y mover un nodo reinicia sus animaciones: ese era el
 *     parpadeo de los días con dos eventos.
 *
 *   · **Sin avisos vacíos.** Un almacén puede emitir el mismo contenido varias veces —
 *     Firestore lo hace de serie: una emisión optimista al escribir y otra al confirmar
 *     el servidor. Si cada una provoca un render, la pantalla trabaja de balde. Aquí se
 *     compara con lo anterior y solo se actualiza si algo cambió de verdad.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useArchicel } from '@/lib/firebase/sesion';
import { aFecha, deFecha, hoy, type Apunte, type Carpeta, type Evento, type Rango, type Tarea } from '@/lib/data';

/** Ordena por fecha, luego por hora y por último por `id`, que nunca empata. */
function ordenarEventos(l: Evento[]): Evento[] {
  return [...l].sort(
    (a, b) =>
      a.fecha.localeCompare(b.fecha) || (a.hora ?? -1) - (b.hora ?? -1) || a.id.localeCompare(b.id),
  );
}

function ordenarTareas(l: Tarea[]): Tarea[] {
  return [...l].sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || a.ini - b.ini || a.id.localeCompare(b.id),
  );
}

/**
 * Suscripción con orden estable y sin renders de balde.
 *
 * `escuchar` se guarda en una ref para que cambiar de función no reabra la suscripción:
 * lo único que debe reabrirla es cambiar de almacén o de rango.
 */
function useLista<T>(
  escuchar: (cb: (l: T[]) => void, rango?: Rango) => () => void,
  ordenar: (l: T[]) => T[],
  clave: string,
  rango?: Rango,
): T[] {
  const [lista, setLista] = useState<T[]>([]);
  /* la huella de lo último entregado, para no repetir */
  const huella = useRef('');
  const refs = useRef({ escuchar, ordenar, rango });
  refs.current = { escuchar, ordenar, rango };

  useEffect(() => {
    return refs.current.escuchar((cruda) => {
      const ordenada = refs.current.ordenar(cruda);
      const nueva = JSON.stringify(ordenada);
      if (nueva === huella.current) return;
      huella.current = nueva;
      setLista(ordenada);
    }, refs.current.rango);
    // el rango entra por su contenido (`clave`), no por identidad de objeto
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  return lista;
}

export function useEventos(rango?: Rango): Evento[] {
  const { almacen } = useArchicel();
  const escuchar = useCallback(
    (cb: (l: Evento[]) => void, r?: Rango) => almacen.eventos.escuchar(cb, r),
    [almacen],
  );
  return useLista(escuchar, ordenarEventos, `${almacen.uid ?? ''}|${rango?.desde ?? ''}|${rango?.hasta ?? ''}`, rango);
}

export function useTareas(rango?: Rango): Tarea[] {
  const { almacen } = useArchicel();
  const escuchar = useCallback(
    (cb: (l: Tarea[]) => void, r?: Rango) => almacen.tareas.escuchar(cb, r),
    [almacen],
  );
  return useLista(escuchar, ordenarTareas, `${almacen.uid ?? ''}|${rango?.desde ?? ''}|${rango?.hasta ?? ''}`, rango);
}

/** Ordena por el orden puesto a mano y, a falta de él, por cuándo se subió. */
function ordenarApuntes(l: Apunte[]): Apunte[] {
  return [...l].sort(
    (a, b) => (a.orden ?? Infinity) - (b.orden ?? Infinity) || (a.creado ?? 0) - (b.creado ?? 0) || a.id.localeCompare(b.id),
  );
}

/**
 * Los apuntes de una asignatura.
 *
 * Se escucha la colección entera y se filtra aquí, en vez de pedirle a Firestore solo los
 * de una asignatura. Con seis asignaturas y unos cientos de apuntes es menos trabajo para
 * todos: una sola suscripción en vez de seis, ningún índice compuesto que mantener, y
 * cambiar de asignatura no vuelve a la red. El día que esto sean miles, se filtra arriba.
 */
export function useApuntes(asignatura: string): Apunte[] {
  const { almacen } = useArchicel();
  const escuchar = useCallback(
    (cb: (l: Apunte[]) => void) => almacen.apuntes.escuchar(cb),
    [almacen],
  );
  const todos = useLista(escuchar, ordenarApuntes, `${almacen.uid ?? ''}|apuntes`);
  return useMemo(() => todos.filter((a) => a.asignatura === asignatura), [todos, asignatura]);
}

/** Alfabético y sin distinguir mayúsculas, que es como espera verlo cualquiera. */
function ordenarCarpetas(l: Carpeta[]): Carpeta[] {
  return [...l].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }) || a.id.localeCompare(b.id));
}

/** Las carpetas de una asignatura, todas: el árbol lo arma la pantalla. */
export function useCarpetas(asignatura: string): Carpeta[] {
  const { almacen } = useArchicel();
  const escuchar = useCallback((cb: (l: Carpeta[]) => void) => almacen.carpetas.escuchar(cb), [almacen]);
  const todas = useLista(escuchar, ordenarCarpetas, `${almacen.uid ?? ''}|carpetas`);
  return useMemo(() => todas.filter((c) => c.asignatura === asignatura), [todas, asignatura]);
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

/**
 * La hora del cliente, que el servidor no puede saber.
 *
 * Esta aplicación se prerrenderiza, así que todo lo que dependa de `new Date()` se
 * congelaría en el momento de construirla: al abrirla por la tarde, el servidor manda
 * "Buenos días" y el navegador lo corrige al hidratar. Ese salto es el reformateo que se
 * ve al entrar, y taparlo con `suppressHydrationWarning` silencia el aviso sin arreglar
 * nada — el texto sigue cambiando delante de quien mira.
 *
 * Devuelve `null` hasta que el componente está montado en el navegador. Quien lo usa
 * enseña mientras tanto su versión sin hora, que es estable y coincide en los dos lados.
 *
 * `intervaloMs` refresca sola: 0 (por defecto) la deja quieta tras el montaje.
 */
export function useAhora(intervaloMs = 0): Date | null {
  const [ahora, setAhora] = useState<Date | null>(null);

  useEffect(() => {
    setAhora(new Date());
    if (!intervaloMs) return;
    const id = setInterval(() => setAhora(new Date()), intervaloMs);
    return () => clearInterval(id);
  }, [intervaloMs]);

  return ahora;
}
