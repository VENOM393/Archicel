'use client';

/**
 * Un mes de eventos, reutilizable.
 *
 * Estaba escrito dentro de `/calendario` y ahora vive aquí porque lo usan dos pantallas: el
 * calendario entero y la columna derecha de una asignatura. Son el mismo mes con distinto
 * tamaño y distinto contenido, y tenerlo dos veces habría garantizado que se separaran.
 *
 * ## Qué recibe y qué no
 *
 * **Los eventos vienen ya filtrados.** Quien lo usa decide qué entra: el calendario pone
 * todos los del mes, la asignatura solo los suyos. Así este componente no necesita saber
 * qué es una asignatura, que es lo que lo hace reutilizable de verdad y no solo compartido.
 *
 * `alPulsarDia` también viene de fuera: en el calendario abre la agenda de ese día, y en una
 * asignatura puede no hacer nada. El componente no conoce el enrutador.
 *
 * ## Dos cosas que no se deducen
 *
 * **El día de hoy sale de `useAhora`, no de `new Date()`.** La aplicación se prerrenderiza
 * y el servidor no sabe qué día es donde está ella: leyendo el reloj durante el render, el
 * marcado del servidor y el del navegador no coinciden. Antes esto leía `new Date()`
 * directamente — era una infracción tolerada de la regla de la casa, y al extraerlo se
 * arregla para las dos pantallas.
 *
 * **Nunca se oculta un evento sin sustituto visual.** Si la celda es baja no caben chips, y
 * entonces entra la fila de puntos: uno por evento, que cabe siempre. Lo decide el CSS con
 * container queries. Antes, a esa altura, los eventos simplemente desaparecían sin dejar
 * rastro, y un día lleno se veía igual que uno vacío.
 *
 * **Mover un evento de día se activa con `alMover` y no viene de serie.** Sin esa función
 * los chips no son arrastrables y las casillas no son dianas: el mes de una asignatura es
 * una columna estrecha en modo puntos, donde arrastrar un punto de 6 px sería una promesa
 * que el gesto no puede cumplir. El calendario grande sí la pasa.
 */

import { useMemo, useState } from 'react';
import * as m from 'motion/react-m';
import { AnimatePresence } from 'motion/react';

import { Button } from '@/components/ui/button';
import { useAhora } from '@/hooks/useDatos';
import { MES } from '@/lib/ui/movimiento';
import { TIPOS } from '@/lib/ui/catalogo';
import { cargar, descargar, esDeLaAgenda } from '@/lib/ui/arrastre';
import { aFecha, hhmm, type Evento, type Fecha } from '@/lib/data';
import type { PeticionEvento } from '@/components/HojaEvento';

const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** El primer y el último día de un mes, en el formato del almacén. */
export function mesEntero(ref: Date): { desde: Fecha; hasta: Fecha } {
  const anio = ref.getFullYear();
  const mes = ref.getMonth();
  return {
    desde: `${anio}-${pad(mes + 1)}-01`,
    hasta: `${anio}-${pad(mes + 1)}-${pad(new Date(anio, mes + 1, 0).getDate())}`,
  };
}

export function MesDeEventos({
  ref_,
  setRef,
  eventos,
  abrirEvento,
  alPulsarDia,
  tareasPorDia,
  cabecera = true,
  leyenda = true,
  compacto = false,
  alMover,
}: {
  ref_: Date;
  setRef: (d: Date) => void;
  /** Ya filtrados por quien llama: este componente no sabe qué es una asignatura. */
  eventos: Evento[];
  abrirEvento: (p: PeticionEvento) => void;
  alPulsarDia?: (clave: Fecha) => void;
  /** Cuántas tareas hay cada día, si quien llama quiere enseñarlas. */
  tareasPorDia?: Record<string, number>;
  cabecera?: boolean;
  leyenda?: boolean;
  /** En una columna estrecha la cabecera se encoge y el botón de crear se va. */
  compacto?: boolean;
  /** Mover un evento a otro día. Sin ella no se puede arrastrar nada. */
  alMover?: (id: string, fecha: Fecha) => void;
}) {
  const ahora = useAhora();
  /* Qué casilla está debajo del cursor. Uno solo y no un booleano por celda: solo puede
     haber una diana encendida, y tenerlo así hace imposible que se queden dos. */
  const [sobre, setSobre] = useState<string | null>(null);
  const anio = ref_.getFullYear();
  const mes = ref_.getMonth();

  const porDia = useMemo(() => {
    const mapa: Record<string, Evento[]> = {};
    eventos.forEach((e) => (mapa[e.fecha] = [...(mapa[e.fecha] ?? []), e]));
    Object.values(mapa).forEach((l) => l.sort((x, y) => (x.hora ?? -1) - (y.hora ?? -1)));
    return mapa;
  }, [eventos]);

  const offset = (new Date(anio, mes, 1).getDay() + 6) % 7;
  const total = new Date(anio, mes + 1, 0).getDate();
  const filas = Math.ceil((offset + total) / 7);
  const primeraCelda = new Date(anio, mes, 1 - offset);
  /* Sin reloj no hay «hoy»: en el servidor no se marca ninguna celda y aparece al hidratar. */
  const hoyClave = ahora ? aFecha(ahora) : null;
  const nombreMes = ref_.toLocaleDateString('es-ES', { month: 'long' });

  /**
   * Hacia dónde viaja el mes al cambiar.
   *
   * Se calcula **durante el render** comparando con el anterior, igual que la dirección de
   * la transición de página en el `Marco`: un efecto llegaría un fotograma tarde y el
   * primer cambio saldría hacia el lado del anterior.
   */
  const clave = `${anio}-${pad(mes + 1)}`;
  const sentido = useSentido(clave);

  const irA = (delta: number) => setRef(new Date(anio, mes + delta, 1));

  return (
    <>
      {cabecera && (
        <div className="cal-cab">
          <h1 className="sem-titulo">
            <span className="rango">{nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)}</span>{' '}
            <span className="anio">{anio}</span>
          </h1>
          <div className="dia-nav">
            <Button variant="outline" size="icon-sm" type="button" aria-label="Mes anterior" onClick={() => irA(-1)}>
              <Flecha dir="izq" />
            </Button>
            <Button variant="outline" size="sm" type="button" onClick={() => setRef(new Date())}>
              Este mes
            </Button>
            <Button variant="outline" size="icon-sm" type="button" aria-label="Mes siguiente" onClick={() => irA(1)}>
              <Flecha dir="der" />
            </Button>
            {!compacto && (
              <Button type="button" style={{ marginLeft: 8 }} onClick={() => abrirEvento({ evento: null, fecha: hoyClave ?? aFecha(new Date()) })}>
                <Mas />
                Nuevo evento
              </Button>
            )}
          </div>
        </div>
      )}

      {/*
        El mes viaja al cambiar de mes, en la dirección en que se navegó.

        Antes no se animaba: `setRef` solo volvía a renderizar y la rejilla se sustituía de
        golpe, al lado de un dock y unas páginas que sí se mueven. `custom` va en los dos
        sitios —en la presencia y en el `m.div`— porque el mes que se va ya no se está
        renderizando y, sin eso, saldría hacia el lado del viaje anterior.
      */}
      <AnimatePresence mode="wait" initial={false} custom={sentido}>
        <m.div
          key={clave}
          className="mes-rejilla"
          role="grid"
          style={{ ['--filas' as string]: filas }}
          variants={MES}
          custom={sentido}
          initial="fuera"
          animate="dentro"
          exit="saliendo"
        >
          {DOW.map((d) => (
            <span className="dow-mes" role="columnheader" key={d}>
              {d}
            </span>
          ))}

          {Array.from({ length: filas * 7 }, (_, i) => {
            const d = new Date(primeraCelda);
            d.setDate(primeraCelda.getDate() + i);
            const dia = aFecha(d);
            const fuera = d.getMonth() !== mes;
            const evs = porDia[dia] ?? [];
            const tareas = tareasPorDia?.[dia] ?? 0;
            return (
              <div
                key={dia}
                role="gridcell"
                className={`celda${fuera ? ' fuera' : ''}${dia === hoyClave ? ' hoy' : ''}${[0, 6].includes(d.getDay()) ? ' finde' : ''}${sobre === dia ? ' diana' : ''}`}
                onClick={alPulsarDia ? () => alPulsarDia(dia) : undefined}
                onDragOver={
                  alMover
                    ? (e) => {
                        if (!esDeLaAgenda(e.dataTransfer)) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        setSobre(dia);
                      }
                    : undefined
                }
                onDragLeave={alMover ? () => setSobre((s) => (s === dia ? null : s)) : undefined}
                onDrop={
                  alMover
                    ? (e) => {
                        e.preventDefault();
                        setSobre(null);
                        const c = descargar(e.dataTransfer);
                        if (c?.que === 'evento') alMover(c.id, dia);
                      }
                    : undefined
                }
              >
                <span className="celda-top">
                  <span className="dia-num">{d.getDate()}</span>
                  <button
                    className="mas-ev"
                    type="button"
                    aria-label="Nuevo evento este día"
                    onClick={(e) => {
                      e.stopPropagation();
                      abrirEvento({ evento: null, fecha: dia });
                    }}
                  >
                    +
                  </button>
                </span>

                {/* Los chips van en su propia caja con overflow: si no caben, se recorta la
                    caja y no el chip, que antes se aplastaba hasta ser ilegible. */}
                <span className="chips-ev">
                  {evs.slice(0, 3).map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      className="chip-ev"
                      draggable={Boolean(alMover)}
                      /* `onDragStartCapture` por costumbre de la casa: donde Motion anima
                         la pieza, declara su propio `onDragStart` y tapa el del DOM. Aquí
                         no lo hace, pero el día que anime un chip no habrá que acordarse. */
                      onDragStartCapture={
                        alMover ? (e) => cargar(e.dataTransfer, { que: 'evento', id: ev.id }) : undefined
                      }
                      title={`${TIPOS[ev.tipo].n} · ${ev.titulo}${ev.materia ? ` · ${ev.materia}` : ''}${alMover ? ' · arrástralo a otro día' : ''}`}
                      style={{ ['--tc' as string]: `var(--c-${TIPOS[ev.tipo].color})` }}
                      onClick={(e) => {
                        e.stopPropagation();
                        abrirEvento({ evento: ev, fecha: dia });
                      }}
                    >
                      <span className="pt" />
                      <span className="txt">
                        {ev.hora !== null && <b>{hhmm(ev.hora)} </b>}
                        {ev.titulo}
                      </span>
                    </button>
                  ))}
                </span>
                {evs.length > 3 && <span className="mas-chips">+{evs.length - 3} más</span>}

                {/* Las tareas no son eventos y no se pintan como ellos: una cuenta discreta
                    al pie. En el calendario grande no se usan —mes y semana están separados
                    a propósito— pero en una asignatura sí, porque ahí no hay «gimnasio» que
                    compita: todo lo que se ve es de esa asignatura. */}
                {tareas > 0 && (
                  <span className="marca-tareas" title={`${tareas} ${tareas === 1 ? 'tarea' : 'tareas'}`}>
                    <i aria-hidden="true" />
                    {tareas}
                  </span>
                )}

                {/* El plan B cuando la celda es baja: un punto por evento. Nunca se corta,
                    cabe siempre y sigue diciendo cuántas cosas hay y de qué tipo. Antes,
                    a esa altura, los eventos simplemente desaparecían sin dejar rastro. */}
                <span className="puntos-ev" aria-hidden="true">
                  {evs.slice(0, 6).map((ev) => (
                    <i key={ev.id} style={{ background: `var(--c-${TIPOS[ev.tipo].color})` }} />
                  ))}
                </span>
              </div>
            );
          })}
        </m.div>
      </AnimatePresence>

      {leyenda && (
        <div className="leyenda-tipos">
          {(['entrega', 'examen', 'presentacion', 'correccion', 'visita'] as const).map((t) => (
            <span key={t}>
              <i style={{ background: `var(--c-${TIPOS[t].color})` }} />
              {TIPOS[t].n}
            </span>
          ))}
          <span style={{ marginLeft: 'auto' }}>
            Toca un día para abrir su agenda · el <b>+</b> añade un evento
          </span>
        </div>
      )}
    </>
  );
}

/**
 * Hacia qué lado se ha movido el mes: 1 hacia delante, -1 hacia atrás.
 *
 * Ajustar estado durante el render comparando con el guardado es el patrón que React
 * documenta justo para esto: no pinta el resultado intermedio, lo vuelve a renderizar antes
 * de llegar a la pantalla. Es el mismo que usa el `Marco` para la dirección de página.
 */
function useSentido(clave: string): 1 | -1 {
  const [visto, setVisto] = useState<{ clave: string; sentido: 1 | -1 }>(() => ({ clave, sentido: 1 }));
  if (visto.clave !== clave) setVisto({ clave, sentido: clave > visto.clave ? 1 : -1 });
  return visto.sentido;
}

function Flecha({ dir }: { dir: 'izq' | 'der' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === 'izq' ? 'm14 6-6 6 6 6' : 'm10 6 6 6-6 6'} />
    </svg>
  );
}

function Mas() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
