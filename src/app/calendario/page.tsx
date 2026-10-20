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
import { useMemo, useState } from 'react';
import * as m from 'motion/react-m';
import { AnimatePresence } from 'motion/react';

import { MUELLE, ORQUESTA, PIEZA, RELEVO } from '@/lib/ui/movimiento';

import { HojaEvento, type PeticionEvento } from '@/components/HojaEvento';
import { MesDeEventos, mesEntero } from '@/components/MesDeEventos';
import { HojaTarea, type PeticionTarea } from '@/components/HojaTarea';
import { Button } from '@/components/ui/button';
import { useEventos, useTareas } from '@/hooks/useDatos';
import { useArchicel } from '@/lib/firebase/sesion';
import { NOMBRE_PROGRESO, aFecha, hhmm, progresoDe, type Tarea } from '@/lib/data';
import { Icono, Nivel } from '@/lib/ui/catalogo';

type Modo = 'mes' | 'semana';

export default function Calendario() {
  const [modo, setModo] = useState<Modo>('mes');
  const [ref, setRef] = useState(() => new Date());
  const [hoja, setHoja] = useState<PeticionEvento | null>(null);
  const [hojaTarea, setHojaTarea] = useState<PeticionTarea | null>(null);

  /**
   * El cambio de vista es un relevo, no un corte: la que se va se apaga hacia el
   * desenfoque y solo entonces entra la otra. Dos fases en vez de un cruce porque ambas
   * ocupan el mismo hueco y superponerlas las mezcla.
   *
   * Eso era antes un `setTimeout` de 200 ms que tenía que valer lo mismo que una
   * duración escrita en el CSS, más un estado `saliendo` para guardarse de que nadie
   * cambiara de pestaña a mitad. Ahora lo dice una palabra: `mode="wait"`. Motion espera
   * a que la vista vieja termine su salida antes de montar la nueva, y si alguien pulsa
   * la otra pestaña mientras tanto, redirige la que ya estaba saliendo en vez de
   * encolarse. No hay dos números que mantener iguales ni un temporizador que limpiar.
   */
  return (
    <>
      {/* La sección reparte la llegada de sus partes y cada parte la ejecuta, pero
          ninguna de las dos declara `initial` ni `animate`: las hereda del envoltorio de
          página del Marco por el árbol de Motion. Por eso el conmutador y el panel entran
          exactamente cuando la página entra, sin que nadie haya cuadrado dos números. */}
      <m.section className="vista on" variants={ORQUESTA} aria-label="Calendario">
        <m.div className="sem-top" variants={PIEZA}>
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
              setModo(otro);
              document.getElementById(`tab-${otro}`)?.focus();
            }}
          >
            {/* La píldora ya no se coloca con un porcentaje: vive dentro de la pestaña
                activa y lleva `layoutId`. Motion la encuentra en su nuevo sitio y la
                lleva de una a otra midiendo el DOM real, así que no hay forma de que se
                despegue del botón — y el día que haya una tercera vista, sigue
                funcionando sin tocar un solo número. */}
            {(['mes', 'semana'] as const).map((vista) => (
              <button
                key={vista}
                id={`tab-${vista}`}
                type="button"
                role="tab"
                aria-selected={modo === vista}
                aria-controls="cal-panel"
                /* dentro de un tablist se navega con flechas, no con Tab */
                tabIndex={modo === vista ? 0 : -1}
                onClick={() => setModo(vista)}
              >
                {modo === vista && (
                  <m.span layoutId="seg-pill" className="seg-pill" transition={MUELLE.normal} aria-hidden="true" />
                )}
                <span className="seg-txt">{vista === 'mes' ? 'Mes' : 'Semana'}</span>
              </button>
            ))}
          </div>
          <span className="seg-nota">
            {modo === 'mes' ? 'entregas, exámenes y correcciones' : 'tus tareas · toca un día para abrirlo'}
          </span>
        </m.div>

        {/* Dos animaciones distintas sobre el mismo sitio, y por eso dos cajas.
            La de fuera es la **llegada a la página** y lleva `PIEZA`; la de dentro es el
            **cambio de vista** y lleva `RELEVO`. Sin separarlas habría que elegir una, y el
            panel o entraría a destiempo con el resto de la página o se relevaría mal al
            cambiar de pestaña. `initial={false}` en el `AnimatePresence` de dentro deja
            claro quién manda al llegar: la de fuera. */}
        <m.div className="cal-pieza" variants={PIEZA}>
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={modo}
            className="cal-panel"
            variants={RELEVO}
            initial="fuera"
            animate="dentro"
            exit="saliendo"
            id="cal-panel"
            role="tabpanel"
            aria-labelledby={`tab-${modo}`}
          >
            {modo === 'mes' ? (
              <VistaMes ref_={ref} setRef={setRef} abrirEvento={setHoja} />
            ) : (
              <VistaSemana ref_={ref} setRef={setRef} abrirTarea={setHojaTarea} />
            )}
          </m.div>
        </AnimatePresence>
        </m.div>
      </m.section>

      <HojaEvento peticion={hoja} cerrar={() => setHoja(null)} />
      <HojaTarea peticion={hojaTarea} cerrar={() => setHojaTarea(null)} />
    </>
  );
}

/* ═══════════════════ MES · solo eventos ═══════════════════ */

/**
 * El mes de esta pantalla.
 *
 * La rejilla vive ahora en `MesDeEventos`, porque la usa también la columna derecha de una
 * asignatura. Aquí solo queda lo que es de esta pantalla y de ninguna otra: que los eventos
 * son **todos** los del mes, y que pulsar un día abre su agenda.
 */
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
  const { desde, hasta } = mesEntero(ref_);
  const eventos = useEventos({ desde, hasta });

  return (
    <MesDeEventos
      ref_={ref_}
      setRef={setRef}
      eventos={eventos}
      abrirEvento={abrirEvento}
      alPulsarDia={(clave) => router.push(`/dia?f=${clave}`)}
    />
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
    const mapa: Record<string, Tarea[]> = {};
    tareas.forEach((t) => (mapa[t.fecha] = [...(mapa[t.fecha] ?? []), t]));
    return mapa;
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
