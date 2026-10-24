'use client';

/**
 * El taller: los métodos de estudio.
 *
 * Tres tarjetas grandes, una por método, y **cada una enseña dentro lo que hace** — el
 * anillo del pomodoro girando, la escalera de repasos separándose. La página es el
 * selector: no hay una lista de nombres y luego un sitio donde pasan las cosas.
 *
 * ## Abrir una tarjeta
 *
 * Al pulsarla **crece hasta ocupar la pantalla**, y ese viaje no lo calcula nadie: la
 * tarjeta pequeña y la grande comparten `layoutId`, así que Motion encuentra la misma caja
 * en otro sitio del DOM y la lleva de una a otra midiendo lo que hay de verdad. Es el
 * mismo mecanismo que el agua del dock y la píldora del calendario, y por la misma razón:
 * una posición deducida no se puede desincronizar de lo que se ve.
 *
 * Dentro de la abierta va **toda la configuración de ese método**. No hay una pantalla de
 * ajustes aparte: se configura donde se usa.
 *
 * ## Qué está hecho y qué no
 *
 * **El pomodoro funciona entero** y es el único que escribe `sesiones`. Los otros dos
 * abren igual y dicen que están por definir, porque de la repetición espaciada quedan
 * decisiones abiertas —quién decide cuándo toca repasar, sobre todo— y de Sketchap no se
 * sabe aún qué es. Un método a medias que parece terminado es peor que uno que dice que
 * todavía no está.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as mo from 'motion/react-m';
import { AnimatePresence } from 'motion/react';

import {
  CELDA,
  DENTRO_DEL_METODO,
  FRANJA,
  METODO_APARTADO,
  MUELLE,
  ORQUESTA,
  PIEZA,
  REPARTO,
  CURVA,
  TIEMPO,
} from '@/lib/ui/movimiento';
import { Button } from '@/components/ui/button';
import { SelectorAsignatura } from '@/components/campos/SelectorAsignatura';
import { useAhora, useBloques, useSesiones } from '@/hooks/useDatos';
import { useArchicel } from '@/lib/firebase/sesion';
import { nuevoId } from '@/lib/data/almacen';
import { useUI } from '@/lib/ui/contexto';
import {
  ASIGNATURAS,
  CLAVES_ASIGNATURA,
  MINUTOS_POR_FRANJA,
  aFecha,
  deFecha,
  hoy,
  type Bloque,
  type ClaveAsignatura,
  type Franja,
  type Sesion,
} from '@/lib/data';

type Clave = 'pomodoro' | 'repaso' | 'boceto';

/* ───────────────────────── el cronómetro, visto desde fuera ─────────────────────────
   Esto vive aquí arriba y no dentro de `Pomodoro` porque **la tarjeta cerrada también
   tiene que saberlo**. Con el taller a la vista, un pomodoro corriendo era invisible: se
   arrancaba, se navegaba a otra sección, se volvía, y la pantalla estaba exactamente igual
   que antes de empezar. El único estado que de verdad importa era el único que no se veía.
*/

/** Lo que se recuerda entre recargas. Guarda **cuándo empezó**, nunca cuánto queda. */
interface EnMarcha {
  asignatura: string;
  /** Milisegundos desde la época. Lo que queda se calcula; un contador en memoria se pierde. */
  arranque: number;
  /** Minutos de esta fase. */
  largo: number;
  fase: 'estudio' | 'descanso';
}

const RECORDADO = 'archicel.pomodoro.v1';
/** Las pestañas se enteran por `storage`; dentro de esta, por este aviso. */
const LATIDO = 'archicel:pomodoro';

function leerMarcha(): EnMarcha | null {
  try {
    const crudo = localStorage.getItem(RECORDADO);
    if (!crudo) return null;
    const g = JSON.parse(crudo) as EnMarcha;
    return g && typeof g.arranque === 'number' && typeof g.largo === 'number' ? g : null;
  } catch {
    /* almacenamiento bloqueado o contenido corrupto: no hay nada corriendo */
    return null;
  }
}

function escribirMarcha(m: EnMarcha | null) {
  try {
    if (m) localStorage.setItem(RECORDADO, JSON.stringify(m));
    else localStorage.removeItem(RECORDADO);
  } catch {}
  window.dispatchEvent(new Event(LATIDO));
}

/** Segundos que quedan de `m`, contra el reloj real. Nunca negativo. */
function quedanDe(m: EnMarcha): number {
  return Math.max(0, m.largo * 60 - Math.floor((Date.now() - m.arranque) / 1000));
}

/**
 * Lo que hay corriendo ahora mismo, para quien solo quiera mirarlo.
 *
 * El latido **solo late si hay algo que contar**: sin pomodoro no hay `setInterval`, así
 * que el taller quieto no despierta a React una vez por segundo para no cambiar nada.
 */
function useMarcha(): { marcha: EnMarcha | null; restante: number } {
  const [marcha, setMarcha] = useState<EnMarcha | null>(null);
  const [restante, setRestante] = useState(0);

  useEffect(() => {
    const mirar = () => setMarcha(leerMarcha());
    mirar();
    window.addEventListener(LATIDO, mirar);
    window.addEventListener('storage', mirar);
    return () => {
      window.removeEventListener(LATIDO, mirar);
      window.removeEventListener('storage', mirar);
    };
  }, []);

  useEffect(() => {
    if (!marcha) {
      setRestante(0);
      return;
    }
    const tic = () => setRestante(quedanDe(marcha));
    tic();
    const t = setInterval(tic, 1000);
    return () => clearInterval(t);
  }, [marcha]);

  return { marcha, restante };
}

/* ───────────────────────── el catálogo de métodos ───────────────────────── */

interface Metodo {
  clave: Clave;
  nombre: string;
  pie: string;
  color: string;
  listo: boolean;
}

const METODOS: Metodo[] = [
  {
    clave: 'pomodoro',
    nombre: 'Pomodoro',
    pie: 'Bloques de estudio con descanso. Suma las horas que le dedicas a cada asignatura.',
    color: 'naranja',
    listo: true,
  },
  {
    clave: 'repaso',
    nombre: 'Repetición espaciada',
    pie: 'Reparte el día en cuatro partes de dos horas y coloca en cada una lo que toca.',
    color: 'azul',
    listo: true,
  },
  {
    clave: 'boceto',
    nombre: 'Sketchap',
    pie: 'El tercero. Falta decidir qué es exactamente.',
    color: 'violeta',
    listo: false,
  },
];

/* ───────────────────────── la pantalla ───────────────────────── */

export function Metodos() {
  const [abierto, setAbierto] = useState<Clave | null>(null);
  const ahora = useAhora(30_000);
  const { marcha, restante } = useMarcha();

  /* Lo de los últimos treinta días: es lo que llena el registro y el resumen de arriba. */
  const rango = useMemo(() => {
    if (!ahora) return undefined;
    const desde = new Date(ahora);
    desde.setDate(desde.getDate() - 30);
    return { desde: aFecha(desde), hasta: aFecha(ahora) };
  }, [ahora]);
  const [sesiones] = useSesiones(rango);

  const hoyClave = ahora ? aFecha(ahora) : null;
  const minutosHoy = useMemo(
    () => sesiones.filter((s) => s.fecha === hoyClave).reduce((n, s) => n + s.minutos, 0),
    [sesiones, hoyClave],
  );
  const minutosSemana = useMemo(() => {
    if (!ahora) return 0;
    const desde = new Date(ahora);
    desde.setDate(desde.getDate() - 6);
    const corte = aFecha(desde);
    return sesiones.filter((s) => s.fecha >= corte).reduce((n, s) => n + s.minutos, 0);
  }, [sesiones, ahora]);

  return (
    <mo.section className="vista on met" variants={ORQUESTA} aria-label="Métodos de estudio">
      <mo.div className="met-cab" variants={PIEZA}>
        <h1 className="met-titulo">Métodos de estudio</h1>
        <p className="met-placa">
          <span>
            <b>{enHoras(minutosHoy)}</b> hoy
          </span>
          <i aria-hidden="true" />
          <span>
            <b>{enHoras(minutosSemana)}</b> esta semana
          </span>
          {/* La placa suma lo terminado, así que un pomodoro a mitad no aparecería en
              ninguna de las dos cifras. Aquí es donde hay que decirlo. */}
          {marcha && (
            <>
              <i aria-hidden="true" />
              <span className="met-placa-vivo">
                <em aria-hidden="true" />
                <b>{reloj(restante)}</b> {marcha.fase === 'estudio' ? 'estudiando' : 'de descanso'}
              </span>
            </>
          )}
        </p>
      </mo.div>

      {/*
        Las tres tarjetas y la abierta viven en el mismo `AnimatePresence` porque son la
        misma cosa en dos tamaños: al abrir, `layoutId` encuentra la caja grande justo
        cuando la pequeña se va, y la lleva. Separarlos en dos presencias haría que la
        pequeña desapareciera antes de que la grande existiera, y entonces no hay viaje
        que hacer — se vería un corte.
      */}
      <mo.div className="met-zona" variants={PIEZA}>
        <AnimatePresence mode="wait" initial={false}>
          {abierto === null ? (
            <mo.div className="met-taller" key="taller" variants={METODO_APARTADO} animate="dentro" exit="saliendo">
              {METODOS.map((m) => (
                <Tarjeta
                  key={m.clave}
                  metodo={m}
                  alAbrir={() => setAbierto(m.clave)}
                  sesiones={sesiones}
                  marcha={m.clave === 'pomodoro' ? marcha : null}
                  restante={restante}
                />
              ))}
            </mo.div>
          ) : (
            <Abierto
              key={abierto}
              metodo={METODOS.find((m) => m.clave === abierto) as Metodo}
              sesiones={sesiones}
              ahora={ahora}
              cerrar={() => setAbierto(null)}
            />
          )}
        </AnimatePresence>
      </mo.div>
    </mo.section>
  );
}

/* ───────────────────────── una tarjeta cerrada ───────────────────────── */

function Tarjeta({
  metodo,
  alAbrir,
  sesiones,
  marcha,
  restante,
}: {
  metodo: Metodo;
  alAbrir: () => void;
  sesiones: Sesion[];
  /** Solo la tarjeta del pomodoro lo recibe, y solo si hay uno corriendo. */
  marcha: EnMarcha | null;
  restante: number;
}) {
  /* Corriendo, el color de la tarjeta es el de la asignatura y no el del método: lo que
     identifica un pomodoro vivo es de QUÉ es, no que sea un pomodoro. */
  const asig = marcha ? ASIGNATURAS[marcha.asignatura as ClaveAsignatura] : undefined;
  return (
    <mo.button
      type="button"
      className={`met-tarjeta${marcha ? ' viva' : ''}`}
      /* El mismo `layoutId` que la versión abierta: de aquí sale el viaje. */
      layoutId={`met-${metodo.clave}`}
      style={{ ['--tc' as string]: asig ? `var(--c-${asig.color})` : `var(--c-${metodo.color})` }}
      onClick={alAbrir}
      whileHover={{ y: -10, transition: MUELLE.vivo }}
      whileFocus={{ y: -10, transition: MUELLE.vivo }}
      whileTap={{ y: -3, transition: MUELLE.vivo }}
      transition={MUELLE.normal}
    >
      <mo.span className="met-muestra" layoutId={`met-muestra-${metodo.clave}`} aria-hidden="true">
        {marcha ? <AnilloVivo marcha={marcha} restante={restante} /> : <Muestra clave={metodo.clave} sesiones={sesiones} />}
      </mo.span>
      <mo.h2 className="met-nombre" layoutId={`met-nombre-${metodo.clave}`}>
        {metodo.nombre}
      </mo.h2>
      <span className="met-pie">
        {marcha ? `${marcha.fase === 'estudio' ? 'Estudiando' : 'Descansando'} · ${asig?.nombre ?? marcha.asignatura}` : metodo.pie}
      </span>
      <span className="met-ir">
        {marcha ? 'Volver' : metodo.listo ? 'Empezar' : 'Ver'}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m10 6 6 6-6 6" />
        </svg>
      </span>
    </mo.button>
  );
}

/**
 * El anillo de la tarjeta cuando hay un pomodoro corriendo.
 *
 * Es el **mismo dibujo** que la muestra decorativa, con el número de verdad dentro. La
 * tarjeta no cambia de forma al arrancar: lo que cambia es que empieza a decir la verdad.
 */
function AnilloVivo({ marcha, restante }: { marcha: EnMarcha; restante: number }) {
  const vuelta = 2 * Math.PI * 70;
  const total = marcha.largo * 60;
  const tanto = total > 0 ? 1 - restante / total : 0;
  return (
    <span className="met-vivo">
      <svg viewBox="0 0 160 160" className="met-anillo" aria-hidden="true">
        <circle cx="80" cy="80" r="70" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="9" />
        <circle
          cx="80"
          cy="80"
          r="70"
          fill="none"
          stroke="var(--tc)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={vuelta}
          strokeDashoffset={vuelta * (1 - tanto)}
          transform="rotate(-90 80 80)"
          /* El avance lo lleva el CSS, igual que en la tarjeta abierta: Motion no toca
             esta propiedad, y una propiedad tiene un dueño. */
          style={{ transition: 'stroke-dashoffset 950ms var(--ease-out)' }}
        />
      </svg>
      <span className="met-vivo-cifra">{reloj(restante)}</span>
    </span>
  );
}

/** Lo que cada tarjeta enseña por dentro: no un icono, sino el método en pequeño. */
function Muestra({ clave, sesiones }: { clave: Clave; sesiones: Sesion[] }) {
  if (clave === 'pomodoro') {
    const vuelta = 2 * Math.PI * 70;
    return (
      <svg viewBox="0 0 160 160" className="met-anillo" aria-hidden="true">
        <circle cx="80" cy="80" r="70" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="9" />
        <mo.circle
          cx="80"
          cy="80"
          r="70"
          fill="none"
          stroke="var(--tc)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={vuelta}
          transform="rotate(-90 80 80)"
          initial={{ strokeDashoffset: vuelta }}
          animate={{ strokeDashoffset: vuelta * 0.28 }}
          transition={{ duration: TIEMPO.viaje * 1.6, ease: CURVA.salida, delay: 0.2 }}
        />
      </svg>
    );
  }

  if (clave === 'repaso') {
    /* La escalera: cada repaso más corto que el anterior, que es el método dibujado. */
    const pasos = [1, 0.78, 0.56, 0.36, 0.18];
    return (
      <span className="met-escalera">
        {pasos.map((p, i) => (
          <span className="met-peldano" key={p}>
            <mo.i
              style={{ background: 'var(--tc)' }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: p }}
              transition={{ duration: TIEMPO.paso, ease: CURVA.salida, delay: 0.18 + i * 0.07 }}
            />
          </span>
        ))}
      </span>
    );
  }

  const cuantas = sesiones.length;
  return (
    <svg viewBox="0 0 200 150" className="met-alzado" fill="none" stroke="var(--tc)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 128h160" stroke="rgba(255,255,255,.22)" />
      <path d="M46 128V58l54-30 54 30v70" />
      <path d="M46 58 100 28l54 30" />
      <path d="M70 128V92h22v36" opacity={cuantas ? 0.7 : 0.55} />
      <path d="M112 86h26v26h-26z" opacity="0.6" />
    </svg>
  );
}

/* ───────────────────────── la tarjeta abierta ───────────────────────── */

function Abierto({
  metodo,
  sesiones,
  ahora,
  cerrar,
}: {
  metodo: Metodo;
  sesiones: Sesion[];
  ahora: Date | null;
  cerrar: () => void;
}) {
  /* Escape cierra, que es lo que todo el mundo intenta antes de buscar la equis. */
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [cerrar]);

  return (
    <mo.div
      className="met-abierto"
      layoutId={`met-${metodo.clave}`}
      style={{ ['--tc' as string]: `var(--c-${metodo.color})` }}
      transition={MUELLE.normal}
    >
      <div className="met-abierto-cab">
        <mo.h2 className="met-nombre grande" layoutId={`met-nombre-${metodo.clave}`}>
          {metodo.nombre}
        </mo.h2>
        <Button type="button" variant="outline" size="sm" onClick={cerrar}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
          Cerrar
        </Button>
      </div>

      <mo.div className="met-abierto-cuerpo" variants={DENTRO_DEL_METODO} initial="fuera" animate="dentro" exit="saliendo">
        {metodo.clave === 'pomodoro' ? (
          <Pomodoro sesiones={sesiones} ahora={ahora} />
        ) : metodo.clave === 'repaso' ? (
          <Planificador ahora={ahora} />
        ) : (
          <PorDefinir metodo={metodo} />
        )}
      </mo.div>
    </mo.div>
  );
}

/**
 * Un método que todavía no es.
 *
 * Dice lo que falta decidir en vez de enseñar una maqueta que no funciona. Una pantalla
 * que parece terminada y no hace nada se prueba, falla y se lee como una aplicación rota;
 * una que dice «esto aún no está» no engaña a nadie.
 */
function PorDefinir({ metodo }: { metodo: Metodo }) {
  const faltan =
    metodo.clave === 'repaso'
      ? [
          'Quién decide cuándo toca repasar: ¿lo propone Archicel y tú lo mueves, o lo colocas a mano?',
          'Qué se repasa: ¿la asignatura entera, un tema, o un apunte? Las etiquetas podrían ser la unidad.',
          'A qué horas van los cuatro bloques del día, para que convivan con las clases.',
          'Qué pasa con el repaso que no se hizo: ¿se arrastra, se pierde, o reinicia la cuenta?',
        ]
      : ['Qué es Sketchap exactamente: ¿SketchUp, dibujar a mano, otra cosa?'];

  return (
    <div className="met-pordefinir">
      <p className="met-pordefinir-txt">
        Este método todavía no está construido, y lo que falta no es tiempo: son decisiones.
      </p>
      <ul className="met-faltan">
        {faltan.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <p className="met-pordefinir-pie">Están apuntadas en docs/ideas/IDEAS.md.</p>
    </div>
  );
}

/* ───────────────────────── el pomodoro ───────────────────────── */

function Pomodoro({ sesiones, ahora }: { sesiones: Sesion[]; ahora: Date | null }) {
  const { almacen } = useArchicel();
  const { avisar } = useUI();

  const [estudio, setEstudio] = useState(25);
  const [descanso, setDescanso] = useState(5);
  const [asignatura, setAsignatura] = useState<string | undefined>(CLAVES_ASIGNATURA[0]);
  const [marcha, setMarcha] = useState<EnMarcha | null>(null);
  const [restante, setRestante] = useState(0);
  const anotado = useRef<number | null>(null);

  /**
   * Al montar se lee lo recordado y se calcula lo que queda **desde el arranque**.
   *
   * Es lo que hace que el pomodoro sobreviva a recargar y a cambiar de pantalla. Un
   * contador que vive en memoria se pierde con la pestaña, y veinticinco minutos son
   * muchos para no tocar nada.
   */
  useEffect(() => {
    const g = leerMarcha();
    if (!g) return;
    setMarcha(g);
    if (g.fase === 'estudio') setEstudio(g.largo);
  }, []);

  const guardarSesion = useCallback(
    async (m: EnMarcha) => {
      if (m.fase !== 'estudio' || anotado.current === m.arranque) return;
      anotado.current = m.arranque;
      const inicio = new Date(m.arranque);
      try {
        await almacen.sesiones.guardar({
          id: nuevoId('s'),
          asignatura: m.asignatura,
          fecha: aFecha(inicio),
          minutos: m.largo,
          metodo: 'pomodoro',
          ini: inicio.getHours() * 60 + inicio.getMinutes(),
          creado: Date.now(),
        });
      } catch {
        avisar('No se pudo apuntar la sesión.');
      }
    },
    [almacen, avisar],
  );

  /* El latido. Se recalcula contra el reloj real, no se descuenta un segundo cada vez:
     si la pestaña se queda dormida, al volver el número es el correcto y no uno viejo. */
  useEffect(() => {
    if (!marcha) {
      setRestante(0);
      return;
    }
    const mirar = () => {
      const quedan = quedanDe(marcha);
      setRestante(quedan);
      if (quedan <= 0) {
        void guardarSesion(marcha);
        const siguiente: EnMarcha = {
          asignatura: marcha.asignatura,
          arranque: Date.now(),
          largo: marcha.fase === 'estudio' ? descanso : estudio,
          fase: marcha.fase === 'estudio' ? 'descanso' : 'estudio',
        };
        setMarcha(siguiente);
        escribirMarcha(siguiente);
        avisar(marcha.fase === 'estudio' ? 'Pomodoro terminado. Descansa.' : 'Descanso terminado.');
      }
    };
    mirar();
    const t = setInterval(mirar, 1000);
    return () => clearInterval(t);
  }, [marcha, descanso, estudio, guardarSesion, avisar]);

  const arrancar = () => {
    if (!asignatura) return;
    const nueva: EnMarcha = { asignatura, arranque: Date.now(), largo: estudio, fase: 'estudio' };
    anotado.current = null;
    setMarcha(nueva);
    escribirMarcha(nueva);
  };

  const parar = () => {
    setMarcha(null);
    anotado.current = null;
    escribirMarcha(null);
  };

  const total = (marcha?.largo ?? estudio) * 60;
  const vuelta = 2 * Math.PI * 78;
  /**
   * Cuánto se ha recorrido del anillo. **Parado es cero**, no uno.
   *
   * Sin la comprobación de `marcha`, `restante` vale 0 estando quieto y la cuenta daba el
   * anillo entero pintado: parecía un pomodoro recién terminado en vez de uno que aún no
   * ha empezado, que es justo lo contrario.
   */
  const tanto = marcha && total > 0 ? 1 - restante / total : 0;
  /* El color sale de la asignatura elegida, corriendo o no: el anillo dice de qué es
     antes de empezar, que es cuando hace falta saberlo. */
  const clave = marcha?.asignatura ?? asignatura;
  const asig = clave ? ASIGNATURAS[clave as ClaveAsignatura] : undefined;

  return (
    <div className="met-pomo">
      <div className="met-pomo-reloj">
        <div className="met-pomo-anillo" style={asig ? { ['--tc' as string]: `var(--c-${asig.color})` } : undefined}>
          <svg viewBox="0 0 176 176" aria-hidden="true">
            <circle cx="88" cy="88" r="78" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="10" />
            <circle
              cx="88"
              cy="88"
              r="78"
              fill="none"
              stroke="var(--tc)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={vuelta}
              strokeDashoffset={vuelta * (1 - tanto)}
              transform="rotate(-90 88 88)"
              style={{ transition: 'stroke-dashoffset 950ms var(--ease-out)' }}
            />
          </svg>
          <div className="met-pomo-cifra">
            <span className="met-pomo-min">{marcha ? reloj(restante) : reloj(estudio * 60)}</span>
            <span className="met-pomo-fase">{marcha ? (marcha.fase === 'estudio' ? 'estudio' : 'descanso') : 'sin empezar'}</span>
          </div>
        </div>

        {/* El nombre va también parado: sin él, el anillo de color no dice de qué es y
            la columna da un salto de maquetación justo al arrancar, que es el peor
            momento posible para que algo se mueva sin motivo. */}
        <p className="met-pomo-que">{asig?.nombre ?? marcha?.asignatura ?? 'Elige una asignatura'}</p>

        {marcha ? (
          <Button type="button" variant="outline" onClick={parar}>
            Parar
          </Button>
        ) : (
          <Button type="button" onClick={arrancar} disabled={!asignatura}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 4l12 8-12 8z" />
            </svg>
            Empezar
          </Button>
        )}
      </div>

      <div className="met-pomo-lados">
        {/* La configuración vive donde se usa: no hay una pantalla de ajustes aparte. */}
        <div className="met-ajustes">
          {/* La etiqueta del selector es visible, no solo `aria-label`: al lado de dos
              grupos rotulados —ESTUDIO, DESCANSO— un desplegable sin rótulo se lee como un
              campo que nadie se molestó en nombrar. */}
          <div className="met-dur met-dur-asig">
            <span className="met-dur-et" id="met-que">Qué vas a estudiar</span>
            <SelectorAsignatura valor={asignatura} onCambio={setAsignatura} etiqueta="Qué vas a estudiar" />
          </div>

          <Duracion etiqueta="Estudio" valor={estudio} opciones={[15, 25, 50]} alCambiar={setEstudio} bloqueado={Boolean(marcha)} />
          <Duracion etiqueta="Descanso" valor={descanso} opciones={[5, 10, 15]} alCambiar={setDescanso} bloqueado={Boolean(marcha)} />
        </div>

        <Registro sesiones={sesiones} ahora={ahora} />
      </div>
    </div>
  );
}

function Duracion({
  etiqueta,
  valor,
  opciones,
  alCambiar,
  bloqueado,
}: {
  etiqueta: string;
  valor: number;
  opciones: number[];
  alCambiar: (n: number) => void;
  bloqueado: boolean;
}) {
  return (
    <div className="met-dur">
      <span className="met-dur-et">{etiqueta}</span>
      <div className="met-dur-ops" role="group" aria-label={etiqueta}>
        {opciones.map((o) => (
          <button
            key={o}
            type="button"
            className={`met-dur-op${o === valor ? ' on' : ''}`}
            aria-pressed={o === valor}
            disabled={bloqueado}
            onClick={() => alCambiar(o)}
          >
            <b>{o}</b> min
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * El registro, que es el producto.
 *
 * Se pidió «ver a qué le he dedicado más tiempo», así que esto no es un añadido al
 * cronómetro: es para lo que existe el cronómetro. Suma por asignatura y ordena por
 * tiempo, que es la pregunta que contesta.
 */
function Registro({ sesiones, ahora }: { sesiones: Sesion[]; ahora: Date | null }) {
  const filas = useMemo(() => {
    const n = new Map<string, number>();
    for (const s of sesiones) n.set(s.asignatura, (n.get(s.asignatura) ?? 0) + s.minutos);
    const lista = [...n.entries()]
      .map(([clave, minutos]) => ({ clave, minutos, asig: ASIGNATURAS[clave as ClaveAsignatura] }))
      .filter((f) => f.asig)
      .sort((a, b) => b.minutos - a.minutos);
    const techo = lista[0]?.minutos ?? 1;
    return lista.map((f) => ({ ...f, parte: f.minutos / techo }));
  }, [sesiones]);

  const ultima = sesiones[0];

  return (
    <div className="met-registro">
      <div className="met-registro-cab">
        <h3>A qué le has dedicado tiempo</h3>
        <span>últimos 30 días</span>
      </div>

      {filas.length === 0 ? (
        <p className="met-registro-vacio">
          Todavía no hay ninguna sesión. Empieza un pomodoro y aquí se irá sumando.
        </p>
      ) : (
        <ul className="met-filas">
          {filas.map((f) => (
            <li className="met-fila" key={f.clave} style={{ ['--tc' as string]: `var(--c-${f.asig.color})` }}>
              <i className="met-punto" aria-hidden="true" />
              <b className="met-fila-nombre">{f.asig.nombre}</b>
              <span className="met-fila-barra" aria-hidden="true">
                <mo.i initial={{ scaleX: 0 }} animate={{ scaleX: f.parte }} transition={{ duration: TIEMPO.viaje, ease: CURVA.salida }} />
              </span>
              <span className="met-fila-tiempo">{enHoras(f.minutos)}</span>
            </li>
          ))}
        </ul>
      )}

      {ultima && ahora && (
        <p className="met-registro-pie">
          Lo último: {ASIGNATURAS[ultima.asignatura as ClaveAsignatura]?.nombre ?? ultima.asignatura} · {enHoras(ultima.minutos)} · {cuando(ultima.fecha, ahora)}
        </p>
      )}
    </div>
  );
}

/* ───────────────────────── de números a palabras ───────────────────────── */

function reloj(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** «45 min», «1 h 15», «3 h». Nunca «75 minutos», que nadie dice. */
function enHoras(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

function cuando(fecha: string, ahora: Date): string {
  const hoyClave = aFecha(ahora);
  if (fecha === hoyClave) return 'hoy';
  const ayer = new Date(ahora);
  ayer.setDate(ayer.getDate() - 1);
  if (fecha === aFecha(ayer)) return 'ayer';
  return fecha.slice(8) + '/' + fecha.slice(5, 7);
}

/* ───────────────────────── el planificador del día ─────────────────────────
   La superficie del método de repasos: cuatro partes del día, dos horas cada una, y
   dentro de cada una las asignaturas que toquen. Se reparte arrastrando.

   **Por qué un bloque no es una `Tarea`**, que era la decisión que quedaba abierta: una
   tarea ocupa una franja del reloj —`ini` y `fin` en minutos desde medianoche— y esto
   ocupa una *parte del día*. «Mañana» no es «de 9 a 11»: las horas las sabe ella y
   cambian. Hacerlo tarea habría obligado a inventarle un horario que nadie pidió, y
   además habría mezclado «estudiar física» con «gimnasio» en la agenda del día y en el
   mes del calendario.
*/

interface Parte {
  clave: Franja;
  nombre: string;
  icono: ReactNode;
}

/** Las cuatro, en el orden en que se vive el día. */
const PARTES: Parte[] = [
  {
    clave: 'manana',
    nombre: 'Mañana',
    /* un sol saliendo por detrás de la línea del horizonte */
    icono: (
      <>
        <path d="M3 18h18" />
        <path d="M7.5 18a4.5 4.5 0 0 1 9 0" />
        <path d="M12 6.5V4M5.6 9.1 4.2 7.7M18.4 9.1l1.4-1.4" />
      </>
    ),
  },
  {
    clave: 'mediodia',
    nombre: 'Mediodía',
    /* el sol entero, arriba del todo */
    icono: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3.2V5M12 19v1.8M3.2 12H5M19 12h1.8M5.9 5.9 7.2 7.2M16.8 16.8l1.3 1.3M18.1 5.9l-1.3 1.3M7.2 16.8l-1.3 1.3" />
      </>
    ),
  },
  {
    clave: 'tarde',
    nombre: 'Tarde',
    /* el mismo horizonte que la mañana, con la flecha al revés: el sol baja */
    icono: (
      <>
        <path d="M3 18h18" />
        <path d="M7.5 18a4.5 4.5 0 0 1 9 0" />
        <path d="M12 4v3.9M9.7 5.6 12 7.9l2.3-2.3" />
      </>
    ),
  },
  {
    clave: 'noche',
    nombre: 'Noche',
    icono: <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4 8.4 8.4 0 1 0 20 14.2Z" />,
  },
];

/** El escalón mínimo. Media hora y hora y media salen de aquí sin teclear nada. */
const PASO = 15;

/**
 * El tipo de arrastre del planificador, distinto del de los apuntes.
 *
 * Con el mismo tipo, soltar un apunte sobre una parte del día habría parecido válido
 * hasta el instante en que no pasara nada. Dos tipos y la diana ni siquiera se enciende.
 */
const TIPO_BLOQUE = 'application/x-archicel-bloque';

function Planificador({ ahora }: { ahora: Date | null }) {
  const { almacen } = useArchicel();
  const { avisar } = useUI();

  /* Empieza en hoy, pero **cuando el cliente sabe qué día es**: la página se
     prerrenderiza y el servidor no conoce la fecha de la usuaria. A partir de ahí manda
     ella con las flechas, y por eso el día no se recalcula cada vez que `ahora` late. */
  const [dia, setDia] = useState<string | null>(null);
  useEffect(() => {
    setDia((d) => d ?? (ahora ? aFecha(ahora) : null));
  }, [ahora]);

  const [bloques, listo] = useBloques(dia);

  /** Lo que hay en cada parte del día, y cuánto lleva ocupado. */
  const porFranja = useMemo(() => {
    const m = new Map<Franja, { lista: Bloque[]; usados: number }>();
    for (const p of PARTES) m.set(p.clave, { lista: [], usados: 0 });
    for (const b of bloques) {
      const f = m.get(b.franja);
      if (!f) continue;
      f.lista.push(b);
      f.usados += b.minutos;
    }
    return m;
  }, [bloques]);

  const guardar = useCallback(
    async (b: Bloque) => {
      try {
        /* El documento entero, nunca un trozo: `merge` conserva lo que no se manda. */
        await almacen.bloques.guardar(b);
      } catch {
        avisar('No se pudo guardar el plan.');
      }
    },
    [almacen, avisar],
  );

  const quitar = useCallback(
    async (id: string) => {
      try {
        await almacen.bloques.borrar(id);
      } catch {
        avisar('No se pudo quitar el bloque.');
      }
    },
    [almacen, avisar],
  );

  /** Minutos libres en una franja, sin contar lo que ya ocupa `salvo` si está en ella. */
  const libreEn = useCallback(
    (f: Franja, salvo?: Bloque) => {
      const usados = porFranja.get(f)?.usados ?? 0;
      return MINUTOS_POR_FRANJA - usados + (salvo && salvo.franja === f ? salvo.minutos : 0);
    },
    [porFranja],
  );

  /**
   * Meter una asignatura en una parte del día: se lleva **todo lo que quede libre**.
   *
   * Que una asignatura sola ocupe las dos horas es el caso corriente —«por la mañana, dos
   * horas de mates»—, así que es lo que pasa sin tocar nada más. Para partir el bloque se
   * encoge con el «−» y en el hueco que aparece entra la siguiente.
   */
  const colocar = useCallback(
    (clave: string, f: Franja) => {
      const libre = libreEn(f);
      if (libre < PASO) {
        avisar('Esa parte del día ya está llena.');
        return;
      }
      void guardar({
        id: nuevoId('b'),
        fecha: dia ?? hoy(),
        franja: f,
        asignatura: clave,
        minutos: libre,
        creado: Date.now(),
      });
    },
    [dia, guardar, libreEn, avisar],
  );

  /** Mudar un bloque de una parte del día a otra. */
  const mudar = useCallback(
    (b: Bloque, f: Franja) => {
      if (b.franja === f) return;
      const libre = libreEn(f, b);
      if (libre < PASO) {
        avisar(`En ${nombreDe(f)} no queda sitio.`);
        return;
      }
      /* Si no cabe entero se muda **recortado** en vez de negarse, y la pantalla lo dice.
         Negar el gesto dejaría arrastrando contra un muro sin saber cuánto hay que
         liberar antes de volver a intentarlo. */
      const minutos = Math.min(b.minutos, libre);
      if (minutos < b.minutos) avisar(`Solo cabía ${enHoras(minutos)}: se movió recortado.`);
      void guardar({ ...b, franja: f, minutos, actualizado: Date.now() });
    },
    [guardar, libreEn, avisar],
  );

  const estirar = useCallback(
    (b: Bloque, delta: number) => {
      const minutos = b.minutos + delta;
      if (minutos < PASO || minutos > libreEn(b.franja, b)) return;
      void guardar({ ...b, minutos, actualizado: Date.now() });
    },
    [guardar, libreEn],
  );

  const mover = (pasos: number) => {
    if (!dia) return;
    const d = deFecha(dia);
    d.setDate(d.getDate() + pasos);
    setDia(aFecha(d));
  };

  const esHoy = Boolean(ahora && dia === aFecha(ahora));
  const repartido = bloques.reduce((n, b) => n + b.minutos, 0);

  return (
    <div className="pl">
      <div className="pl-barra-dia">
        <button type="button" className="pl-flecha" onClick={() => mover(-1)} aria-label="Día anterior">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m14 6-6 6 6 6" />
          </svg>
        </button>

        {/* Mientras el cliente no sepa qué día es, el hueco se reserva en vez de pintar
            una fecha del servidor que cambiaría sola al hidratar. */}
        <p className="pl-fecha">
          {dia ? (
            <>
              {diaLargo(dia)}
              {esHoy && <span className="pl-hoy">hoy</span>}
            </>
          ) : (
            <span className="pl-fecha-espera" aria-hidden="true" />
          )}
        </p>

        <button type="button" className="pl-flecha" onClick={() => mover(1)} aria-label="Día siguiente">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m10 6 6 6-6 6" />
          </svg>
        </button>

        {!esHoy && ahora && (
          <button type="button" className="pl-volver" onClick={() => setDia(aFecha(ahora))}>
            Volver a hoy
          </button>
        )}

        <span className="pl-total">
          <b>{enHoras(repartido)}</b> de {enHoras(MINUTOS_POR_FRANJA * PARTES.length)} repartidas
        </span>
      </div>

      {/* De aquí se arrastran las asignaturas a las partes del día. */}
      <div className="pl-paleta">
        {CLAVES_ASIGNATURA.map((k) => {
          const a = ASIGNATURAS[k];
          return (
            <span
              key={k}
              className="pl-chip"
              draggable
              style={{ ['--tc' as string]: `var(--c-${a.color})` }}
              /* `onDragStartCapture` y no `onDragStart`: Motion declara el suyo —el de su
                 gesto de arrastre— y tapa el del DOM, que es el que lleva `dataTransfer`. */
              onDragStartCapture={(e) => e.dataTransfer.setData(TIPO_BLOQUE, `n:${k}`)}
            >
              <i aria-hidden="true" />
              {a.nombre}
            </span>
          );
        })}
      </div>

      <mo.div className="pl-rejilla" variants={REPARTO}>
        {PARTES.map((p) => {
          const usados = porFranja.get(p.clave)?.usados ?? 0;
          return (
            <ParteDelDia
              key={p.clave}
              parte={p}
              bloques={porFranja.get(p.clave)?.lista ?? []}
              usados={usados}
              libre={MINUTOS_POR_FRANJA - usados}
              listo={listo}
              alSoltar={(carga) => {
                const i = carga.indexOf(':');
                const que = carga.slice(0, i);
                const valor = carga.slice(i + 1);
                if (que === 'n') {
                  colocar(valor, p.clave);
                } else {
                  const b = bloques.find((x) => x.id === valor);
                  if (b) mudar(b, p.clave);
                }
              }}
              alColocar={(clave) => colocar(clave, p.clave)}
              estirar={estirar}
              quitar={quitar}
            />
          );
        })}
      </mo.div>
    </div>
  );
}

function nombreDe(f: Franja): string {
  return PARTES.find((p) => p.clave === f)?.nombre.toLowerCase() ?? 'esa parte del día';
}

/** Una de las cuatro columnas: la cabecera, la pista de dos horas y lo que queda libre. */
function ParteDelDia({
  parte,
  bloques,
  usados,
  libre,
  listo,
  alSoltar,
  alColocar,
  estirar,
  quitar,
}: {
  parte: Parte;
  bloques: Bloque[];
  usados: number;
  libre: number;
  listo: boolean;
  alSoltar: (carga: string) => void;
  alColocar: (clave: string) => void;
  estirar: (b: Bloque, delta: number) => void;
  quitar: (id: string) => void;
}) {
  const [encima, setEncima] = useState(false);
  const [eligiendo, setEligiendo] = useState(false);

  return (
    <mo.section
      className={`pl-parte${encima ? ' diana' : ''}`}
      variants={FRANJA}
      onDragOver={(e) => {
        /* Solo lo nuestro: un fichero arrastrado del escritorio no es un bloque, y sin
           esta comprobación la diana se encendía para algo que no se podía soltar. */
        if (!e.dataTransfer.types.includes(TIPO_BLOQUE)) return;
        e.preventDefault();
        setEncima(true);
      }}
      onDragLeave={() => setEncima(false)}
      onDrop={(e) => {
        e.preventDefault();
        setEncima(false);
        const carga = e.dataTransfer.getData(TIPO_BLOQUE);
        if (carga) alSoltar(carga);
      }}
    >
      <header className="pl-cab">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {parte.icono}
        </svg>
        <h3>{parte.nombre}</h3>
        <span className={`pl-cuenta${usados === MINUTOS_POR_FRANJA ? ' llena' : ''}`}>
          {enHoras(usados)}
          <i aria-hidden="true">/</i>
          {enHoras(MINUTOS_POR_FRANJA)}
        </span>
      </header>

      {/* La pista **son** las dos horas: lo que ocupa cada bloque es su parte del alto, y
          el hueco libre mide lo que falta. Las proporciones se leen sin leer un número,
          que es la misma idea que el ancho de las columnas de `/asignaturas`. */}
      <div className="pl-pista">
        {bloques.map((b) => (
          <Barra key={b.id} bloque={b} estirar={estirar} quitar={quitar} />
        ))}

        {libre >= PASO && (
          <mo.div className="pl-libre" layout style={{ flexGrow: libre }} variants={CELDA}>
            {eligiendo ? (
              <div className="pl-elegir">
                {CLAVES_ASIGNATURA.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="pl-elegir-op"
                    style={{ ['--tc' as string]: `var(--c-${ASIGNATURAS[k].color})` }}
                    onClick={() => {
                      alColocar(k);
                      setEligiendo(false);
                    }}
                  >
                    <i aria-hidden="true" />
                    {ASIGNATURAS[k].nombre}
                  </button>
                ))}
                <button type="button" className="pl-elegir-no" onClick={() => setEligiendo(false)}>
                  Cancelar
                </button>
              </div>
            ) : (
              /* Botón además de diana. Arrastrar es el gesto que se pidió, pero una
                 superficie que SOLO acepta arrastres no se usa con el teclado y no se
                 descubre sola: hay que saber ya que se puede arrastrar algo hasta ahí. */
              <button type="button" className="pl-libre-btn" onClick={() => setEligiendo(true)}>
                <span className="pl-libre-signo" aria-hidden="true">+</span>
                <span className="pl-libre-txt">{listo ? `${enHoras(libre)} sin repartir` : 'Cargando…'}</span>
              </button>
            )}
          </mo.div>
        )}
      </div>
    </mo.section>
  );
}

/** Un rato de estudio dentro de una parte del día. Su alto **son** sus minutos. */
function Barra({
  bloque,
  estirar,
  quitar,
}: {
  bloque: Bloque;
  estirar: (b: Bloque, delta: number) => void;
  quitar: (id: string) => void;
}) {
  const a = ASIGNATURAS[bloque.asignatura as ClaveAsignatura];
  return (
    <mo.div
      className="pl-barra"
      layout
      variants={CELDA}
      draggable
      onDragStartCapture={(e) => e.dataTransfer.setData(TIPO_BLOQUE, `b:${bloque.id}`)}
      style={{
        ['--tc' as string]: a ? `var(--c-${a.color})` : 'var(--hairline-lit)',
        flexGrow: bloque.minutos,
      }}
      transition={MUELLE.normal}
    >
      <span className="pl-barra-que">{a?.nombre ?? bloque.asignatura}</span>
      <span className="pl-barra-cuanto">{enHoras(bloque.minutos)}</span>

      <span className="pl-mandos">
        <button type="button" onClick={() => estirar(bloque, -PASO)} aria-label="Quitar quince minutos">
          −
        </button>
        <button type="button" onClick={() => estirar(bloque, PASO)} aria-label="Añadir quince minutos">
          +
        </button>
        <button type="button" className="pl-quita" onClick={() => quitar(bloque.id)} aria-label="Quitar del plan">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </span>
    </mo.div>
  );
}

/** «Martes, 27 de octubre». Con mayúscula, que es el principio de una frase. */
function diaLargo(f: string): string {
  const t = deFecha(f).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}
