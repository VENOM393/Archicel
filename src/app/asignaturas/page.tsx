'use client';

/**
 * La estantería: elegir asignatura.
 *
 * Seis asignaturas, seis lomos de pie sobre una balda. Es la pantalla que faltaba — hasta
 * ahora a una asignatura solo se llegaba pulsando una clase en el horario, que obliga a
 * buscar en una rejilla de cinco días la casilla de lo que ya sabes que quieres abrir.
 *
 * ## Por qué lomos y no tarjetas
 *
 * Una rejilla de seis tarjetas iguales es la estructura que el contrato visual prohíbe por
 * su nombre, y con razón: seis rectángulos idénticos no tienen jerarquía, así que la
 * mirada los recorre uno por uno en vez de reconocer el que busca. Un lomo sí se reconoce,
 * y por lo mismo que se reconoce un libro en una estantería de verdad — por su sitio, su
 * color y **su grosor**.
 *
 * ## El grosor es un dato, no un adorno
 *
 * El ancho de cada lomo son sus horas de clase a la semana, sacadas del horario. Una
 * asignatura de cuatro horas es un libro del doble de ancho que una de dos. Nadie tiene
 * que leer eso en ningún sitio: se ve, y resulta ser verdad. Si un cuatrimestre cambia las
 * horas, la estantería cambia sola.
 *
 * La **altura** no es un dato y no finge serlo: sale del código de la asignatura para que
 * sea siempre la misma, y está porque en una estantería real los libros no están
 * enrasados. Es realismo, y se queda en realismo.
 *
 * ## El movimiento
 *
 * Los libros se colocan —llegan inclinados desde abajo y se enderezan al apoyarse—, y la
 * balda ya está puesta antes de que llegue el primero. Eso es a propósito: lo que se anima
 * es que la estantería se llena, no que una página aparece.
 *
 * Al elegir uno, el resto se retira y el elegido se queda. La salida de la página dura
 * 155 ms, así que esa retirada es corta de verdad: lo que pase de ahí no se ve, solo se
 * paga en espera después de pulsar.
 */

import Link from 'next/link';
import { useMemo, useState } from 'react';
import * as mo from 'motion/react-m';

import { LOMO, MUELLE, ORQUESTA, PIEZA } from '@/lib/ui/movimiento';
import {
  ASIGNATURAS,
  CLAVES_ASIGNATURA,
  horasSemanalesDe,
  type ClaveAsignatura,
} from '@/lib/data';

/**
 * Cuánto se levanta un lomo con el cursor encima.
 *
 * Lo lleva Motion y no un `:hover` de la hoja de estilos, porque una propiedad la controla
 * Motion o la controla el CSS y nunca las dos: la regla de `transform` ya está escrita por
 * la variante que coloca el libro, y un `:hover` que también la tocara ganaría a Motion y
 * dejaría el lomo clavado en el último fotograma.
 *
 * El color sí se queda en el CSS, que no toca ninguna propiedad animada aquí.
 */
const LEVANTA = { y: -14, transition: MUELLE.vivo };
const PULSA = { y: -5, transition: MUELLE.vivo };

/** La altura de un lomo, en porcentaje de la estantería. Estable y sin azar. */
function alturaDe(codigo: string): number {
  return 90 + (Number(codigo) % 5) * 2.4;
}

export default function Asignaturas() {
  /** La que se está abriendo, para que el resto se aparte. */
  const [abriendo, setAbriendo] = useState<ClaveAsignatura | null>(null);

  const horas = useMemo(
    () => CLAVES_ASIGNATURA.reduce((s, k) => s + horasSemanalesDe(k), 0),
    [],
  );

  return (
    <mo.section className="vista on est" variants={ORQUESTA} aria-label="Asignaturas">
      {/* Sin antetítulo: el titular se sostiene solo. */}
      <mo.div className="est-cab" variants={PIEZA}>
        <h1 className="sem-titulo">
          <span className="rango">Asignaturas</span>{' '}
          <span className="anio">primer cuatrimestre</span>
        </h1>
        <span className="seg-nota">
          {CLAVES_ASIGNATURA.length} asignaturas · {horas} h de clase a la semana
        </span>
      </mo.div>

      {/* La balda la dibuja el CSS y está puesta desde el primer fotograma: los libros
          llegan a una estantería, no aparecen con ella. */}
      <mo.ul className="est-fila" variants={ORQUESTA}>
        {CLAVES_ASIGNATURA.map((clave, i) => (
          <Lomo
            key={clave}
            clave={clave}
            indice={i}
            abriendo={abriendo}
            alElegir={() => setAbriendo(clave)}
          />
        ))}
      </mo.ul>

      {CLAVES_ASIGNATURA.length === 0 && (
        <mo.p className="est-vacia" variants={PIEZA}>
          No hay asignaturas en el curso todavía.
        </mo.p>
      )}
    </mo.section>
  );
}

function Lomo({
  clave,
  indice,
  abriendo,
  alElegir,
}: {
  clave: ClaveAsignatura;
  indice: number;
  abriendo: ClaveAsignatura | null;
  alElegir: () => void;
}) {
  const a = ASIGNATURAS[clave];
  const horas = horasSemanalesDe(clave);
  const elegida = abriendo === clave;

  /**
   * Mientras no se elige nada, `animate` no se declara: el lomo hereda el estado del
   * envoltorio de página por el árbol de Motion, que es como entra todo en esta casa.
   * Declararlo siempre rompería esa herencia y la entrada se perdería en la primera carga.
   */
  const estado = abriendo === null ? undefined : elegida ? 'elegido' : 'aparta';

  return (
    <li className="est-hueco" style={{ ['--peso' as string]: horas }}>
      {/* `Link` por fuera y sin animar: es quien precarga la ruta, quien la abre en otra
          pestaña con el botón central y quien la alcanza con el teclado. Lo que se mueve
          es el lomo de dentro. */}
      <Link
        href={`/asignatura/${clave}`}
        prefetch
        className="est-puerta"
        aria-label={`${a.nombre}, ${horas} horas de clase a la semana`}
        onClick={alElegir}
      >
        <mo.span
          className={`est-lomo${elegida ? ' es-elegido' : ''}`}
          style={{
            ['--tc' as string]: `var(--c-${a.color})`,
            ['--alto' as string]: `${alturaDe(a.codigo)}%`,
          }}
          variants={LOMO}
          custom={indice}
          animate={estado}
          whileHover={LEVANTA}
          whileFocus={LEVANTA}
          whileTap={PULSA}
        >
          {/* Los dos filetes del lomo, arriba y abajo, que es lo que hace que un
              rectángulo de color se lea como un libro encuadernado y no como una pestaña. */}
          <span className="est-filete arriba" aria-hidden="true" />

          {/* Vertical y de abajo arriba, como se encuaderna en español. La rotación va en
              este `span` y no en el lomo: el lomo lo anima Motion y su `transform` tiene
              un solo dueño. */}
          <span className="est-nombre">{a.nombre}</span>

          <span className="est-pie">
            <span className="est-filete abajo" aria-hidden="true" />
            {/* El código es una referencia real de la escuela, así que va en la
                monoespaciada tabular igual que en el horario. */}
            <span className="est-cod">{a.codigo}</span>
          </span>
        </mo.span>
      </Link>
    </li>
  );
}
