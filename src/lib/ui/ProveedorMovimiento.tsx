'use client';

/**
 * El proveedor de Motion.
 *
 * Motion se puede traer entero con `import { motion }` o en dos piezas: el componente
 * `m`, que sabe renderizar pero no animar, y las funciones, que se cargan aparte. Aquí se
 * usa lo segundo:
 *
 *   · `m` pesa **4,6 kB** y viaja en el arranque
 *   · `domMax` pesa **25 kB** y se carga **después**, sin bloquear el primer pintado
 *
 * Importa porque el criterio de Archicel es que apetezca abrirla, y lo primero que decide
 * eso es lo que tarda en aparecer. Una biblioteca de animación que retrasa el arranque
 * para animar la entrada se ha comido su propio propósito.
 *
 * Va `domMax` y no `domAnimation` porque hace falta lo que trae de más: animaciones de
 * **layout** —para que el calendario morfee entre vistas en vez de reemplazarse— y
 * **arrastre**, para los widgets del escritorio.
 *
 * `strict` está puesto a propósito: si alguien importa `motion` en vez de `m` dentro de
 * este árbol, la aplicación falla en desarrollo en vez de duplicar la biblioteca en
 * silencio. Es la única forma de que el ahorro no se deshaga solo con el tiempo.
 */

import { LazyMotion, MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';

/** Las funciones, en su propio trozo: el empaquetador las separa por este import. */
const cargarFunciones = () => import('motion/react').then((m) => m.domMax);

export function ProveedorMovimiento({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={cargarFunciones} strict>
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
