# El movimiento de Archicel

En este proyecto la animación no es el envoltorio, es el producto. Este documento explica cómo está
montada para que siga siéndolo dentro de seis meses, cuando nadie recuerde por qué una hoja tarda
420 ms y un icono del dock 170.

La biblioteca es **Motion 13** (`motion`, lo que antes se llamaba Framer Motion). El vocabulario vive
entero en [`src/lib/ui/movimiento.ts`](../../src/lib/ui/movimiento.ts) y el proveedor en
[`src/lib/ui/ProveedorMovimiento.tsx`](../../src/lib/ui/ProveedorMovimiento.tsx).

---

## 1 · Un componente elige *cuál*, no *cuánto*

Sin un sitio único donde vivan las curvas y los tiempos, cada componente inventa los suyos: una hoja
entra en 280 ms, un panel en 320, el aviso en 250. Cada uno por separado está bien; juntos no van a
compás. Nadie sabe decir por qué, pero se nota — como se nota una banda desafinada aunque no sepas
qué instrumento falla.

Por eso `movimiento.ts` exporta nombres y no números:

| Muelle | Masa | Para qué |
|---|---|---|
| `MUELLE.vivo` | 0.1 | Lo pequeño que responde al dedo: iconos, botones, el dock |
| `MUELLE.normal` | 0.5 | El de trabajo: paneles, hojas, cambios de vista |
| `MUELLE.denso` | 1 | Lo que pesa: una hoja a pantalla completa, el plato del dock |
| `MUELLE.seco` | 0.6 | Lo que no debe pasarse ni un píxel: posiciones de widgets |

Y tres tiempos, no trece: `TIEMPO.roce` (0.24), `TIEMPO.paso` (0.42), `TIEMPO.viaje` (0.72).
Cualquier número entre medias es una decisión que nadie podrá defender dentro de tres meses.

### Muelles para lo que se mueve, duraciones para lo que aparece

Una duración describe cuánto tarda; un muelle describe cómo se comporta. Lo segundo es lo que hace
que dos cosas que se mueven a la vez parezcan del mismo material aunque recorran distancias
distintas: el muelle se adapta solo a la distancia, la duración no.

Por eso lo que reacciona al dedo va con muelle, y solo lo que aparece o desaparece —donde no hay
distancia que recorrer, solo opacidad— va con duración.

### La salida no es la entrada al revés

Es la regla que más se incumple. Algo que entra se presenta: sube, se enfoca, se toma su tiempo. Algo
que se va ya no interesa a nadie, así que se va en la mitad de tiempo y sin desplazarse apenas.
Invertir la entrada para la salida hace que cerrar una hoja se sienta tan lento como abrirla, que es
el defecto más común de las interfaces animadas.

Por eso cada variante tiene **tres** estados y no dos: `fuera`, `dentro`, `saliendo`.

---

## 2 · Las variantes de la casa

| Variante | Dónde | Qué hace |
|---|---|---|
| `APARECER` | genérica | Entrar y salir con desenfoque |
| `ORQUESTA` | `.canvas` del escritorio | Reparte la entrada de sus hijos (`staggerChildren`) |
| `POSARSE` | cada widget | Un bloque aterrizando desde el desenfoque |
| `RELEVO` | paneles del calendario | Dos vistas que se turnan en el mismo hueco |
| `PAGINA` | envoltorio de ruta | El cambio de sección, con dirección (§ 3) |
| `PIEZA` | cada parte de una página | Llega escalonada dentro de un `ORQUESTA` |
| `VELO` | telón de las hojas | Solo opacidad |
| `HOJA` | hojas modales | Sube desde abajo con muelle |
| `AVISO` | toast | Sube desde abajo, centrado |
| `QUIETO` | — | Lo que queda al pedir menos movimiento |

`segun(quieto, variantes)` elige entre una y `QUIETO`.

---

## 3 · El cambio de página

Es la animación que más veces se ve, así que es la que más tiene que decir. Vive en
`PAGINA` (la variante), `viajeEntre` (la decisión) y el envoltorio `.pagina` del Marco.

### 3.1 · La página viaja hacia donde viaja el agua del dock

Es la regla entera, y todo lo demás sale de ella.

Cuando se pulsa Calendario estando en el Escritorio, el agua blanca del dock se mueve
hacia la derecha. Si la página entrara subiendo, o bajando, o simplemente apareciendo,
habría dos gestos distintos contando la misma cosa a la vez. Así que la página **también**
se mueve hacia la derecha: la vieja se aparta a la izquierda y la nueva llega desde la
derecha. Un solo movimiento, repartido entre el indicador y la pantalla.

De ahí que el orden de las secciones viva junto a `viajeEntre` y no en el componente:

```ts
const ORDEN = ['/', '/calendario', '/horario'];
```

**Si el dock se reordena, esta lista va con él.** Es lo único que hay que acordarse de
mantener, y el precio de olvidarlo es una transición que empuja al revés que el indicador.

### 3.2 · Dos ejes, porque hay dos clases de viaje

| Viaje | Cuándo | Qué hace |
|---|---|---|
| `lateral` | entre secciones del dock | La saliente se aparta 28 px, la entrante llega desde 40 px del otro lado |
| `profundidad` | entrar o salir de un detalle | Pura escala: lo que se va se aleja a 0.975 o se acerca a 1.022, y lo que llega hace lo contrario |
| `quieto` | primera carga, o una ruta fuera del mapa | Solo opacidad. No se inventa una dirección |

`/dia` no está en el dock porque no es un destino: se llega pulsando un día dentro de la
semana. Entrar ahí es bajar una capa, no cruzar de lado, y eso se cuenta con escala.

**Lo que decide es la sección del dock, no la ruta**, y hay un caso donde la diferencia se
ve: de `/dia` a `/horario`. Comparando rutas no es ni lateral ni profundidad, así que
saldría el gesto neutro — mientras el agua del dock viaja a la derecha, porque desde la
agenda del día lo que está señalado es Calendario. Una página quieta al lado de un
indicador viajando se lee como un fallo. Comparando secciones sale bien solo.

Las distancias son cortas a propósito. Esto se cruza cincuenta veces al día y una pantalla
que se desplaza medio ancho es idioma de móvil: repetido en un portátil, cansa. Lo que hace
legible la dirección no es cuánto se recorre, es que la salida y la entrada empujen hacia
el mismo lado.

### 3.3 · El envoltorio viaja, el contenido llega

`PAGINA` **no lleva opacidad en la entrada**, y esa ausencia es el diseño entero.

Si el envoltorio se fundiera y además su contenido se escalonara, serían dos animaciones
apiladas sobre la misma cosa: el mismo gesto contado dos veces. Así es como algo bien hecho
acaba pareciendo recargado.

El reparto es:

- **el envoltorio** solo se desplaza o se acerca (`PAGINA`);
- **el contenido** es lo que aparece, pieza a pieza (`ORQUESTA` en la sección, `PIEZA` en
  cada parte).

Y aquí está lo que hace que esté sincronizado de verdad: las páginas **no declaran**
`initial` ni `animate`. Heredan el estado (`fuera`, `dentro`) del envoltorio de página por
el árbol de Motion, que atraviesa los límites de componente. No hay dos relojes que
mantener en hora; hay uno.

```tsx
// en el Marco
<m.div className="pagina" variants={PAGINA} custom={viaje}
       initial="fuera" animate="dentro" exit="saliendo">

// en la página — sin initial, sin animate, sin exit
<m.section className="vista on" variants={ORQUESTA}>
  <m.div className="dia-top" variants={PIEZA}>…</m.div>
  <m.div className="semana"  variants={PIEZA}>…</m.div>
</m.section>
```

Añadir una pieza nueva a una página es escribir `variants={PIEZA}` y nada más. Entra en el
sitio que le toca por orden de lectura, sin tocar un solo número.

La **salida** sí lleva opacidad y va entera de una pieza: lo que se va no necesita
articularse. `PIEZA` ni siquiera tiene estado `saliendo` — una página que se deshace por
partes al irse hace que marcharse dure más que llegar, y nadie quiere mirar cómo se va algo.

### 3.4 · Los milisegundos, y por qué son esos

Con `mode="wait"` la página nueva no se monta hasta que la vieja termina. El total es
salida + entrada, así que **cada milisegundo de salida es un milisegundo de espera después
de pulsar**: ese es el sitio exacto donde una transición bonita se convierte en una
aplicación lenta.

- **Salida: 155 ms**, con `CURVA.fuera`, que acelera al irse.
- **Entrada lateral: `MUELLE.normal`** en `x`. Que es el mismo muelle con el que el agua
  del dock viaja entre iconos: no son dos animaciones parecidas, es la misma física.
- **Entrada en profundidad: `TIEMPO.paso` con `CURVA.salida`.** Curva y no muelle, porque
  un muelle sobre `scale` se pasa de frenada y una pantalla entera que rebota al llegar se
  lee como barata.
- **Escalonado del contenido: `ESCALON` (52 ms)** con 60 ms de retraso inicial, que es la
  ventaja que se le da al viaje del envoltorio antes de que empiecen a encenderse las
  piezas.

### 3.5 · `custom` va en dos sitios

```tsx
<AnimatePresence mode="wait" initial={false} custom={viaje}>
  <m.div key={ruta} variants={PAGINA} custom={viaje} …>
```

En el `m.div` para la entrada y **también en el `AnimatePresence`** para la salida. La
página que se va ya no se está renderizando, así que sin lo segundo se queda con el
`custom` de cuando llegó y sale hacia el lado del viaje anterior. Es el fallo que no se ve
hasta que se navega tres veces seguidas.

### 3.6 · La dirección se calcula durante el render

```tsx
const [rumbo, setRumbo] = useState(() => ({ ruta, viaje: SIN_VIAJE }));
if (rumbo.ruta !== ruta) setRumbo({ ruta, viaje: viajeEntre(rumbo.ruta, ruta) });
```

No en un `useEffect`. `AnimatePresence` arranca la salida en el mismo render en que la ruta
cambia, así que un efecto llegaría un fotograma tarde y el primer viaje de cada navegación
saldría con la dirección del anterior. Ajustar estado durante el render comparando con el
valor guardado es el patrón que React documenta justo para esto: no pinta el resultado
intermedio, vuelve a renderizar antes de llegar a la pantalla.

### 3.7 · La transición lateral necesita `overflow-x: clip` en `.body`

La página llega desplazada 40 px de lado. Sin recortar, esos 40 px empujan una barra de
desplazamiento horizontal que aparece y desaparece en cada navegación, y la pantalla entera
pega un tirón.

`clip` y no `hidden`: `hidden` crearía un contenedor de desplazamiento y se llevaría por
delante el desplazamiento vertical de la página. `clip` es el único valor que deja un eje
recortado y el otro libre. Y ninguno de los dos crea bloque contenedor, así que lo `fixed`
sigue escapando — que es lo que hace falta.

---

## 4 · Las cuatro reglas que no se deducen leyendo el código

### 4.1 · Una propiedad la controla Motion **o** la controla el CSS

Nunca las dos. Motion escribe `transform`, `opacity` y `filter` como estilo en línea; una
`animation` de CSS gana sobre el estilo en línea, y un `transition` de CSS sobre la misma propiedad
pelea por cada fotograma.

Síntomas de haberlo roto: un elemento clavado en el último fotograma del CSS; una píldora a medio
camino; un `translateX(-50%)` de centrado que desaparece en cuanto algo se anima.

En la práctica esto significa que, al pasar algo a Motion, **hay que borrar la regla de CSS**, no
dejarla por si acaso. Y que si un `:hover` levantaba el botón dos píxeles, ese `:hover` se convierte
en `whileHover={{ y: -2 }}`. Ya pasó con `.btn-instalar` y con `.icon-btn`.

El caso inverso también cuenta: el `-50%` de un centrado viaja **dentro de la variante**
(`x: '-50%'` en `AVISO` y en el rótulo del dock), porque si se queda en la hoja de estilos, el
primer `transform` que escriba Motion se lo lleva por delante.

### 4.2 · `filter` en un ancestro rompe `position:fixed`

Un elemento con `filter`, `transform` o `will-change` deja de ser transparente para sus hijos
`position:fixed`: pasa a ser **su** bloque contenedor, y `inset:0` deja de significar la ventana.

Por eso `PAGINA` —la única variante que envuelve páginas enteras, y por tanto la barra del modo
edición, el menú de un widget, el telón y las hojas— **no lleva desenfoque**. Con `transform` se
puede vivir porque Motion escribe `transform:none` en reposo; con `filter` no, porque el valor en
reposo sería `blur(0px)`, que no es `none` y crea el bloque contenedor para siempre.

La misma razón desaconseja `style={{ willChange: 'transform' }}` en ese envoltorio, aunque la guía
general de Motion lo recomiende.

### 4.3 · El indicador que viaja se hace con `layoutId`, no con matemáticas

Dos sitios lo usan: el agua blanca del dock (`layoutId="dock-agua"`, con su punto) y la píldora del
conmutador del calendario (`layoutId="seg-pill"`).

En los dos casos el elemento **solo se dibuja en el hijo activo**. Cuando cambia cuál es el activo,
Motion encuentra el mismo `layoutId` en otro sitio y lo lleva de uno a otro midiendo el DOM real.

No es un atajo, es más correcto: la posición ya no se calcula, se deduce, así que no hay forma de que
el indicador y el icono se desincronicen. El dock llevaba antes una gota con su posición, su
velocidad, su muelle y una medición por fotograma; se equivocaba justo al medir en mitad de una
animación.

### 4.4 · Menos movimiento se declara una vez, en el proveedor

`MotionConfig reducedMotion="user"` en `ProveedorMovimiento.tsx` lee la preferencia del sistema y
deja pasar únicamente la opacidad. **No** hay que repetirlo en el bloque
`@media (prefers-reduced-motion: reduce)` del CSS: ahí solo queda lo que sigue animándose con CSS.
Tenerlo en dos sitios que nada obliga a mantener de acuerdo es cómo se desincronizan.

Lo que se anula es el **viaje**, nunca el estado final. Quien pide menos movimiento quiere la misma
interfaz sin desplazamientos, no una interfaz que no le diga cuándo algo ha cambiado.

---

## 5 · Por qué `LazyMotion` y `m` en vez de `motion`

`ProveedorMovimiento.tsx` monta:

```tsx
<LazyMotion features={() => import('motion/react').then((m) => m.domMax)} strict>
  <MotionConfig reducedMotion="user">{children}</MotionConfig>
</LazyMotion>
```

`import * as m from 'motion/react-m'` pesa 4,6 kB; `motion` completo pesa 25 kB y entra en el paquete
inicial. Con `LazyMotion` las funciones llegan después, sin bloquear la primera pantalla — que en una
aplicación cuyo argumento es que apetezca abrirla, es exactamente donde no se puede gastar.

`strict` hace que usar `motion.div` en lugar de `m.div` sea un error en vez de una regresión
silenciosa de 25 kB.

**Consecuencia práctica:** en un componente que importa `* as m`, no puede haber una variable local
llamada `m`. Ya obligó a renombrar dos `useMemo` en el calendario. Si aparece un error raro de tipos
sobre `m.fecha`, es esto.

---

## 6 · Lo que sigue estando en CSS a propósito

- **El arrastre y el redimensionado de widgets** (`useEscritorio.ts`). Escriben `style.left/top` en
  píxeles con imantado magnético a los bordes de los vecinos. El `drag` de Motion trabaja con
  transformaciones y no sabe de imanes: sería una reescritura con riesgo real sobre la única función
  que ya se rompió una vez.
- **`.widget.settling`**, la transición de `left/top/width/height` al soltar. Anima propiedades de
  maquetación, que es justo lo que la guía de Motion desaconseja, pero solo corre al soltar y al
  restablecer — nunca durante el arrastre — y el drag escribe píxeles, así que no puede compartir
  propiedad con un `transform`.
- **El popover de la cuenta**, que lo anima Radix con sus propios `data-state`.
- **Las letras del nombre y de la firma**, con su `--i` y sus `@keyframes`. Son animaciones de una
  sola pieza que nadie tiene que sincronizar con nada.
- **El shader del fondo**, que es WebGL y no tiene nada que ver con esto.

---

## 7 · Cómo se verifica

Con el navegador, y solo con el navegador. Dos cosas que ahorran una tarde:

1. **Medir a mitad de una animación da números falsos.** Ya llevó a dos diagnósticos equivocados en
   este proyecto. Hay que esperar a que el gesto termine, o usar `onAnimationComplete`.
2. **Un panel de navegador oculto congela `requestAnimationFrame`.** Motion no avanza y todo se queda
   en su estado `fuera` — widgets a `opacity:0`, el hueco del lápiz a `width:0`. Eso **no** es un
   fallo de la animación: es que no está corriendo. Se comprueba con

   ```js
   document.visibilityState  // "hidden" → no hay fotogramas
   ```

   Si sale `hidden`, la única verificación honesta es la de la geometría, que sí se calcula. Lo demás
   hay que decir que está sin verificar.
