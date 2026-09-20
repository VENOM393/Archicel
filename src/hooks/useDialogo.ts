'use client';

/**
 * Lo que `aria-modal="true"` promete, cumplido.
 *
 * Declarar un diálogo modal es decirle al lector de pantalla que el resto de la página no
 * existe mientras esté abierto. Si el foco sigue paseándose por detrás, esa promesa es
 * falsa y la navegación por teclado se rompe justo donde más importa: en el formulario.
 *
 * Este hook pone las cuatro piezas que la hacen cierta:
 *
 *   1 · el foco entra en el diálogo al abrirse, en el primer campo que se rellena
 *   2 · `Escape` cierra, que es lo que todo el mundo intenta antes de buscar la equis
 *   3 · el tabulador da la vuelta dentro en lugar de escaparse al fondo
 *   4 · al cerrar, el foco vuelve a donde estaba, no al principio de la página
 *
 * Se usa en las dos hojas de edición para que se comporten igual: una hoja que se cierra
 * distinto de la otra se nota aunque nadie sepa decir por qué.
 */

import { useEffect, useRef } from 'react';

/** Lo que el navegador considera alcanzable con el tabulador, en orden de documento. */
const ALCANZABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useDialogo<T extends HTMLElement>(abierto: boolean, cerrar: () => void) {
  const caja = useRef<T>(null);
  /* quién tenía el foco antes de abrir, para devolvérselo al cerrar */
  const origen = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!abierto) return;
    const nodo = caja.current;
    if (!nodo) return;

    origen.current = document.activeElement as HTMLElement | null;

    /* al primer campo de verdad; si no hay ninguno, al propio diálogo */
    const primero = nodo.querySelector<HTMLElement>('input, textarea, select');
    (primero ?? nodo).focus({ preventScroll: true });

    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        /* Si un desplegable o un calendario tenía el Escape, es suyo: cierra ese y deja
           la hoja donde está. Sin esto, abrir el selector de hora y pulsar Escape cerraba
           el formulario entero y se perdía lo escrito.
           La señal es `defaultPrevented`, no buscar su panel en el DOM: esos componentes
           escuchan antes que nosotros y para cuando nos toca ya lo han desmontado. Por eso
           este escuchador va en burbujeo y no en captura — necesita ir después. */
        if (e.defaultPrevented) return;
        e.stopPropagation();
        cerrar();
        return;
      }
      if (e.key !== 'Tab') return;
      /* con un panel flotante abierto, el foco es suyo: el nuestro lo devolvería dentro */
      if (document.querySelector('[data-radix-popper-content-wrapper]')) return;

      const focos = [...nodo.querySelectorAll<HTMLElement>(ALCANZABLE)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (focos.length === 0) return;

      const primeroF = focos[0];
      const ultimo = focos[focos.length - 1];
      /* en los extremos se da la vuelta; en medio manda el navegador */
      if (e.shiftKey && document.activeElement === primeroF) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeroF.focus();
      }
    };

    document.addEventListener('keydown', alPulsar);
    return () => {
      document.removeEventListener('keydown', alPulsar);
      /* Al desmontar el diálogo el foco cae en `body`, no se queda dentro: por eso ese
         caso también cuenta como "lo tenía el diálogo". Lo que no se toca es un foco que
         ya se llevó otro elemento de la página, porque entonces se lo estaríamos robando. */
      const activo = document.activeElement;
      const loTeniaElDialogo = !activo || activo === document.body || nodo.contains(activo);
      if (loTeniaElDialogo) origen.current?.focus({ preventScroll: true });
    };
  }, [abierto, cerrar]);

  return caja;
}
