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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as mo from 'motion/react-m';
import { AnimatePresence } from 'motion/react';

import {
  DENTRO_DEL_METODO,
  METODO_APARTADO,
  MUELLE,
  ORQUESTA,
  PIEZA,
  CURVA,
  TIEMPO,
} from '@/lib/ui/movimiento';
import { Button } from '@/components/ui/button';
import { SelectorAsignatura } from '@/components/campos/SelectorAsignatura';
import { useAhora, useSesiones } from '@/hooks/useDatos';
import { useArchicel } from '@/lib/firebase/sesion';
import { nuevoId } from '@/lib/data/almacen';
import { useUI } from '@/lib/ui/contexto';
import {
  ASIGNATURAS,
  CLAVES_ASIGNATURA,
  aFecha,
  type ClaveAsignatura,
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
    pie: 'Repasa hoy, mañana, a los tres días… Cada vez más lejos, y se queda.',
    color: 'azul',
    listo: false,
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
