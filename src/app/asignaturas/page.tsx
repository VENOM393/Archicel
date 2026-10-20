'use client';

/**
 * Elegir asignatura: seis columnas de cristal a todo el ancho.
 *
 * Es la pantalla que faltaba — hasta ahora a una asignatura solo se llegaba pulsando una
 * clase en el horario, que obliga a buscar en una rejilla de cinco días la casilla de lo
 * que ya sabes que quieres abrir.
 *
 * ## Por qué columnas y no tarjetas
 *
 * Una rejilla de seis tarjetas iguales es la estructura que el contrato visual prohíbe
 * por su nombre, y con razón: seis rectángulos idénticos no tienen jerarquía, así que la
 * mirada los recorre uno por uno en vez de reconocer el que busca. Aquí cada una se
 * reconoce por su sitio, su color y **su ancho**.
 *
 * ## El ancho es un dato, no un adorno
 *
 * El ancho de cada columna son sus horas de clase a la semana, sacadas del horario. Una
 * asignatura de cuatro horas ocupa el doble que una de dos. Nadie tiene que leer eso en
 * ningún sitio: se ve, y resulta ser verdad. Si un cuatrimestre cambia las horas, la
 * pantalla cambia sola.
 *
 * ## El cristal
 *
 * Es el mismo material del dock y de los paneles del escritorio: desenfoque del fondo,
 * relleno translúcido y filete claro arriba. No es un desenfoque de adorno — estas
 * columnas flotan sobre la fotografía, que es la única condición que el contrato le pone
 * al cristal. Lo que no puede haber es cristal **dentro** de cristal, y aquí dentro no
 * hay ninguno: la luz de color y el brillo son degradados, no una segunda superficie.
 *
 * ## El movimiento
 *
 * Las columnas suben desde abajo con muelle y escalonadas, cada una desde una altura
 * distinta. Al elegir una, las demás caen y la elegida crece.
 */

import Link from 'next/link';
import { useMemo, useState } from 'react';
import * as mo from 'motion/react-m';

import { COLUMNA, MUELLE, ORQUESTA, PIEZA } from '@/lib/ui/movimiento';
import {
  ASIGNATURAS,
  CLAVES_ASIGNATURA,
  horasSemanalesDe,
  type ClaveAsignatura,
} from '@/lib/data';

/**
 * Cuánto se levanta una columna con el cursor encima.
 *
 * Lo lleva Motion y no un `:hover` de la hoja de estilos, porque una propiedad la controla
 * Motion o la controla el CSS y nunca las dos: la regla de `transform` ya está escrita por
 * la variante que coloca la columna, y un `:hover` que también la tocara ganaría a Motion
 * y la dejaría clavada en el último fotograma.
 *
 * El color, el cristal y el brillo sí se quedan en el CSS, que no toca ninguna propiedad
 * animada aquí.
 */
const LEVANTA = { y: -12, transition: MUELLE.vivo };
const PULSA = { y: -4, transition: MUELLE.vivo };

export default function Asignaturas() {
  /** La que se está abriendo, para que las demás se aparten. */
  const [abriendo, setAbriendo] = useState<ClaveAsignatura | null>(null);

  const horas = useMemo(
    () => CLAVES_ASIGNATURA.reduce((s, k) => s + horasSemanalesDe(k), 0),
    [],
  );

  return (
    <mo.section className="vista on est" variants={ORQUESTA} aria-label="Asignaturas">
      {/* Sin antetítulo: el titular se sostiene solo. */}
      <mo.div className="est-cab" variants={PIEZA}>
        <h1 className="est-titulo">
          Asignaturas <span className="anio">primer cuatrimestre</span>
        </h1>
        <span className="est-nota">
          {CLAVES_ASIGNATURA.length} asignaturas · {horas} h de clase a la semana
        </span>
      </mo.div>

      <mo.ul className="est-fila" variants={ORQUESTA}>
        {CLAVES_ASIGNATURA.map((clave, i) => (
          <Columna
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

function Columna({
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
   * Mientras no se elige nada, `animate` no se declara: la columna hereda el estado del
   * envoltorio de página por el árbol de Motion, que es como entra todo en esta casa.
   * Declararlo siempre rompería esa herencia y la entrada se perdería en la primera carga.
   */
  const estado = abriendo === null ? undefined : elegida ? 'elegido' : 'aparta';

  return (
    <li className="est-hueco" style={{ ['--peso' as string]: horas }}>
      {/* `Link` por fuera y sin animar: es quien precarga la ruta, quien la abre en otra
          pestaña con el botón central y quien la alcanza con el teclado. Lo que se mueve
          es la columna de dentro. */}
      <Link
        href={`/asignatura/${clave}`}
        prefetch
        className="est-puerta"
        aria-label={`${a.nombre}, ${horas} horas de clase a la semana`}
        onClick={alElegir}
      >
        <mo.span
          className={`est-col${elegida ? ' es-elegido' : ''}`}
          style={{ ['--tc' as string]: `var(--c-${a.color})` }}
          variants={COLUMNA}
          custom={indice}
          animate={estado}
          whileHover={LEVANTA}
          whileFocus={LEVANTA}
          whileTap={PULSA}
        >
          {/* Vertical y de abajo arriba, que es como se lee un rótulo en vertical en
              español: se inclina la cabeza a la izquierda. */}
          <span className="est-nombre">{a.nombre}</span>

          <span className="est-pie">
            <span className="est-raya" aria-hidden="true" />
            {/* El código es una referencia real de la escuela, así que va en la
                monoespaciada tabular igual que en el horario. */}
            <span className="est-cod">{a.codigo}</span>
          </span>
        </mo.span>
      </Link>
    </li>
  );
}
