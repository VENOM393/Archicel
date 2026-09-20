'use client';

/**
 * El calendario, en dos vistas que viven en la misma página:
 *
 *   Mes    → solo EVENTOS. Lo importante del curso, de un vistazo y sin desplazar.
 *   Semana → solo TAREAS, repartidas por día.
 *
 * Son independientes a propósito: una entrega no compite con "gimnasio". Y la semana es
 * la puerta al día — pulsar la cabecera de una columna abre esa fecha en la agenda, que
 * ya no está en el raíl porque solo se llega desde aquí.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { HojaEvento, type PeticionEvento } from '@/components/HojaEvento';
import { HojaTarea, type PeticionTarea } from '@/components/HojaTarea';
import { Button } from '@/components/ui/button';
import { useEventos, useTareas } from '@/hooks/useDatos';
import { useArchicel } from '@/lib/firebase/sesion';
import { NOMBRE_PROGRESO, aFecha, hhmm, progresoDe, type Evento, type Tarea } from '@/lib/data';
import { Icono, Nivel, TIPOS } from '@/lib/ui/catalogo';

type Modo = 'mes' | 'semana';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** Lo que tarda el panel saliente en apagarse. Debe coincidir con `calOut` en el CSS. */
const SALIDA = 200;

export default function Calendario() {
  const [modo, setModo] = useState<Modo>('mes');
  const [saliendo, setSaliendo] = useState(false);
  const [ref, setRef] = useState(() => new Date());
  const [hoja, setHoja] = useState<PeticionEvento | null>(null);
  const [hojaTarea, setHojaTarea] = useState<PeticionTarea | null>(null);
  const relevo = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * El cambio de vista es un relevo, no un corte: la que se va se apaga hacia el
   * desenfoque y solo entonces entra la otra. Dos fases en vez de un cruce porque ambas
   * ocupan el mismo hueco y superponerlas las mezcla.
   *
   * `key={modo}` remonta el contenedor, y ahí está el detalle que cuesta una tarde: sin
   * el remonte, la clase de salida con `forwards` sostiene `opacity:0` sobre el panel
   * **nuevo** y la vista queda en negro con el DOM perfectamente correcto.
   */
  const cambiarModo = (m: Modo) => {
    if (m === modo || saliendo) return;
    setSaliendo(true);
    relevo.current = setTimeout(() => {
      setModo(m);
      setSaliendo(false);
    }, SALIDA);
  };

  useEffect(() => () => {
    if (relevo.current) clearTimeout(relevo.current);
  }, []);

  return (
    <>
      <section className="vista on" aria-label="Calendario">
        <div className="sem-top">
          {/* Un `tablist` promete dos cosas: que cada pestaña gobierna un panel concreto
              y que las flechas se mueven entre ellas. Declararlo sin cumplirlas deja al
              lector de pantalla anunciando algo que no existe, así que van las dos. */}
          <div
            className="seg"
            role="tablist"
            aria-label="Vista del calendario"
            onKeyDown={(e) => {
              if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
              e.preventDefault();
              const otro: Modo = modo === 'mes' ? 'semana' : 'mes';
              cambiarModo(otro);
              document.getElementById(`tab-${otro}`)?.focus();
            }}
          >
            <span className="seg-pill" style={{ transform: `translateX(${modo === 'mes' ? 0 : 100}%)` }} />
            {(['mes', 'semana'] as const).map((m) => (
              <button
                key={m}
                id={`tab-${m}`}
                type="button"
                role="tab"
                aria-selected={modo === m}
                aria-controls="cal-panel"
                /* dentro de un tablist se navega con flechas, no con Tab */
                tabIndex={modo === m ? 0 : -1}
                onClick={() => cambiarModo(m)}
              >
                {m === 'mes' ? 'Mes' : 'Semana'}
              </button>
            ))}
          </div>
          <span className="seg-nota">
            {modo === 'mes' ? 'entregas, exámenes y correcciones' : 'tus tareas · toca un día para abrirlo'}
          </span>
        </div>

        <div
          className={`cal-panel${saliendo ? ' sale' : ''}`}
          key={modo}
          id="cal-panel"
          role="tabpanel"
          aria-labelledby={`tab-${modo}`}
          aria-busy={saliendo}
        >
          {modo === 'mes' ? (
            <VistaMes ref_={ref} setRef={setRef} abrirEvento={setHoja} />
          ) : (
            <VistaSemana ref_={ref} setRef={setRef} abrirTarea={setHojaTarea} />
          )}
        </div>
      </section>

      <HojaEvento peticion={hoja} cerrar={() => setHoja(null)} />
      <HojaTarea peticion={hojaTarea} cerrar={() => setHojaTarea(null)} />
    </>
  );
}

/* ═══════════════════ MES · solo eventos ═══════════════════ */

function VistaMes({
  ref_,
  setRef,
  abrirEvento,
}: {
  ref_: Date;
  setRef: (d: Date) => void;
  abrirEvento: (p: PeticionEvento) => void;
}) {
  const router = useRouter();
  const anio = ref_.getFullYear();
  const mes = ref_.getMonth();
  const primero = `${anio}-${pad(mes + 1)}-01`;
  const ultimo = `${anio}-${pad(mes + 1)}-${pad(new Date(anio, mes + 1, 0).getDate())}`;
  const eventos = useEventos({ desde: primero, hasta: ultimo });

  const porDia = useMemo(() => {
    const m: Record<string, Evento[]> = {};
    eventos.forEach((e) => (m[e.fecha] = [...(m[e.fecha] ?? []), e]));
    Object.values(m).forEach((l) => l.sort((a, b) => (a.hora ?? -1) - (b.hora ?? -1)));
    return m;
  }, [eventos]);

  const offset = (new Date(anio, mes, 1).getDay() + 6) % 7;
  const total = new Date(anio, mes + 1, 0).getDate();
  const filas = Math.ceil((offset + total) / 7);
  const primeraCelda = new Date(anio, mes, 1 - offset);
  const hoyClave = aFecha(new Date());
  const nombreMes = ref_.toLocaleDateString('es-ES', { month: 'long' });

  return (
    <>
      <div className="cal-cab">
        <h1 className="sem-titulo">
          <span className="rango">{nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)}</span>{' '}
          <span className="anio">{anio}</span>
        </h1>
        <div className="dia-nav">
          <Button variant="outline" size="icon-sm" type="button" aria-label="Mes anterior" onClick={() => setRef(new Date(anio, mes - 1, 1))}>
            <Flecha dir="izq" />
          </Button>
          <Button variant="outline" size="sm" type="button" onClick={() => setRef(new Date())}>
            Este mes
          </Button>
          <Button variant="outline" size="icon-sm" type="button" aria-label="Mes siguiente" onClick={() => setRef(new Date(anio, mes + 1, 1))}>
            <Flecha dir="der" />
          </Button>
          <Button type="button" style={{ marginLeft: 8 }} onClick={() => abrirEvento({ evento: null, fecha: hoyClave })}>
            <Mas />
            Nuevo evento
          </Button>
        </div>
      </div>

      <div className="mes-rejilla" role="grid" style={{ ['--filas' as string]: filas }}>
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
          <span className="dow-mes" role="columnheader" key={d}>
            {d}
          </span>
        ))}

        {Array.from({ length: filas * 7 }, (_, i) => {
          const d = new Date(primeraCelda);
          d.setDate(primeraCelda.getDate() + i);
          const clave = aFecha(d);
          const fuera = d.getMonth() !== mes;
          const evs = porDia[clave] ?? [];
          return (
            <div
              key={clave}
              role="gridcell"
              className={`celda${fuera ? ' fuera' : ''}${clave === hoyClave ? ' hoy' : ''}${[0, 6].includes(d.getDay()) ? ' finde' : ''}`}
              onClick={() => router.push(`/dia?f=${clave}`)}
            >
              <span className="celda-top">
                <span className="dia-num">{d.getDate()}</span>
                <button
                  className="mas-ev"
                  type="button"
                  aria-label="Nuevo evento este día"
                  onClick={(e) => {
                    e.stopPropagation();
                    abrirEvento({ evento: null, fecha: clave });
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
                  title={`${TIPOS[ev.tipo].n} · ${ev.titulo}${ev.materia ? ` · ${ev.materia}` : ''}`}
                  style={{ ['--tc' as string]: `var(--c-${TIPOS[ev.tipo].color})` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    abrirEvento({ evento: ev, fecha: clave });
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
      </div>

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
    </>
  );
}


/* ═══════════════════ SEMANA · solo tareas ═══════════════════ */

/**
 * Siete cajetines, uno por día, con las tareas de cada uno.
 *
 * Es además la única puerta a la agenda del día: la cabecera de cada columna abre esa
 * fecha. Pulsar una tarea la edita aquí mismo, y el `+ tarea` del pie la crea sin salir
 * de la semana — crear no es navegar.
 */
function VistaSemana({
  ref_,
  setRef,
  abrirTarea,
}: {
  ref_: Date;
  setRef: (d: Date) => void;
  abrirTarea: (p: PeticionTarea) => void;
}) {
  const router = useRouter();
  const { almacen } = useArchicel();

  const lunes = useMemo(() => {
    const l = new Date(ref_);
    l.setDate(ref_.getDate() - ((ref_.getDay() + 6) % 7));
    l.setHours(0, 0, 0, 0);
    return l;
  }, [ref_]);

  const domingo = useMemo(() => {
    const d = new Date(lunes);
    d.setDate(lunes.getDate() + 6);
    return d;
  }, [lunes]);

  const tareas = useTareas({ desde: aFecha(lunes), hasta: aFecha(domingo) });

  const porDia = useMemo(() => {
    const m: Record<string, Tarea[]> = {};
    tareas.forEach((t) => (m[t.fecha] = [...(m[t.fecha] ?? []), t]));
    return m;
  }, [tareas]);

  /* la casilla alterna entre hecha y sin empezar; los demás estados se eligen en la hoja */
  const marcar = (t: Tarea) => {
    const hecha = progresoDe(t) !== 'hecha';
    almacen.tareas.guardar({ ...t, hecha, progreso: hecha ? 'hecha' : 'sin-empezar' }).catch(() => {});
  };

  const mover = (semanas: number) => {
    const x = new Date(lunes);
    x.setDate(lunes.getDate() + semanas * 7);
    setRef(x);
  };

  const hoyClave = aFecha(new Date());
  const mismoMes = lunes.getMonth() === domingo.getMonth();
  const rango = mismoMes
    ? `${lunes.getDate()} – ${domingo.getDate()} de ${domingo.toLocaleDateString('es-ES', { month: 'long' })}`
    : `${lunes.getDate()} de ${lunes.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')} – ${domingo.getDate()} de ${domingo.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')}`;

  return (
    <>
      <div className="cal-cab">
        <h1 className="sem-titulo">
          <span className="rango">{rango.charAt(0).toUpperCase() + rango.slice(1)}</span>{' '}
          <span className="anio">{domingo.getFullYear()}</span>
        </h1>
        <div className="dia-nav">
          <Button variant="outline" size="icon-sm" type="button" aria-label="Semana anterior" onClick={() => mover(-1)}>
            <Flecha dir="izq" />
          </Button>
          <Button variant="outline" size="sm" type="button" onClick={() => setRef(new Date())}>
            Esta semana
          </Button>
          <Button variant="outline" size="icon-sm" type="button" aria-label="Semana siguiente" onClick={() => mover(1)}>
            <Flecha dir="der" />
          </Button>
        </div>
      </div>

      <div className="semana-rejilla">
        {Array.from({ length: 7 }, (_, i) => {
          const d = new Date(lunes);
          d.setDate(lunes.getDate() + i);
          const clave = aFecha(d);
          const lista = porDia[clave] ?? [];
          const hechas = lista.filter((t) => progresoDe(t) === 'hecha').length;
          return (
            <div
              key={clave}
              className={`col-sem${clave === hoyClave ? ' es-hoy' : ''}${i > 4 ? ' finde' : ''}`}
              style={{ ['--d' as string]: i }}
            >
              {/* la cabecera es la puerta al día: la agenda ya no vive en el raíl */}
              <button
                className="col-cab"
                type="button"
                title={`Abrir la agenda del ${d.getDate()}`}
                onClick={() => router.push(`/dia?f=${clave}`)}
              >
                <span className="dw">{['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'][i]}</span>
                <span className="dn">{d.getDate()}</span>
              </button>

              <div className="col-tareas">
                {lista.map((t) => {
                  const g = progresoDe(t);
                  return (
                    <article
                      key={t.id}
                      className={`tarea-sem prog-${g}`}
                      title={`${t.titulo} · ${NOMBRE_PROGRESO[g]}`}
                      style={{ ['--tc' as string]: `var(--c-${t.color})` }}
                      onClick={() => abrirTarea({ tarea: t, fecha: clave })}
                    >
                      <button
                        className="ts-marca"
                        type="button"
                        aria-label={g === 'hecha' ? 'Marcar como pendiente' : 'Marcar como hecha'}
                        onClick={(e) => {
                          e.stopPropagation();
                          marcar(t);
                        }}
                      >
                        <Icono nombre={t.icono} tam={12} />
                      </button>
                      <span className="ts-cuerpo">
                        <span className="ts-tit">{t.titulo}</span>
                        <span className="ts-hora">{hhmm(t.ini)}</span>
                      </span>
                      <Nivel prio={t.prio} tam={10} />
                    </article>
                  );
                })}
              </div>

              <button
                className="col-pie"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  abrirTarea({ tarea: null, fecha: clave });
                }}
              >
                {lista.length ? (
                  <>
                    <span className="pt" />
                    {hechas}/{lista.length}
                  </>
                ) : (
                  <span className="mas">+ tarea</span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="leyenda-tipos">
        <span style={{ marginLeft: 'auto' }}>
          Toca el día para abrir su agenda · el <b>+</b> añade una tarea
        </span>
      </div>
    </>
  );
}

/* ═══════════════════ piezas sueltas ═══════════════════ */

/** La flecha de navegar mes, en los dos sentidos. */
function Flecha({ dir }: { dir: 'izq' | 'der' }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === 'izq' ? 'm14 6-6 6 6 6' : 'm10 6 6 6-6 6'} />
    </svg>
  );
}

/** El signo de añadir, con el mismo trazo que el resto del chrome. */
function Mas() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
