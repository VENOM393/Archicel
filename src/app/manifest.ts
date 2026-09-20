import type { MetadataRoute } from 'next';

/**
 * El manifiesto: lo que convierte a Archicel en un programa instalable.
 *
 * Next lo sirve en `/manifest.webmanifest` y lo enlaza solo en el `<head>`; no hay que
 * escribir la etiqueta a mano. Con esto, más el service worker de `public/sw.js`,
 * Chrome y Edge ofrecen instalarla y el sistema la trata como cualquier otra aplicación:
 * su icono en el escritorio, su ventana sin barra de direcciones y su sitio en la barra
 * de tareas.
 *
 * Decisiones que no son obvias:
 *
 *   · `id` fijo y separado de `start_url`. Es lo que identifica la instalación; si un día
 *     cambia la pantalla de inicio, el sistema seguirá sabiendo que es la misma
 *     aplicación y no creará una segunda.
 *   · `display: 'standalone'`. Ventana propia con la barra del sistema, sin barra de
 *     direcciones. `fullscreen` se traga los controles de cerrar y minimizar, que en
 *     escritorio se echan de menos enseguida.
 *   · Dos iconos de 512: el normal y el `maskable`. Windows y Android recortan el icono
 *     a su antojo — círculo, cuadrado redondeado — y sin la versión con margen el arco
 *     se queda sin las patas.
 *   · `theme_color` igual al fondo profundo de la aplicación, para que la franja de la
 *     ventana no se vea como una tira clara pegada encima de la fotografía.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Archicel',
    short_name: 'Archicel',
    description: 'El panel de estudio de Celeste: calendario, entregas, tareas y horario.',
    lang: 'es',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0A1317',
    theme_color: '#0A1317',
    categories: ['education', 'productivity'],
    icons: [
      { src: '/icono-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icono.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
    /* Los accesos del menú contextual del icono en la barra de tareas: clic derecho sobre
       Archicel y se entra directamente donde haga falta, sin pasar por el escritorio. */
    shortcuts: [
      {
        name: 'Calendario',
        short_name: 'Calendario',
        url: '/calendario',
        icons: [{ src: '/icono-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Horario de clases',
        short_name: 'Horario',
        url: '/horario',
        icons: [{ src: '/icono-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}
