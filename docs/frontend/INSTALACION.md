# Archicel como programa del ordenador

Archicel se instala. No es una metáfora: aparece en el menú de inicio, tiene su icono en
la barra de tareas, abre en su propia ventana sin barra de direcciones y arranca aunque
no haya red. Es la misma aplicación web, servida igual, con tres piezas añadidas.

## Las tres piezas

| Pieza | Fichero | Qué aporta |
|---|---|---|
| Manifiesto | [src/app/manifest.ts](../../src/app/manifest.ts) | El nombre, los iconos, el color de la ventana y los accesos del clic derecho |
| Service worker | [public/sw.js](../../public/sw.js) | El arranque instantáneo, el modo sin conexión y el requisito que Chrome exige para ofrecer la instalación |
| Botón de instalar | [src/components/Instalable.tsx](../../src/components/Instalable.tsx) | Registra el service worker y enseña el botón cuando el navegador lo permite |

Ninguna de las tres cambia cómo se programa el resto. Se pueden ignorar mientras se
trabaja en pantallas.

## Cómo se instala

1. `npm run build && npm start` — **tiene que ser una compilación de producción.** En
   desarrollo el service worker no se registra a propósito (ver más abajo), y sin él
   Chrome no ofrece instalar.
2. Abrir `http://localhost:3000` en **Chrome o Edge**.
3. Pulsar **Instalar** en la cabecera, o el icono de instalación que aparece a la derecha
   de la barra de direcciones.

En Firefox de escritorio no se puede: no implementa la instalación de aplicaciones web.
En Safari se hace a mano, desde Compartir → Añadir al Dock.

Cuando Archicel esté publicada en un dominio con HTTPS, esto funciona igual y sin
localhost: el manifiesto y el service worker viajan con ella.

## Por qué el service worker solo en producción

Guarda copias de lo que descarga. En desarrollo eso significa quedarse con la versión
anterior de un componente y pasarse media hora preguntándose por qué no se ve el cambio.
La comprobación está en [`Instalable.tsx`](../../src/components/Instalable.tsx) y es una
línea: `if (process.env.NODE_ENV !== 'production') return;`.

Consecuencia práctica: **el botón de instalar tampoco sale en `npm run dev`**. No está
roto.

## Qué se cachea y qué no

- **Sí:** el HTML de las vistas (red primero, copia como paracaídas), lo que Next publica
  bajo `/_next/static/` (inmutable, con hash en el nombre) y `fondo.webp`, que pesa 1,8 MB
  y es la diferencia entre abrir al instante y esperar.
- **No, nunca:** nada que no sea de este dominio. Firestore, el login de Google y las
  fuentes van a otros dominios y el service worker los deja pasar sin tocarlos. Tampoco
  se cachea ninguna petición que no sea `GET`.

Al cambiar la estrategia hay que **subir `VERSION`** en `sw.js`. Los nombres de caché la
llevan dentro y `activate` borra las que no son de la versión en curso; sin subirla, quien
ya tuviera la aplicación instalada se queda con la caché vieja para siempre.

## Los iconos

Se generan con [scripts/iconos.mjs](../../scripts/iconos.mjs) a partir de un único
dibujo, [public/icono.svg](../../public/icono.svg): un arco de medio punto con travesaño,
que es a la vez una **A** y un alzado.

```bash
npm run iconos
```

Eso escribe `icono-192.png`, `icono-512.png`, `icono-maskable-512.png`,
`apple-touch-icon.png` y el favicon `src/app/icon.png`. Para cambiar la marca se edita el
SVG y se vuelve a lanzar; no se retoca ningún PNG a mano.

Dos cosas que costaron un intento cada una y conviene no repetir:

- **El degradado del trazo va en `gradientUnits="userSpaceOnUse"`.** El travesaño es una
  línea horizontal, su caja tiene altura cero, y un degradado relativo a esa caja
  sencillamente no se dibuja: el icono salía sin la barra de la A.
- **La versión `maskable` encoge el dibujo al 62 %.** Windows y Android recortan el icono
  a círculo o a cuadrado redondeado; sin ese margen, el arco se queda sin patas.

## Lo que todavía no está

- **Ventana con controles superpuestos** (`window-controls-overlay`): dejaría dibujar la
  cabecera de Archicel dentro de la propia barra de título, que es el último detalle que
  separa una aplicación web instalada de un programa nativo. Requiere colocar el chrome
  con las variables `env(titlebar-area-*)` y hay que hacerlo con cuidado para no romper
  la cabecera en el navegador normal.
- **Notificaciones** de entregas cercanas. El service worker ya está, que es la parte que
  no se puede añadir después.
