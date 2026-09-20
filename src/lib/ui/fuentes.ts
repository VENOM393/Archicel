/**
 * Las tipografías que no vienen del layout.
 *
 * `next/font` tiene que cargarse desde el módulo, nunca dentro de un componente, para
 * que el compilador pueda autoalojar el fichero y meter el `@font-face` en el CSS del
 * arranque. Hecho así no hay petición a Google en tiempo de ejecución, no hay un
 * parpadeo de letra sin estilar y la fuente no bloquea el pintado.
 *
 * Aquí vive solo la excepción: la serif de la firma. Las dos familias de la casa —Outfit
 * y Geist— se declaran en `app/layout.tsx`, que es donde se aplican a todo.
 */

import { Instrument_Serif } from 'next/font/google';

/**
 * La letra de la placa de autor. Una sola cursiva, un solo grosor.
 *
 * `display: 'swap'` y no `optional`: esta letra entra al final de la pantalla y no compite
 * con nada, así que merece la pena esperarla. Si no llegara, el texto se lee igual con la
 * de reserva y solo se pierde el gesto.
 */
export const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: 'italic',
  display: 'swap',
  variable: '--font-firma',
});
