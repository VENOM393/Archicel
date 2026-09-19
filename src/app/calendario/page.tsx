'use client';

/**
 * El mes entero, sin scroll.
 *
 * La rejilla se come el alto que queda de pantalla y reparte sus filas a partes iguales,
 * sean cuatro, cinco o seis. Tocar un día abre su agenda; el + de cada celda crea un evento.
 */

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { HojaEvento, type PeticionEvento } from '@/components/HojaEvento';
import { Marco } from '@/components/Marco';
import { useEventos, useTareas } from '@/hooks/useDatos';
import { aFecha, hhmm, type Evento } from '@/lib/data';
import { TIPOS } from '@/lib/ui/catalogo';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export default function Calendario() {
  const router = useRouter();
  const [mesRef, setMesRef] = useState(() => new Date());
  const [hoja, setHoja] = useState<PeticionEvento | null>(null);

  const anio = mesRef.getFullYear();
  const mes = mesRef.getMonth();
  const primero = `${anio}-${pad(mes + 1)}-01`;
  const ultimo = `${anio}-${pad(mes + 1)}-${pad(new Date(anio, mes + 1, 0).getDate())}`;

  const eventos = useEventos({ desde: primero, hasta: ultimo });
  const tareas = useTareas({ desde: primero, hasta: ultimo });

  const porDia = useMemo(() => {
    const m: Record<string, Evento[]> = {};
    eventos.forEach((e) => {
      (m[e.fecha] = m[e.fecha] ?? []).push(e);
    });
    Object.values(m).forEach((lista) =>
      lista.sort((a, b) => (a.hora ?? -1) - (b.hora ?? -1)),
    );
    return m;
  }, [eventos]);

  const tareasPorDia = useMemo(() => {
    const m: Record<string, number> = {};
    tareas.forEach((t) => {
      m[t.fecha] = (m[t.fecha] ?? 0) + 1;
    });
    return m;
  }, [tareas]);

  const offset = (new Date(anio, mes, 1).getDay() + 6) % 7;
  const total = new Date(anio, mes + 1, 0).getDate();
  const filas = Math.ceil((offset + total) / 7);
  const primeraCelda = new Date(anio, mes, 1 - offset);
  const hoyClave = aFecha(new Date());

  const celdas = Array.from({ length: filas * 7 }, (_, i) => {
    const d = new Date(primeraCelda);
    d.setDate(primeraCelda.getDate() + i);
    return { fecha: d, clave: aFecha(d), fuera: d.getMonth() !== mes };
  });

  const nombreMes = mesRef.toLocaleDateString('es-ES', { month: 'long' });

  return (
    <Marco>
      <section className="vista on" id="view-mes" aria-label="Mes">
        <div className="sem-top">
          <div className="sem-titulo">
            <span className="rango">{nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)}</span>
            <span className="anio">{anio}</span>
          </div>
          <div className="dia-nav">
            <button className="nav-ico" type="button" aria-label="Mes anterior" onClick={() => setMesRef(new Date(anio, mes - 1, 1))}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m14 6-6 6 6 6" />
              </svg>
            </button>
            <button className="hoy-btn" type="button" onClick={() => setMesRef(new Date())}>
              Este mes
            </button>
            <button className="nav-ico" type="button" aria-label="Mes siguiente" onClick={() => setMesRef(new Date(anio, mes + 1, 1))}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m10 6 6 6-6 6" />
              </svg>
            </button>
            <button
              className="add-btn"
              type="button"
              style={{ marginLeft: 8 }}
              onClick={() => setHoja({ evento: null, fecha: hoyClave })}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Nuevo evento
            </button>
          </div>
        </div>

        <div className="mes-rejilla" role="grid" style={{ ['--filas' as string]: filas }}>
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
            <span className="dow-mes" role="columnheader" key={d}>
              {d}
            </span>
          ))}

          {celdas.map((c, i) => {
            const evs = porDia[c.clave] ?? [];
            const nT = tareasPorDia[c.clave] ?? 0;
            return (
              <div
                key={c.clave}
                role="gridcell"
                className={`celda${c.fuera ? ' fuera' : ''}${c.clave === hoyClave ? ' hoy' : ''}${[0, 6].includes(c.fecha.getDay()) ? ' finde' : ''}`}
                onClick={() => router.push(`/dia?f=${c.clave}`)}
              >
                <span className="celda-top">
                  <span className="dia-num">{c.fecha.getDate()}</span>
                  <button
                    className="mas-ev"
                    type="button"
                    aria-label="Nuevo evento este día"
                    onClick={(e) => {
                      e.stopPropagation();
                      setHoja({ evento: null, fecha: c.clave });
                    }}
                  >
                    +
                  </button>
                </span>

                {evs.slice(0, 3).map((ev, k) => (
                  <button
                    key={ev.id}
                    type="button"
                    className="chip-ev"
                    title={`${TIPOS[ev.tipo].n} · ${ev.titulo}${ev.materia ? ` · ${ev.materia}` : ''}`}
                    style={{
                      ['--tc' as string]: `var(--c-${TIPOS[ev.tipo].color})`,
                      animationDelay: `${Math.min(i * 6 + k * 30, 200)}ms`,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setHoja({ evento: ev, fecha: c.clave });
                    }}
                  >
                    <span className="pt" />
                    <span className="txt">
                      {ev.hora !== null && <b>{hhmm(ev.hora)} </b>}
                      {ev.titulo}
                    </span>
                  </button>
                ))}
                {evs.length > 3 && <span className="mas-chips">+{evs.length - 3} más</span>}

                {nT > 0 && (
                  <span className="marca-tareas" title={`${nT} ${nT === 1 ? 'tarea' : 'tareas'} ese día`}>
                    <i />
                    {nT}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="leyenda-tipos">
          <span>
            <i style={{ background: 'var(--c-ambar)' }} />
            Entrega
          </span>
          <span>
            <i style={{ background: 'var(--c-rojo)' }} />
            Examen
          </span>
          <span>
            <i style={{ background: 'var(--c-violeta)' }} />
            Presentación
          </span>
          <span>
            <i style={{ background: 'var(--c-cian)' }} />
            Corrección
          </span>
          <span>
            <i style={{ background: 'var(--c-verde)' }} />
            Visita
          </span>
          <span style={{ marginLeft: 'auto' }}>
            Toca un día para ver sus horas · el <b>+</b> añade un evento
          </span>
        </div>
      </section>

      <HojaEvento peticion={hoja} cerrar={() => setHoja(null)} />
    </Marco>
  );
}
