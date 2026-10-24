'use client';

/**
 * El modo foco: una sesión de estudio que empieza.
 *
 * No es una pantalla nueva con un cronómetro nuevo — **es el mismo pomodoro** que vive en
 * `/metodos`, a pantalla completa y con lo de esa asignatura delante. Si hay uno corriendo
 * al abrirlo, lo encuentra ya en marcha; si se para aquí, se para allí.
 *
 * Lo que se pone delante es lo que de verdad hace falta mientras se estudia: **qué viene**
 * de esa asignatura —la entrega o el examen más cercano— y **qué hay** para prepararlo,
 * los últimos apuntes. Nada más. Un modo foco con una barra lateral de atajos no es un
 * modo foco.
 */

import { useEffect, useMemo, useState } from 'react';
import * as mo from 'motion/react-m';
import { AnimatePresence } from 'motion/react';

import { HOJA, VELO } from '@/lib/ui/movimiento';
import { AlCuerpo } from '@/components/AlCuerpo';
import { Button } from '@/components/ui/button';
import { useMarcha, usePomodoro } from '@/hooks/usePomodoro';
import { useAhora, useApuntes, useEventos } from '@/hooks/useDatos';
import { Icono, TIPOS } from '@/lib/ui/catalogo';
import {
  ASIGNATURAS,
  CLAVES_ASIGNATURA,
  aFecha,
  buscarAsignatura,
  deFecha,
  type ClaveAsignatura,
} from '@/lib/data';

/** Los largos que ofrece el foco. Los mismos que el pomodoro de Métodos. */
const LARGOS = [15, 25, 50];

export function Foco({ cerrar }: { cerrar: () => void }) {
  const { marcha, restante, estudio, setEstudio, parar, arrancar } = usePomodoro();
  const ahora = useAhora(30_000);

  /* Si ya hay uno corriendo, el foco se abre sobre él: la asignatura no se vuelve a
     preguntar. Si no, la primera del curso, que es lo que hace el pomodoro de Métodos. */
  const [elegida, setElegida] = useState<string>(marcha?.asignatura ?? CLAVES_ASIGNATURA[0]);
  const clave = marcha?.asignatura ?? elegida;
  const asig = ASIGNATURAS[clave as ClaveAsignatura];

  /* Escape sale, que es lo que todo el mundo intenta en una pantalla a pantalla completa.
     **No para el cronómetro**: salir del foco no es dejar de estudiar. */
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [cerrar]);

  return (
    <>
      <mo.div className="telon foco-telon" variants={VELO} initial="fuera" animate="dentro" exit="saliendo" />
      <mo.section
        className="foco"
        variants={HOJA}
        initial="fuera"
        animate="dentro"
        exit="saliendo"
        role="dialog"
        aria-modal="true"
        aria-label="Modo foco"
        style={{ ['--tc' as string]: asig ? `var(--c-${asig.color})` : 'var(--accent-linea)' }}
      >
        <header className="foco-cab">
          <span className="foco-rotulo">Foco</span>
          <Button type="button" variant="outline" size="sm" onClick={cerrar}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
            Salir
          </Button>
        </header>

        <div className="foco-cuerpo">
          <Reloj
            marcha={marcha}
            restante={restante}
            estudio={estudio}
            setEstudio={setEstudio}
            clave={clave}
            setElegida={setElegida}
            arrancar={() => arrancar(clave)}
            parar={parar}
          />
          <Contexto clave={clave} ahora={ahora} />
        </div>
      </mo.section>
    </>
  );
}

/* ───────────────────────── el reloj ───────────────────────── */

function Reloj({
  marcha,
  restante,
  estudio,
  setEstudio,
  clave,
  setElegida,
  arrancar,
  parar,
}: {
  marcha: ReturnType<typeof usePomodoro>['marcha'];
  restante: number;
  estudio: number;
  setEstudio: (n: number) => void;
  clave: string;
  setElegida: (k: string) => void;
  arrancar: () => void;
  parar: () => void;
}) {
  const asig = ASIGNATURAS[clave as ClaveAsignatura];
  const total = (marcha?.largo ?? estudio) * 60;
  const vuelta = 2 * Math.PI * 104;
  /* Parado es cero, no uno: `restante` vale 0 quieto y la cuenta daba la vuelta entera
     pintada — un pomodoro recién terminado en vez de uno que no ha empezado. */
  const tanto = marcha && total > 0 ? 1 - restante / total : 0;

  return (
    <div className="foco-reloj">
      <div className="foco-anillo">
        <svg viewBox="0 0 228 228" aria-hidden="true">
          <circle cx="114" cy="114" r="104" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="8" />
          <circle
            cx="114"
            cy="114"
            r="104"
            fill="none"
            stroke="var(--tc)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={vuelta}
            strokeDashoffset={vuelta * (1 - tanto)}
            transform="rotate(-90 114 114)"
            /* El avance lo lleva el CSS: Motion no toca esta propiedad aquí, y una
               propiedad tiene un dueño. */
            style={{ transition: 'stroke-dashoffset 950ms var(--ease-out)' }}
          />
        </svg>
        <div className="foco-cifra">
          <span className="foco-min">{reloj(marcha ? restante : estudio * 60)}</span>
          <span className="foco-fase">
            {marcha ? (marcha.fase === 'estudio' ? 'estudiando' : 'descanso') : 'sin empezar'}
          </span>
        </div>
      </div>

      <p className="foco-que">{asig?.nombre ?? clave}</p>

      {marcha ? (
        <Button type="button" variant="outline" onClick={parar}>
          Parar
        </Button>
      ) : (
        <>
          {/* Elegir asignatura y largo solo tiene sentido antes de empezar: a mitad, lo
              que se anote al terminar no sería lo que de verdad se estudió. */}
          <div className="foco-elige">
            {CLAVES_ASIGNATURA.map((k) => {
              const a = ASIGNATURAS[k];
              return (
                <button
                  key={k}
                  type="button"
                  className={`foco-asig${k === clave ? ' on' : ''}`}
                  style={{ ['--ta' as string]: `var(--c-${a.color})` }}
                  onClick={() => setElegida(k)}
                  aria-pressed={k === clave}
                  title={a.nombre}
                >
                  <i aria-hidden="true" />
                  <span>{a.nombre}</span>
                </button>
              );
            })}
          </div>

          <div className="foco-largos" role="group" aria-label="Cuánto va a durar">
            {LARGOS.map((n) => (
              <button
                key={n}
                type="button"
                className={`foco-largo${n === estudio ? ' on' : ''}`}
                aria-pressed={n === estudio}
                onClick={() => setEstudio(n)}
              >
                <b>{n}</b> min
              </button>
            ))}
          </div>

          <Button type="button" onClick={arrancar}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 4l12 8-12 8z" />
            </svg>
            Empezar
          </Button>
        </>
      )}
    </div>
  );
}

/* ───────────────────────── lo que hay delante ───────────────────────── */

/**
 * Qué viene de esta asignatura y qué hay para prepararlo.
 *
 * Los eventos se piden de hoy a dentro de noventa días: una entrega a cuatro meses vista
 * no ayuda a nadie a concentrarse esta tarde, y pedir el curso entero baja cosas que no
 * se van a pintar.
 */
function Contexto({ clave, ahora }: { clave: string; ahora: Date | null }) {
  const asig = ASIGNATURAS[clave as ClaveAsignatura];

  const rango = useMemo(() => {
    if (!ahora) return undefined;
    const hasta = new Date(ahora);
    hasta.setDate(hasta.getDate() + 90);
    return { desde: aFecha(ahora), hasta: aFecha(hasta) };
  }, [ahora]);

  const eventos = useEventos(rango);
  const [apuntes, listoApuntes] = useApuntes(clave);

  const mios = useMemo(
    () => eventos.filter((e) => asig && buscarAsignatura(e.materia)?.codigo === asig.codigo).slice(0, 3),
    [eventos, asig],
  );
  const ultimos = useMemo(
    () => [...apuntes].sort((a, b) => (b.creado ?? 0) - (a.creado ?? 0)).slice(0, 5),
    [apuntes],
  );

  return (
    <div className="foco-lado">
      <section className="foco-panel">
        <h3>Qué viene</h3>
        {mios.length === 0 ? (
          <p className="foco-nada">
            {ahora ? 'Nada apuntado de esta asignatura en los próximos tres meses.' : ' '}
          </p>
        ) : (
          <ul className="foco-lista">
            {mios.map((e) => {
              const t = TIPOS[e.tipo] ?? TIPOS.otro;
              return (
                <li key={e.id} className="foco-ev" style={{ ['--te' as string]: `var(--c-${t.color})` }}>
                  <span className="foco-ev-icono" aria-hidden="true">
                    <Icono nombre={t.icono} tam={14} />
                  </span>
                  <span className="foco-ev-que">{e.titulo}</span>
                  <span className="foco-ev-cuando">{cuanto(e.fecha, ahora)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="foco-panel">
        <h3>Lo último que subiste</h3>
        {!listoApuntes ? (
          <p className="foco-nada"> </p>
        ) : ultimos.length === 0 ? (
          <p className="foco-nada">Todavía no hay apuntes de esta asignatura.</p>
        ) : (
          <ul className="foco-lista">
            {ultimos.map((a) => (
              <li key={a.id} className="foco-ap">
                {/* El nombre de un fichero lo escribe quien sea: texto, nunca HTML. */}
                <span className="foco-ap-que">{a.nombre}</span>
                {a.calificacion !== undefined && (
                  <span className={`foco-ap-nota ${bandaDe(a.calificacion)}`}>
                    {(Math.round(a.calificacion * 10) / 10).toLocaleString('es-ES', { maximumFractionDigits: 1 })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* Los mismos cuatro tramos que la insignia de la celda de apuntes. */
function bandaDe(n: number): string {
  if (n < 5) return 'suspenso';
  if (n < 7) return 'aprobado';
  if (n < 9) return 'notable';
  return 'sobresaliente';
}

function reloj(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** «hoy», «mañana», «en 5 días» o la fecha. Sin `ahora` no se dice nada: el servidor no lo sabe. */
function cuanto(fecha: string, ahora: Date | null): string {
  if (!ahora) return '';
  const hoyCero = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const d = deFecha(fecha);
  const dias = Math.round((d.getTime() - hoyCero.getTime()) / 86_400_000);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'mañana';
  if (dias <= 14) return `en ${dias} días`;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

/* ───────────────────────── el botón del escritorio ───────────────────────── */

/**
 * La píldora que abre el foco, en la barra de arriba del escritorio.
 *
 * **Con un pomodoro corriendo enseña la cuenta.** Es lo que la convierte en algo más que
 * un botón: desde el escritorio se ve cuánto queda sin ir a ninguna parte, igual que la
 * tarjeta del taller.
 */
export function BotonFoco({ marcha, restante, alAbrir }: { marcha: { fase: string } | null; restante: number; alAbrir: () => void }) {
  return (
    <button
      type="button"
      className={`foco-btn${marcha ? ' vivo' : ''}`}
      onClick={alAbrir}
      aria-label={marcha ? `Modo foco, quedan ${reloj(restante)}` : 'Entrar en modo foco'}
      title={marcha ? `Quedan ${reloj(restante)}` : 'Modo foco'}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="8.4" />
        <circle cx="12" cy="12" r="3.6" />
      </svg>
      {marcha ? <span className="foco-btn-cuenta">{reloj(restante)}</span> : <span>Foco</span>}
    </button>
  );
}

/**
 * El envoltorio: el botón, la pantalla y la presencia que las une.
 *
 * **La pantalla va a `body` por un portal y el botón no.** El botón vive en la barra de
 * arriba, dentro de un envoltorio que Motion anima: un ancestro con `transform` se
 * convierte en el bloque contenedor de todo lo `fixed` de dentro, así que el telón y la
 * pantalla se resolvían contra ese trocito de cabecera en vez de contra la ventana. El
 * síntoma fue que un widget del escritorio quedaba **por encima** del foco y se comía los
 * clics de los botones de asignatura. Es la misma trampa que ya obligó a portar el visor
 * de apuntes, y la misma salida.
 */
export function Enfoque() {
  const [abierto, setAbierto] = useState(false);
  const { marcha, restante } = useMarcha();

  return (
    <>
      <BotonFoco marcha={marcha} restante={restante} alAbrir={() => setAbierto(true)} />
      <AlCuerpo>
        <AnimatePresence>{abierto && <Foco key="foco" cerrar={() => setAbierto(false)} />}</AnimatePresence>
      </AlCuerpo>
    </>
  );
}

