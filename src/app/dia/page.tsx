'use client';

/**
 * La agenda del día, de hora a hora.
 *
 * Arriba, los eventos importantes de esa fecha; debajo, las tareas colocadas en su franja.
 * Tocar un hueco crea una tarea a esa hora.
 */

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import * as m from 'motion/react-m';

import { ORQUESTA, PIEZA } from '@/lib/ui/movimiento';

import { HojaEvento, type PeticionEvento } from '@/components/HojaEvento';
import { HojaTarea, type PeticionTarea } from '@/components/HojaTarea';
import { Button } from '@/components/ui/button';
import { useEventos, useTareas } from '@/hooks/useDatos';
import { useArchicel } from '@/lib/firebase/sesion';
import { NOMBRE_PROGRESO, aFecha, hhmm, progresoDe, type Prioridad, type Tarea } from '@/lib/data';
import { ALTO_HORA, DIA_FIN, DIA_INICIO, Icono, Nivel, TIPOS } from '@/lib/ui/catalogo';

export default function PaginaDia() {
  return (
    <Suspense fallback={<div />}>
      <Dia />
    </Suspense>
  );
}

function Dia() {
  const router = useRouter();
  const params = useSearchParams();
  const inicial = params.get('f');
  const [fechaSel, setFechaSel] = useState<string>(inicial ?? aFecha(new Date()));
  const [filtro, setFiltro] = useState<'todas' | Prioridad>('todas');
  const [ocultarHechas, setOcultarHechas] = useState(false);
  const [hojaTarea, setHojaTarea] = useState<PeticionTarea | null>(null);
  const [hojaEvento, setHojaEvento] = useState<PeticionEvento | null>(null);
  const { almacen } = useArchicel();

  const d = useMemo(() => {
    const [a, m, dd] = fechaSel.split('-').map(Number);
    return new Date(a, m - 1, dd);
  }, [fechaSel]);

  const lunes = useMemo(() => {
    const l = new Date(d);
    l.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return l;
  }, [d]);
  const domingo = useMemo(() => {
    const x = new Date(lunes);
    x.setDate(lunes.getDate() + 6);
    return x;
  }, [lunes]);

  const tareasSemana = useTareas({ desde: aFecha(lunes), hasta: aFecha(domingo) });
  const eventos = useEventos({ desde: fechaSel, hasta: fechaSel });

  const tareas = useMemo(
    () =>
      tareasSemana
        .filter((t) => t.fecha === fechaSel)
        .filter((t) => filtro === 'todas' || t.prio === filtro)
        .filter((t) => !(ocultarHechas && progresoDe(t) === 'hecha'))
        .sort((a, b) => a.ini - b.ini),
    [tareasSemana, fechaSel, filtro, ocultarHechas],
  );

  /* reparto de ancho cuando dos tareas se pisan */
  const grupos = useMemo(() => {
    const g: Tarea[][] = [];
    tareas.forEach((t) => {
      const enc = g.find((gr) => gr.some((o) => t.ini < o.fin && t.fin > o.ini));
      if (enc) enc.push(t);
      else g.push([t]);
    });
    return g;
  }, [tareas]);

  const ahora = new Date();
  const esHoy = fechaSel === aFecha(ahora);
  const minAhora = ahora.getHours() * 60 + ahora.getMinutes();

  const mover = (dias: number) => {
    const x = new Date(d);
    x.setDate(d.getDate() + dias);
    setFechaSel(aFecha(x));
  };

  /* la casilla alterna entre hecha y sin empezar; los demás estados se eligen en la hoja */
  const marcar = (t: Tarea) => {
    const hecha = progresoDe(t) !== 'hecha';
    almacen.tareas.guardar({ ...t, hecha, progreso: hecha ? 'hecha' : 'sin-empezar' }).catch(() => {});
  };

  const mesTxt = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  /**
   * La agenda se abre donde está el día, no en su primera hora.
   *
   * Empezar siempre a las 06:00 obliga a desplazar a mano cada vez que se entra, y en un
   * móvil eso es media pantalla de horas vacías antes de ver nada. Se aterriza una hora
   * antes de lo que importa: la hora actual si es hoy, o la primera tarea si no.
   *
   * Sin animación: no es un movimiento que la usuaria haya pedido, es el sitio correcto
   * desde el principio, y verlo deslizarse solo lo haría parecer un error.
   */
  const agenda = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const nodo = agenda.current;
    if (!nodo) return;
    const foco = esHoy ? minAhora : tareas[0]?.ini;
    if (foco === undefined) return;
    const y = ((foco - 60) / 60 - DIA_INICIO) * ALTO_HORA;
    nodo.scrollTop = Math.max(0, y);
    /* solo al cambiar de día: mientras se edita, el desplazamiento es de la usuaria */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaSel]);

  return (
    <>
      {/* Cinco piezas que llegan en el orden en que se leen: la fecha, la semana, los
          eventos del día, los filtros y la agenda. Ninguna declara cuándo: heredan el
          estado del envoltorio de página y `ORQUESTA` las reparte. */}
      <m.section className="vista on" variants={ORQUESTA} id="view-dia" aria-label="Agenda del día">
        <m.div className="dia-top" variants={PIEZA}>
          <h1 className="dia-fecha">
            <span className="num">{d.getDate()}</span>{' '}
            <span className="txt">
              <span className="dow">{d.toLocaleDateString('es-ES', { weekday: 'long' })}</span>{' '}
              <span className="mes">{mesTxt.charAt(0).toUpperCase() + mesTxt.slice(1)}</span>
            </span>
          </h1>
          <div className="dia-nav">
            {/* La agenda ya no está en el raíl: se entra desde la semana, así que tiene
                que haber una salida de vuelta que no dependa de recordar el camino. */}
            <Button variant="ghost" size="sm" type="button" onClick={() => router.push("/calendario")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m14 6-6 6 6 6" />
              </svg>
              Semana
            </Button>
            <Button variant="outline" size="icon-sm" type="button" aria-label="Día anterior" onClick={() => mover(-1)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m14 6-6 6 6 6" />
              </svg>
            </Button>
            <Button variant="outline" size="sm" type="button" onClick={() => setFechaSel(aFecha(new Date()))}>
              Hoy
            </Button>
            <Button variant="outline" size="icon-sm" type="button" aria-label="Día siguiente" onClick={() => mover(1)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m10 6 6 6-6 6" />
              </svg>
            </Button>
          </div>
        </m.div>

        <m.div className="semana" variants={PIEZA}>
          {Array.from({ length: 7 }, (_, i) => {
            const x = new Date(lunes);
            x.setDate(lunes.getDate() + i);
            const clave = aFecha(x);
            const puntos = tareasSemana.filter((t) => t.fecha === clave).slice(0, 3);
            return (
              <button
                key={clave}
                type="button"
                className={`sem-dia${clave === fechaSel ? ' sel' : ''}${clave === aFecha(ahora) ? ' hoy' : ''}`}
                onClick={() => setFechaSel(clave)}
              >
                <span className="d">{['L', 'M', 'X', 'J', 'V', 'S', 'D'][i]}</span>
                <span className="n">{x.getDate()}</span>
                <span className="pts">
                  {puntos.map((t) => (
                    <i key={t.id} style={{ background: `var(--c-${t.color})` }} />
                  ))}
                </span>
              </button>
            );
          })}
        </m.div>

        {eventos.length > 0 && (
          <m.div className="eventos-dia" variants={PIEZA}>
            {eventos.map((ev, i) => (
              <button
                key={ev.id}
                type="button"
                className="ev-dia"
                style={{ ['--tc' as string]: `var(--c-${TIPOS[ev.tipo].color})`, animationDelay: `${i * 60}ms` }}
                onClick={() => setHojaEvento({ evento: ev, fecha: fechaSel })}
              >
                <span className="ev-ico">
                  <Icono nombre={TIPOS[ev.tipo].icono} tam={13} />
                </span>
                <span className="ev-tipo">{TIPOS[ev.tipo].n}</span>
                <span className="ev-tit">{ev.titulo}</span>
                {ev.hora !== null && <span className="ev-hora">{hhmm(ev.hora)}</span>}
              </button>
            ))}
          </m.div>
        )}

        {/* Filtrar no es actuar. Estos botones eran cápsulas ámbar idénticas al de crear,
            así que la pantalla tenía cinco llamadas de la misma fuerza y ninguna guiaba.
            Ahora el filtro activo se marca con contorno y el resto son fantasma: la única
            pieza sólida de la pantalla es la que crea algo. */}
        <m.div className="filtros" variants={PIEZA} role="group" aria-label="Filtros de la agenda">
          <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(['todas', 'alta', 'media', 'baja'] as const).map((p) => (
              <Button
                key={p}
                type="button"
                variant={filtro === p ? 'outline' : 'ghost'}
                aria-pressed={filtro === p}
                className={filtro === p ? 'filtro-on' : undefined}
                onClick={() => setFiltro(p)}
              >
                {p !== 'todas' && (
                  <i className="pt" style={{ background: `var(--c-${p === 'alta' ? 'rojo' : p === 'media' ? 'ambar' : 'menta'})` }} />
                )}
                {p === 'todas' ? 'Todas' : p.charAt(0).toUpperCase() + p.slice(1)}
              </Button>
            ))}
          </span>
          <Button
            type="button"
            variant={ocultarHechas ? 'outline' : 'ghost'}
            aria-pressed={ocultarHechas}
            className={ocultarHechas ? 'filtro-on' : undefined}
            onClick={() => setOcultarHechas((v) => !v)}
          >
            {ocultarHechas ? 'Solo pendientes' : 'Ocultar hechas'}
          </Button>
          <span className="sep" />
          <Button
            type="button"
            onClick={() => setHojaTarea({ tarea: null, fecha: fechaSel })}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nueva tarea
          </Button>
        </m.div>

        <m.div className="agenda" variants={PIEZA} ref={agenda}>
          <div className="horas">
            {Array.from({ length: DIA_FIN - DIA_INICIO }, (_, i) => {
              const h = DIA_INICIO + i;
              return (
                <div className="hora" key={h}>
                  <span className="et">{String(h).padStart(2, '0')}:00</span>
                  <span
                    className="hueco"
                    onClick={() => setHojaTarea({ tarea: null, fecha: fechaSel, desde: h * 60 })}
                  />
                </div>
              );
            })}
          </div>

          <div className="capa-tareas">
            {grupos.map((grupo) =>
              grupo.map((t, i) => {
                const top = ((t.ini - DIA_INICIO * 60) / 60) * ALTO_HORA;
                const alto = Math.max(26, ((t.fin - t.ini) / 60) * ALTO_HORA - 4);
                return (
                  <article
                    key={t.id}
                    className={`tarea prog-${progresoDe(t)}${progresoDe(t) === 'hecha' ? ' hecha' : ''}${t.fin - t.ini <= 45 ? ' corta' : ''}`}
                    title={`${t.titulo} · ${NOMBRE_PROGRESO[progresoDe(t)]}`}
                    style={{
                      ['--tc' as string]: `var(--c-${t.color})`,
                      top,
                      height: alto,
                      left: `${i * (100 / grupo.length)}%`,
                      width: `calc(${100 / grupo.length}% - 6px)`,
                      animationDelay: `${Math.min(i * 30 + grupo.length * 10, 180)}ms`,
                    }}
                    onClick={() => setHojaTarea({ tarea: t, fecha: fechaSel })}
                  >
                    <span
                      className="marca"
                      onClick={(e) => {
                        e.stopPropagation();
                        marcar(t);
                      }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m5 12.5 4.5 4.5L19 7" />
                      </svg>
                    </span>
                    <span className="ico">
                      <Icono nombre={t.icono} tam={14} />
                    </span>
                    <span className="cuerpo">
                      <span className="tit">{t.titulo}</span>
                      <span className="rango">
                        {hhmm(t.ini)} – {hhmm(t.fin)}
                      </span>
                    </span>
                    <Nivel prio={t.prio} tam={11} />
                  </article>
                );
              }),
            )}
          </div>

          {esHoy && minAhora >= DIA_INICIO * 60 && minAhora <= DIA_FIN * 60 && (
            <div className="ahora" style={{ top: ((minAhora - DIA_INICIO * 60) / 60) * ALTO_HORA }} />
          )}

          {tareas.length === 0 && (
            <div className="vacio" style={{ display: 'grid' }}>
              Nada planificado todavía.
              <br />
              Toca una hora para añadir algo.
            </div>
          )}
        </m.div>
      </m.section>

      <HojaTarea peticion={hojaTarea} cerrar={() => setHojaTarea(null)} />
      <HojaEvento peticion={hojaEvento} cerrar={() => setHojaEvento(null)} />
    </>
  );
}
