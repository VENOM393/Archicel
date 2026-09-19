'use client';

/**
 * La hoja de una tarea del día: qué, cuándo, color, icono y prioridad.
 * El icono se tiñe del color elegido, así se ve el resultado antes de guardar.
 */

import { useEffect, useState } from 'react';

import { COLORES_TAREA, DIA_FIN, DIA_INICIO, ICONOS, Icono, PRIOS } from '@/lib/ui/catalogo';
import { useUI } from '@/lib/ui/contexto';
import { useArchicel } from '@/lib/firebase/sesion';
import { hhmm, type Tarea } from '@/lib/data';

export interface PeticionTarea {
  tarea: Tarea | null;
  fecha: string;
  /** Hora de inicio sugerida al crear desde un hueco de la agenda. */
  desde?: number;
}

export function HojaTarea({ peticion, cerrar }: { peticion: PeticionTarea | null; cerrar: () => void }) {
  const { almacen } = useArchicel();
  const { avisar } = useUI();
  const [b, setB] = useState<Omit<Tarea, 'id'> & { id?: string }>({
    fecha: '',
    ini: 540,
    fin: 600,
    titulo: '',
    color: 'ambar',
    icono: 'reloj',
    prio: 'media',
    hecha: false,
  });

  useEffect(() => {
    if (!peticion) return;
    if (peticion.tarea) setB({ ...peticion.tarea });
    else {
      const ini = peticion.desde ?? 540;
      setB({ fecha: peticion.fecha, ini, fin: ini + 60, titulo: '', color: 'ambar', icono: 'reloj', prio: 'media', hecha: false });
    }
  }, [peticion]);

  if (!peticion) return null;
  const esNueva = !peticion.tarea;

  const guardar = async () => {
    const fin = b.fin <= b.ini ? b.ini + 30 : b.fin;
    await almacen.tareas.guardar({ ...b, fin, titulo: b.titulo.trim() || 'Sin título' });
    avisar(esNueva ? 'Tarea añadida' : 'Tarea actualizada');
    cerrar();
  };

  const borrar = async () => {
    if (!b.id) return;
    await almacen.tareas.borrar(b.id);
    avisar('Tarea eliminada');
    cerrar();
  };

  const horas: number[] = [];
  for (let m = DIA_INICIO * 60; m <= DIA_FIN * 60; m += 15) horas.push(m);

  return (
    <>
      <div className="telon on" onClick={cerrar} />
      <aside className="hoja on" role="dialog" aria-modal="true" aria-label={esNueva ? 'Nueva tarea' : 'Editar tarea'}
        style={{ ['--sel-color' as string]: `var(--c-${b.color})` }}>
        <span className="asa" />
        <h3>{esNueva ? 'Nueva tarea' : 'Editar tarea'}</h3>

        <div className="campo">
          <label htmlFor="t-titulo">Qué</label>
          <input
            id="t-titulo"
            type="text"
            autoComplete="off"
            placeholder="Gimnasio, taller, corrección…"
            value={b.titulo}
            onChange={(e) => setB((v) => ({ ...v, titulo: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && guardar()}
          />
        </div>

        <div className="campo">
          <label>Cuándo</label>
          <div className="horas-fila">
            <select aria-label="Hora de inicio" value={b.ini} onChange={(e) => setB((v) => ({ ...v, ini: Number(e.target.value) }))}>
              {horas.map((m) => (
                <option key={m} value={m}>
                  {hhmm(m)}
                </option>
              ))}
            </select>
            <span className="flecha">→</span>
            <select aria-label="Hora de fin" value={b.fin} onChange={(e) => setB((v) => ({ ...v, fin: Number(e.target.value) }))}>
              {horas.map((m) => (
                <option key={m} value={m}>
                  {hhmm(m)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="campo">
          <label>Color</label>
          <div className="colores">
            {COLORES_TAREA.map((c) => (
              <button
                key={c}
                type="button"
                className="color"
                aria-label={`Color ${c}`}
                aria-pressed={b.color === c}
                style={{ ['--cc' as string]: `var(--c-${c})` }}
                onClick={() => setB((v) => ({ ...v, color: c }))}
              />
            ))}
          </div>
        </div>

        <div className="campo">
          <label>Icono</label>
          <div className="iconos">
            {Object.keys(ICONOS).map((k) => (
              <button
                key={k}
                type="button"
                className="ico-btn"
                aria-label={k}
                aria-pressed={b.icono === k}
                onClick={() => setB((v) => ({ ...v, icono: k }))}
              >
                <Icono nombre={k} tam={18} />
              </button>
            ))}
          </div>
        </div>

        <div className="campo">
          <label>Prioridad</label>
          <div className="prios">
            {PRIOS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="prio-btn"
                data-p={p.id}
                aria-pressed={b.prio === p.id}
                onClick={() => setB((v) => ({ ...v, prio: p.id }))}
              >
                <i />
                {p.n}
              </button>
            ))}
          </div>
        </div>

        <div className="hoja-pie">
          {!esNueva && (
            <button className="borrar" type="button" onClick={borrar} aria-label="Eliminar tarea">
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
