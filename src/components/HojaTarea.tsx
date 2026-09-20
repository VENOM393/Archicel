'use client';

/**
 * La hoja de una tarea: qué, cuándo, de qué asignatura, con qué icono, cuánta prioridad
 * y por dónde va.
 *
 * El color no se elige: lo pone la asignatura, y la muestra de su campo enseña cuál le
 * toca antes de guardar.
 */

import { useEffect, useState } from 'react';
import * as m from 'motion/react-m';
import { AnimatePresence } from 'motion/react';

import { HOJA, VELO } from '@/lib/ui/movimiento';

import { useDialogo } from '@/hooks/useDialogo';
import { SelectorAsignatura } from '@/components/campos/SelectorAsignatura';
import { SelectorFecha } from '@/components/campos/SelectorFecha';
import { SelectorHora } from '@/components/campos/SelectorHora';
import { Button } from '@/components/ui/button';

import { DIA_FIN, DIA_INICIO, ICONOS, Icono, Nivel, PRIOS } from '@/lib/ui/catalogo';
import { useUI } from '@/lib/ui/contexto';
import { useArchicel } from '@/lib/firebase/sesion';
import {
  ASIGNATURAS,
  CLAVES_ASIGNATURA,
  NOMBRE_PROGRESO,
  PROGRESOS,
  colorDeAsignatura,
  hhmm,
  progresoDe,
  type Tarea,
} from '@/lib/data';

export interface PeticionTarea {
  tarea: Tarea | null;
  fecha: string;
  /** Hora de inicio sugerida al crear desde un hueco de la agenda. */
  desde?: number;
}

/**
 * La hoja, separada en dos: presencia y contenido.
 *
 * React no sabe animar un elemento **antes** de desmontarlo, así que hasta ahora la hoja
 * desaparecía de golpe al cerrar: entraba con cuidado y se iba de un tirón. Eso es
 * exactamente lo que `AnimatePresence` resuelve — retiene el nodo hasta que su animación
 * de salida termina.
 *
 * Para que funcione, el contenido tiene que ser un componente que **solo exista cuando hay
 * algo que enseñar**, no uno que devuelva `null`: lo que AnimatePresence vigila es si su
 * hijo está o no está, y un componente montado devolviendo `null` sigue estando.
 */
export function HojaTarea({ peticion, cerrar }: { peticion: PeticionTarea | null; cerrar: () => void }) {
  return (
    <AnimatePresence>
      {peticion && <Contenido key="hoja" peticion={peticion} cerrar={cerrar} />}
    </AnimatePresence>
  );
}

function Contenido({ peticion, cerrar }: { peticion: PeticionTarea; cerrar: () => void }) {
  const { almacen } = useArchicel();
  /* el hook va antes de cualquier retorno: los hooks no pueden ir tras un `return` */
  const caja = useDialogo<HTMLElement>(true, cerrar);
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

  const esNueva = !peticion.tarea;

  const guardar = async () => {
    const fin = b.fin <= b.ini ? b.ini + 30 : b.fin;
    /* el color no se guarda por sí mismo: se recalcula desde la asignatura, así que no
       puede quedarse desfasado si esta cambia */
    await almacen.tareas.guardar({
      ...b,
      fin,
      titulo: b.titulo.trim() || 'Sin título',
      asignatura: b.asignatura?.trim() || undefined,
      color: colorDeAsignatura(b.asignatura),
      progreso: b.progreso ?? (b.hecha ? 'hecha' : 'sin-empezar'),
    });
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
      <m.div className="telon" variants={VELO} initial="fuera" animate="dentro" exit="saliendo" onClick={cerrar} />
      <m.aside ref={caja} tabIndex={-1} className="hoja" variants={HOJA} initial="fuera" animate="dentro" exit="saliendo" role="dialog" aria-modal="true" aria-label={esNueva ? 'Nueva tarea' : 'Editar tarea'}
        style={{ ['--sel-color' as string]: `var(--c-${colorDeAsignatura(b.asignatura)})` }}>
        <span className="asa" />
        <h3>{esNueva ? 'Nueva tarea' : 'Editar tarea'}</h3>

        {/* dos columnas cuando hay ancho; `ancho` marca lo que ocupa la fila entera */}
        <div className="hoja-cuerpo">
        <div className="campo ancho">
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
            <SelectorHora etiqueta="Hora de inicio" valor={b.ini} horas={horas} onCambio={(m) => setB((v) => ({ ...v, ini: m }))} />
            <span className="flecha">→</span>
            <SelectorHora etiqueta="Hora de fin" valor={b.fin} horas={horas} onCambio={(m) => setB((v) => ({ ...v, fin: m }))} />
          </div>
          {/* La fecha se puede cambiar aquí: antes era la del sitio desde donde se creaba
              la tarea y para moverla de día había que borrarla y rehacerla. */}
          <SelectorFecha valor={b.fecha} onCambio={(f) => setB((v) => ({ ...v, fecha: f }))} />
        </div>

        {/* La asignatura sustituye al selector de color: el color de la tarea sale de
            ella, así que elegirlo a mano sería poder contradecirla. */}
        <div className="campo">
          <label>Asignatura</label>
          <SelectorAsignatura valor={b.asignatura} onCambio={(a) => setB((v) => ({ ...v, asignatura: a }))} />
        </div>

        <div className="campo ancho">
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

        {/* La prioridad se dice con barras, no con un punto de color: tres escalones que
            suben se leen de un vistazo y sin depender de saberse el código de colores. */}
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
                <Nivel prio={p.id} />
                {p.n}
              </button>
            ))}
          </div>
        </div>

        {/* Tres estados, no cuatro: "retrasada" no se elige porque se deduce del reloj, y
            guardarla dejaría tareas marcadas como retrasadas con fecha futura. Cuando la
            tarea lo está, se avisa aquí mismo. */}
        <div className="campo">
          <label>Progreso</label>
          <div className="prios">
            {PROGRESOS.map((g) => (
              <button
                key={g}
                type="button"
                className={`prog-btn${(b.progreso ?? (b.hecha ? 'hecha' : 'sin-empezar')) === g ? ' on' : ''}`}
                data-g={g}
                aria-pressed={(b.progreso ?? (b.hecha ? 'hecha' : 'sin-empezar')) === g}
                onClick={() => setB((v) => ({ ...v, progreso: g, hecha: g === 'hecha' }))}
              >
                {NOMBRE_PROGRESO[g]}
              </button>
            ))}
          </div>
          {!esNueva && progresoDe(b as Tarea) === 'retrasada' && (
            <p className="aviso-retraso" role="status">
              Su hora de fin ya pasó y sigue sin terminar: aparece como <b>retrasada</b>.
            </p>
          )}
        </div>

        </div>

        <div className="hoja-pie">
          {!esNueva && (
            <Button variant="destructive" size="icon" className="borrar" type="button" onClick={borrar} aria-label="Eliminar tarea">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto' }}>
                <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13h10l1-13" />
              </svg>
            </Button>
          )}
          <Button variant="outline" type="button" onClick={cerrar}>
            Cancelar
          </Button>
          <Button className="guardar" type="button" onClick={guardar}>
            Guardar
          </Button>
        </div>
      </m.aside>
    </>
  );
}
