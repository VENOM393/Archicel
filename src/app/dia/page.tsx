'use client';

/**
 * La agenda del día, de hora a hora.
 *
 * Arriba, los eventos importantes de esa fecha; debajo, las tareas colocadas en su franja.
 * Tocar un hueco crea una tarea a esa hora.
 */

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { HojaEvento, type PeticionEvento } from '@/components/HojaEvento';
import { HojaTarea, type PeticionTarea } from '@/components/HojaTarea';
import { Marco } from '@/components/Marco';
import { useEventos, useTareas } from '@/hooks/useDatos';
import { useArchicel } from '@/lib/firebase/sesion';
import { aFecha, hhmm, type Prioridad, type Tarea } from '@/lib/data';
import { ALTO_HORA, DIA_FIN, DIA_INICIO, Icono, TIPOS } from '@/lib/ui/catalogo';

export default function PaginaDia() {
  return (
    <Suspense fallback={<Marco><div /></Marco>}>
      <Dia />
    </Suspense>
  );
}

function Dia() {
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
        .filter((t) => !(ocultarHechas && t.hecha))
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

  const marcar = (t: Tarea) => almacen.tareas.guardar({ ...t, hecha: !t.hecha }).catch(() => {});

  const mesTxt = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  return (
    <Marco>
      <section className="vista on" id="view-dia" aria-label="Agenda del día">
        <div className="dia-top">
          <div className="dia-fecha">
            <span className="num">{d.getDate()}</span>
            <span className="txt">
              <span className="dow">{d.toLocaleDateString('es-ES', { weekday: 'long' })}</span>
              <span className="mes">{mesTxt.charAt(0).toUpperCase() + mesTxt.slice(1)}</span>
            </span>
          </div>
          <div className="dia-nav">
            <button className="nav-ico" type="button" aria-label="Día anterior" onClick={() => mover(-1)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m14 6-6 6 6 6" />
              </svg>
            </button>
            <button className="hoy-btn" type="button" onClick={() => setFechaSel(aFecha(new Date()))}>
              Hoy
            </button>
            <button className="nav-ico" type="button" aria-label="Día siguiente" onClick={() => mover(1)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m10 6 6 6-6 6" />
              </svg>
            </button>
          </div>
        </div>

        <div className="semana">
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
        </div>

        {eventos.length > 0 && (
          <div className="eventos-dia">
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
          </div>
        )}

        <div className="filtros">
          <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(['todas', 'alta', 'media', 'baja'] as const).map((p) => (
              <button
                key={p}
                type="button"
                className={`chip${filtro === p ? ' on' : ''}`}
                onClick={() => setFiltro(p)}
              >
                {p !== 'todas' && (
                  <i className="pt" style={{ background: `var(--c-${p === 'alta' ? 'rojo' : p === 'media' ? 'ambar' : 'menta'})` }} />
                )}
                {p === 'todas' ? 'Todas' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </span>
          <button
            type="button"
            className={`chip${ocultarHechas ? ' on' : ''}`}
            onClick={() => setOcultarHechas((v) => !v)}
          >
            {ocultarHechas ? 'Solo pendientes' : 'Ocultar hechas'}
          </button>
          <span className="sep" />
          <button
            className="add-btn"
            type="button"
            onClick={() => setHojaTarea({ tarea: null, fecha: fechaSel })}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nueva tarea
          </button>
        </div>

        <div className="agenda">
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
                    className={`tarea${t.hecha ? ' hecha' : ''}${t.fin - t.ini <= 45 ? ' corta' : ''}`}
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
                    {t.prio === 'alta' && <span className="prio" title="Prioridad alta" />}
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
        </div>
      </section>

      <HojaTarea peticion={hojaTarea} cerrar={() => setHojaTarea(null)} />
      <HojaEvento peticion={hojaEvento} cerrar={() => setHojaEvento(null)} />
    </Marco>
  );
}
