/* eslint-disable no-undef */

/**
 * El service worker de Archicel.
 *
 * Hace dos cosas, y conviene no confundirlas:
 *
 *   1 · **Es el requisito que falta para poder instalarla.** Chrome y Edge no ofrecen
 *       "Instalar" a una página que no tenga uno con manejador de `fetch`. Sin esto, el
 *       manifiesto solo sirve para el icono.
 *   2 · **Hace que abra al instante y que abra sin red.** La fotografía del fondo pesa
 *       1,8 MB: descargarla en cada arranque es la diferencia entre una aplicación y una
 *       pestaña.
 *
 * Lo que NO hace, a propósito:
 *
 *   · No toca nada que no sea de este dominio. Firestore, las fuentes de Google y el
 *     login viajan a otros dominios y pasan de largo: cachear respuestas de la base de
 *     datos daría datos viejos y guardar sesión ajena en disco.
 *   · No cachea peticiones que no sean `GET`. Guardar una escritura no tiene sentido.
 *   · No sirve HTML viejo si hay red. Las páginas van a la red primero; la copia es el
 *     paracaídas, no el camino normal.
 *
 * Al cambiar la estrategia hay que subir VERSION: los nombres de caché la llevan dentro
 * y `activate` borra todo lo que no sea de la versión en curso. Sin eso, un usuario que
 * ya instaló se queda con la caché antigua para siempre.
 */

const VERSION = 'v1';
const CACHE_APP = `archicel-app-${VERSION}`;
const CACHE_ESTATICO = `archicel-estatico-${VERSION}`;

/* Lo mínimo para que la aplicación arranque sin red. El HTML de las otras vistas entra
   solo, la primera vez que se visitan. */
const BASE = ['/', '/fondo.webp', '/icono-192.png', '/icono.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_APP);
      /* Uno a uno y sin romper la instalación si alguno falla: `addAll` es atómico y un
         solo 404 dejaría a la aplicación sin service worker entero. */
      await Promise.allSettled(BASE.map((url) => cache.add(url)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      const nombres = await caches.keys();
      await Promise.all(
        nombres
          .filter((n) => n.startsWith('archicel-') && n !== CACHE_APP && n !== CACHE_ESTATICO)
          .map((n) => caches.delete(n)),
      );
      /* Sin esto el service worker nuevo espera a que se cierren todas las pestañas. */
      await self.clients.claim();
    })(),
  );
});

/** Permite que la propia página aplique una actualización sin esperar a cerrarla. */
self.addEventListener('message', (e) => {
  if (e.data === 'actualizar') self.skipWaiting();
});

/** Solo se guarda lo que se puede volver a servir tal cual. */
function guardable(res) {
  return res && res.ok && res.status === 200 && res.type === 'basic';
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  /* Los datos vivos y la autenticación nunca se cachean, vengan de donde vengan. */
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/__/')) return;

  /* Las páginas: red primero. Si no hay red, la última copia; y si tampoco, el
     escritorio, que es mejor que el dinosaurio del navegador. */
  if (req.mode === 'navigate') {
    e.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (guardable(res)) {
            const cache = await caches.open(CACHE_APP);
            cache.put(req, res.clone());
          }
          return res;
        } catch {
          return (await caches.match(req)) || (await caches.match('/')) || Response.error();
        }
      })(),
    );
    return;
  }

  /* Lo que Next publica con hash en el nombre es inmutable: si está, no se vuelve a
     pedir jamás. Es de donde sale casi todo el arranque instantáneo. */
  const inmutable = url.pathname.startsWith('/_next/static/');

  e.respondWith(
    (async () => {
      const cache = await caches.open(inmutable ? CACHE_ESTATICO : CACHE_APP);
      const copia = await cache.match(req);
      if (copia && inmutable) return copia;

      const red = fetch(req)
        .then((res) => {
          if (guardable(res)) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);

      /* Para el resto: se sirve la copia al instante y se refresca por detrás. */
      return copia || (await red) || Response.error();
    })(),
  );
});
