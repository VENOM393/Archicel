'use client';

/**
 * El horario de clases del cuatrimestre.
 *
 * Una rejilla de cinco días por las horas que realmente tienen clase — la franja sale de
 * los datos, así que si un día entra una clase a las ocho la rejilla crece sola y nadie
 * tiene que acordarse de cambiar un número.
 *
 * Los datos viven en `lib/data/curso.ts`: esta página solo los coloca. Y el color de cada
 * bloque es el de su asignatura, el mismo que llevará una tarea de esa asignatura en el
 * calendario, para que una mancha naranja signifique Geometría en toda la aplicación.
 */

import { useMemo } from 'react';
import * as mo from 'motion/react-m';

import { ORQUESTA, PIEZA } from '@/lib/ui/movimiento';

import { useAhora } from '@/hooks/useDatos';
import { ASIGNATURAS, CLAVES_ASIGNATURA, HORARIO, franjaDelHorario, hhmm, type Clase } from '@/lib/data';

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes'] as const;

/** Alto de una hora en la rejilla. Todo lo demás se calcula a partir de esto. */
const ALTO_HORA = 92;

export default function Horario() {
  const { desde, hasta } = useMemo(() => franjaDelHorario(), []);
  const horas = useMemo(
    () => Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i),
    [desde, hasta],
  );

  /* para señalar el día en curso y la clase que está ocurriendo ahora mismo */
  const ahora = useAhora(60_000);
  const diaHoy = ahora ? ((ahora.getDay() + 6) % 7) + 1 : 0;
  const minutosAhora = ahora ? ahora.getHours() * 60 + ahora.getMinutes() : -1;

  const porDia = useMemo(() => {
    const m: Record<number, Clase[]> = {};
    HORARIO.forEach((c) => (m[c.dia] = [...(m[c.dia] ?? []), c]));
    Object.values(m).forEach((l) => l.sort((a, b) => a.ini - b.ini));
    return m;
  }, []);

  const totalHoras = HORARIO.reduce((s, c) => s + (c.fin - c.ini), 0) / 60;

  /* Tres piezas en orden de lectura: el título, la rejilla y la leyenda de colores.
     Ninguna declara cuándo entra: heredan el estado del envoltorio de página del Marco y
     `ORQUESTA` las reparte. */
  return (
    <mo.section className="vista on" variants={ORQUESTA} aria-label="Horario de clases">
      <mo.div className="cal-cab" variants={PIEZA}>
        <h1 className="sem-titulo">
          <span className="rango">Horario</span>{' '}
          <span className="anio">primer cuatrimestre</span>
        </h1>
        <span className="seg-nota">
          {CLAVES_ASIGNATURA.length} asignaturas · {totalHoras} h de clase a la semana
        </span>
      </mo.div>

      <mo.div className="hor-panel" variants={PIEZA}>
        <div className="hor-rejilla" style={{ ['--alto-hora' as string]: `${ALTO_HORA}px`, ['--horas' as string]: horas.length - 1 }}>
          {/* columna de horas */}
          <div className="hor-horas" aria-hidden="true">
            {horas.map((h) => (
              /* cada hora se coloca a la altura de su línea; el índice lo sabe aquí y no
                 el CSS, que no puede contar filas sin que alguien se lo diga */
              <span className="hor-hora" key={h} style={{ top: 34 + (h - desde) * ALTO_HORA }}>
                {String(h).padStart(2, '0')}:00
              </span>
            ))}
          </div>

          {DIAS.map((nombre, i) => {
            const dia = i + 1;
            const esHoy = dia === diaHoy;
            return (
              <div className={`hor-dia${esHoy ? ' es-hoy' : ''}`} key={nombre}>
                <span className="hor-cab">{nombre}</span>
                <div className="hor-pista">
                  {/* las líneas de hora, que son la referencia para leer a qué altura cae cada clase */}
                  {horas.slice(0, -1).map((h) => (
                    <span className="hor-linea" key={h} style={{ top: (h - desde) * ALTO_HORA }} />
                  ))}

                  {(porDia[dia] ?? []).map((c) => {
                    const a = ASIGNATURAS[c.asignatura];
                    const enCurso = esHoy && minutosAhora >= c.ini && minutosAhora < c.fin;
                    return (
                      <article
                        key={`${c.asignatura}-${c.ini}`}
                        className={`hor-clase${enCurso ? ' ahora' : ''}`}
                        style={{
                          ['--tc' as string]: `var(--c-${a.color})`,
                          top: ((c.ini - desde * 60) / 60) * ALTO_HORA,
                          height: ((c.fin - c.ini) / 60) * ALTO_HORA - 4,
                        }}
                      >
                        <span className="hor-rango">
                          {hhmm(c.ini)} – {hhmm(c.fin)}
                        </span>
                        <span className="hor-nombre">{a.nombre}</span>
                        <span className="hor-meta">
                          <span className="hor-cod">{a.codigo}</span>
                          {c.grupo}
                        </span>
                        <span className={`hor-aula${c.online ? ' online' : ''}`}>
                          {c.online && (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <rect x="2" y="4" width="20" height="14" rx="2" />
                              <path d="M8 21h8" />
                            </svg>
                          )}
                          {c.aula}
                        </span>
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </mo.div>

      {/* La leyenda no es decorativa: es lo que enseña qué color es cada asignatura, y ese
          código de color es el mismo que usan las tareas en el calendario. */}
      <mo.div className="hor-leyenda" variants={PIEZA}>
        {CLAVES_ASIGNATURA.map((k) => {
          const a = ASIGNATURAS[k];
          return (
            // sin el código: aquí solo se busca qué color es cada asignatura, y el número
            // compite con el nombre sin ayudar a esa pregunta. Sigue en cada clase de la
            // rejilla, que es donde hace falta identificarla.
            <span className="hor-chip" key={k} style={{ ['--tc' as string]: `var(--c-${a.color})` }}>
              <i />
              <b>{a.corto}</b>
            </span>
          );
        })}
      </mo.div>
    </mo.section>
  );
}
