'use client';

/**
 * Lo pinta en `body`, fuera del panel.
 *
 * Es lo que separa una hoja modal de una caja dentro de una caja: cualquier ancestro con
 * `filter`, `backdrop-filter`, `transform` o `will-change` se convierte en el bloque
 * contenedor de sus descendientes `position:fixed`, y entonces `inset:0` deja de significar
 * la ventana para significar ese ancestro. El panel de apuntes lleva `backdrop-filter`, así
 * que un `.telon`/`.hoja` montado dentro se resolvería contra el panel y no contra la
 * pantalla. Portándolo a `body` el telón cubre el viewport y la hoja se centra sobre él.
 *
 * Solo después de montar: la página se prerrenderiza y en el servidor no hay `document`.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function AlCuerpo({ children }: { children: ReactNode }) {
  const [listo, setListo] = useState(false);
  useEffect(() => setListo(true), []);
  return listo ? createPortal(children, document.body) : null;
}
