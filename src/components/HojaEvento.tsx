'use client';

/**
 * La hoja de un evento: crear o editar una entrega, un examen, una presentación…
 * Sube desde abajo, como en el móvil.
 */

import { useEffect, useState } from 'react';

import { Icono, TIPOS } from '@/lib/ui/catalogo';
import { useUI } from '@/lib/ui/contexto';
import { useArchicel } from '@/lib/firebase/sesion';
import { hhmm, type Evento, type TipoEvento } from '@/lib/data';

export interface PeticionEvento {
  /** Evento existente, o `null` para uno nuevo. */
  evento: Evento | null;
  /** Fecha por defecto cuando es nuevo. */
  fecha: string;
}

export function HojaEvento({ peticion, cerrar }: { peticion: PeticionEvento | null; cerrar: () => void }) {
  const { almacen } = useArchicel();
  const { avisar } = useUI();
  const [borrador, setBorrador] = useState<Omit<Evento, 'id'> & { id?: string }>({
    tipo: 'entrega',
    titulo: '',
    materia: '',
    fecha: '',
    hora: null,
    nota: '',
  });

  useEffect(() => {
    if (!peticion) return;
    setBorrador(
      peticion.evento
        ? { ...peticion.evento }
        : { tipo: 'entrega', titulo: '', materia: '', fecha: peticion.fecha, hora: null, nota: '' },
    );
  }, [peticion]);

  if (!peticion) return null;
  const esNuevo = !peticion.evento;

  const guardar = async () => {
    await almacen.eventos.guardar({
      ...borrador,
      titulo: borrador.titulo.trim() || TIPOS[borrador.tipo].n,
    });
    avisar(esNuevo ? 'Evento añadido' : 'Evento actualizado');
    cerrar();
  };

  const borrar = async () => {
    if (!borrador.id) return;
    await almacen.eventos.borrar(borrador.id);
    avisar('Evento eliminado');
    cerrar();
  };

  const horas: number[] = [];
  for (let m = 7 * 60; m <= 22 * 60; m += 15) horas.push(m);

  return (
    <>
      <div className="telon on" onClick={cerrar} />
      <aside className="hoja on" role="dialog" aria-modal="true" aria-label={esNuevo ? 'Nuevo evento' : 'Editar evento'}>
        <span className="asa" />
        <h3>{esNuevo ? 'Nuevo evento' : 'Editar evento'}</h3>

        <div className="campo">
          <label>Tipo</label>
          <div className="tipos">
            {(Object.keys(TIPOS) as TipoEvento[]).map((k) => (
              <button
                key={k}
                type="button"
                className="tipo-btn"
                aria-pressed={borrador.tipo === k}
                style={{ ['--tc' as string]: `var(--c-${TIPOS[k].color})` }}
                onClick={() => setBorrador((b) => ({ ...b, tipo: k }))}
              >
                <Icono nombre={TIPOS[k].icono} tam={16} />
                <span>{TIPOS[k].n}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="campo">
          <label htmlFor="ev-titulo">Qué es</label>
          <input
            id="ev-titulo"
            type="text"
            autoComplete="off"
            placeholder="Entrega final, parcial de estructuras…"
            value={borrador.titulo}
            onChange={(e) => setBorrador((b) => ({ ...b, titulo: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && guardar()}
          />
        </div>

        <div className="campo">
          <label htmlFor="ev-materia">Asignatura</label>
          <input
            id="ev-materia"
            type="text"
            autoComplete="off"
            placeholder="Proyectos IV"
            value={borrador.materia ?? ''}
            onChange={(e) => setBorrador((b) => ({ ...b, materia: e.target.value }))}
          />
        </div>

        <div className="campo">
          <label htmlFor="ev-fecha">Día</label>
          <input
            id="ev-fecha"
            type="date"
            value={borrador.fecha}
            onChange={(e) => setBorrador((b) => ({ ...b, fecha: e.target.value }))}
          />
        </div>

        <div className="campo">
          <label htmlFor="ev-hora">Hora</label>
          <div className="fila-hora">
            <select
              id="ev-hora"
              disabled={borrador.hora === null}
              value={borrador.hora ?? 540}
              onChange={(e) => setBorrador((b) => ({ ...b, hora: Number(e.target.value) }))}
            >
              {horas.map((m) => (
                <option key={m} value={m}>
                  {hhmm(m)}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="todo-dia"
              aria-pressed={borrador.hora === null}
              onClick={() => setBorrador((b) => ({ ...b, hora: b.hora === null ? 540 : null }))}
            >
              Todo el día
            </button>
          </div>
        </div>

        <div className="campo">
          <label htmlFor="ev-nota">Qué hay que llevar</label>
          <textarea
            id="ev-nota"
            placeholder="9 láminas A1, maqueta, memoria…"
            value={borrador.nota ?? ''}
            onChange={(e) => setBorrador((b) => ({ ...b, nota: e.target.value }))}
          />
        </div>

        <div className="hoja-pie">
          {!esNuevo && (
            <button className="borrar" type="button" onClick={borrar} aria-label="Eliminar evento">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto' }}>
                <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13h10l1-13" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={cerrar}
            style={{ flex: '0 0 auto', padding: '0 18px', background: 'transparent', border: '1px solid var(--hairline)', color: 'var(--ink-muted)' }}
          >
            Cancelar
          </button>
          <button className="guardar" type="button" onClick={guardar}>
            Guardar
          </button>
        </div>
      </aside>
    </>
  );
}
