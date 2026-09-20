'use client';

/**
 * El proveedor de Motion.
 *
 * Motion se puede traer entero con `import { motion }` o en dos piezas: el componente
 * `m`, que sabe renderizar pero no animar, y las funciones (`domMax`), que van aparte.
 * Aquí se usa lo segundo, pero **cargando las funciones con la aplicación**, no después.
 *
 * ## Por qué no van en diferido, que es lo que parece obvio
 *
 * Estuvieron en diferido —`features={() => import('motion/react').then(m => m.domMax)}`—
 * y costaba caro: hay una ventana de milisegundos en la que `m.div` ya pinta pero
 * todavía no sabe animar, y **todo lo que tenga que animarse al montar cae dentro de esa
 * ventana en la primera carga**.
 *
 * Lo que se veía: el escritorio entero en blanco al entrar, porque los bloques se
 * quedaban en su estado inicial —`opacity:0`— sin nadie que los sacara de ahí. Y cuando
 * eso se arregló, seguían apareciendo de golpe: llegaban a su sitio, sí, pero sin
 * animarse. Al navegar desde otra sección iba bien, porque las funciones ya estaban.
 *
 * O sea que lo que ahorraba el diferido era 25 kB a cambio de que la primera pantalla
 * —la única que se ve siempre— no tuviera animación. En un proyecto cuyo criterio es
 * que apetezca abrirlo, ese cambio va justo al revés.
 *
 * Va `domMax` y no `domAnimation` porque hace falta lo que trae de más: animaciones de
 * **layout** —el agua del dock y la píldora del calendario viajan con `layoutId`— y
 * **arrastre**, para los widgets del escritorio.
 *
 * `strict` sigue puesto: si alguien importa `motion` en vez de `m` dentro de este árbol,
 * la aplicación falla en desarrollo en vez de duplicar la biblioteca en silencio. Eso es
 * lo que evita que el paquete crezca solo con el tiempo, y no dependía del diferido.
 */

import { domMax, LazyMotion, MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';

export function ProveedorMovimiento({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domMax} strict>
      {/*
        `reducedMotion="user"` deja que Motion respete la preferencia del sistema por su
        cuenta: anula desplazamiento, escala y rotación, y conserva la opacidad. Es
        exactamente la regla que ya seguía el CSS de la casa, así que las dos mitades de la
        interfaz se comportan igual sin repetirla en cada componente.
      */}
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
