'use client';

/**
 * La página que se está yendo se queda con su propio contenido.
 *
 * ## El problema
 *
 * El App Router y `AnimatePresence` no se llevan bien por una razón concreta: cuando se
 * navega, `usePathname()` cambia **en el acto**, pero los `children` que da el router se
 * sustituyen **en su sitio**, dentro del mismo árbol.
 *
 * Con una salida animada eso da lo siguiente. `AnimatePresence` sujeta el envoltorio
 * viejo para animar su salida, pero el router ya le ha metido dentro la página nueva. Así
 * que la página nueva se anima **saliendo**, y cuando la salida termina se monta el
 * envoltorio nuevo y la misma página se anima **entrando**. Dos veces el mismo
 * movimiento, la primera cortada a mitad.
 *
 * Medido en este proyecto: al ir de `/` a `/calendario`, el nodo del DOM no se remontaba
 * nunca y la `key` del fiber se quedaba en `/` mientras dentro ya estaba el calendario.
 *
 * ## La solución
 *
 * Congelar el contexto del router en el momento en que este envoltorio se monta. Cada
 * instancia se queda con el suyo, así que la que sale sigue enseñando lo que enseñaba y
 * la que entra trae lo nuevo. Es la técnica que usa todo el mundo para esto; no hay una
 * API pública equivalente.
 *
 * ## Lo que hay que saber si un día falla
 *
 * `LayoutRouterContext` no es API pública: sale de `next/dist/...`. Si al subir de versión
 * de Next desaparece o cambia de sitio, esto deja de compilar — y es preferible a que deje
 * de funcionar en silencio. Comprobado con **Next 16.3.5**.
 *
 * Si algún día no hay forma de mantenerlo, la salida es quitar la animación de salida y
 * dejar solo la de entrada, con un `template.tsx`, que es la primitiva que el App Router
 * sí ofrece para esto. Se pierde la mitad del gesto, no la aplicación.
 */

import { LayoutRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { useContext, useRef, type ReactNode } from 'react';

export function RutaCongelada({ children }: { children: ReactNode }) {
  const contexto = useContext(LayoutRouterContext);
  /* `useRef` y no estado: se quiere el valor del primer render y que no cambie nunca más,
     que es literalmente lo que significa congelar. */
  const congelado = useRef(contexto).current;

  return <LayoutRouterContext.Provider value={congelado}>{children}</LayoutRouterContext.Provider>;
}
