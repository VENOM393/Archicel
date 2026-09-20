'use client';

/**
 * La hoja de un evento: crear o editar una entrega, un examen, una presentación…
 * Sube desde abajo, como en el móvil.
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

/**
 * La hoja, separada en dos: presencia y contenido. El porqué, en `HojaTarea`: React no
 * sabe animar antes de desmontar, y `AnimatePresence` solo puede vigilar a un hijo que
 * aparece y desaparece — no a uno montado devolviendo `null`.
 */
export function HojaEvento({ peticion, cerrar }: { peticion: PeticionEvento | null; cerrar: () => void }) {
  return (
    <AnimatePresence>
      {peticion && <Contenido key="hoja" peticion={peticion} cerrar={cerrar} />}
    </AnimatePresence>
  );
}

function Contenido({ peticion, cerrar }: { peticion: PeticionEvento; cerrar: () => void }) {
  const { almacen } = useArchicel();
  /* el hook va antes de cualquier retorno: los hooks no pueden ir tras un `return` */
  const caja = useDialogo<HTMLElement>(true, cerrar);
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
      <m.div className="telon" variants={VELO} initial="fuera" animate="dentro" exit="saliendo" onClick={cerrar} />
      <m.aside ref={caja} tabIndex={-1} className="hoja" variants={HOJA} initial="fuera" animate="dentro" exit="saliendo" role="dialog" aria-modal="true" aria-label={esNuevo ? 'Nuevo evento' : 'Editar evento'}>
        <span className="asa" />
        <h3>{esNuevo ? 'Nuevo evento' : 'Editar evento'}</h3>

        {/* dos columnas cuando hay ancho; `ancho` marca lo que ocupa la fila entera */}
        <div className="hoja-cuerpo">
        <div className="campo ancho">
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

        <div className="campo ancho">
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

        {/* el mismo desplegable que la tarea: un examen es de una asignatura del
            horario, no de un nombre escrito a mano que puede no coincidir */}
        <div className="campo">
          <label>Asignatura</label>
          <SelectorAsignatura valor={borrador.materia} onCambio={(a) => setBorrador((b) => ({ ...b, materia: a }))} />
        </div>

        {/* el mismo selector que la hoja de tarea: el de fecha nativo lo dibuja cada
            navegador a su manera y aquí abría un calendario ajeno al resto */}
        <div className="campo">
          <label>Día</label>
          <SelectorFecha valor={borrador.fecha} onCambio={(f) => setBorrador((b) => ({ ...b, fecha: f }))} />
        </div>

        <div className="campo">
          <label htmlFor="ev-hora">Hora</label>
          <div className="fila-hora">
            {borrador.hora !== null ? (
              <SelectorHora
                etiqueta="Hora del evento"
                valor={borrador.hora}
                horas={horas}
                onCambio={(m) => setBorrador((b) => ({ ...b, hora: m }))}
              />
            ) : (
              /* sin hora no hay nada que elegir: el hueco se mantiene para que la fila no
                 salte al alternar entre "todo el día" y una hora concreta */
              <span className="sel-hora vacio" aria-hidden="true">
                --:--
              </span>
            )}
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

        <div className="campo ancho">
          <label htmlFor="ev-nota">Qué hay que llevar</label>
          <textarea
            id="ev-nota"
            placeholder="9 láminas A1, maqueta, memoria…"
            value={borrador.nota ?? ''}
            onChange={(e) => setBorrador((b) => ({ ...b, nota: e.target.value }))}
          />
        </div>

        </div>

        <div className="hoja-pie">
          {!esNuevo && (
            <Button variant="destructive" size="icon" className="borrar" type="button" onClick={borrar} aria-label="Eliminar evento">
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
