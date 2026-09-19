# El escritorio: widgets, posición libre y modo edición

Cómo está construido el panel de Archicel y **cómo se añade lo que venga después** sin tocar el
motor. El prototipo vivo está publicado como artifact; este documento describe su arquitectura, que
es la que se traslada tal cual a Next.js.

---

## La idea en una frase

Un **registro de widgets** (qué existe) + un **layout** (dónde está cada cosa) + un **motor** que los
coloca, los deja mover y guarda el resultado. Añadir un widget nuevo toca **solo el registro**.

```
WIDGETS  ──►  motor  ──►  pantalla
(catálogo)   (coloca,       ▲
             arrastra,      │
             imanta)        │
LAYOUT  ────────────────────┘
(posiciones del usuario, en almacenamiento)
```

---

## 1 · Posición libre

No hay rejilla que imante. Cada widget se queda **exactamente donde se suelta y con el tamaño que se
le dé**, y pueden solaparse si así se quiere. Cuatro números por widget:

| Campo | Unidad | Por qué |
|---|---|---|
| `fx` | fracción del ancho del lienzo (0–1) | al cambiar el ancho de la ventana, la composición se mantiene proporcional |
| `fw` | fracción del ancho del lienzo | lo mismo: un widget a media pantalla sigue a media pantalla |
| `y` | píxeles desde arriba | las alturas no deben estirarse con el ancho |
| `h` | píxeles | igual |

Horizontal en fracciones y vertical en píxeles: es lo que hace que el mismo diseño funcione en un
portátil de 1280 y en un monitor de 2560 sin deformarse ni recalcularse.

Los widgets se posicionan en absoluto dentro del lienzo, y el lienzo calcula su altura a partir del
widget más bajo.

### Imantación

Al arrastrar o estirar, los bordes se imantan a **5 px** de los bordes de los demás widgets, del
centro y de los extremos del lienzo, y aparece una guía ámbar de 1 px que muestra con qué se está
alineando. **Con `Alt` pulsado no imanta nada**: posición al píxel exacto.

La cuadrícula del modo edición es solo una referencia visual. No imanta.

**Por debajo de 900 px** el posicionamiento absoluto se anula por completo y los widgets vuelven al
flujo normal, en una sola columna y en el orden del registro; el modo edición se desactiva.
Recolocar a mano en una pantalla de seis pulgadas sale peor que un orden bien elegido.

---

## 2 · El registro de widgets

Todo el catálogo vive en el objeto `WIDGETS`. Cada entrada:

| Campo | Qué es |
|---|---|
| `title` | Nombre visible en el menú del editor y en `aria-label` |
| `def` | Posición y tamaño de fábrica, escritos como `{x, y, w, h}` sobre 12 columnas por comodidad; el motor los traduce a fracciones y píxeles al arrancar |
| `min` | Tamaño mínimo, en celdas; se traduce a píxeles (ancho × 96, alto × 44) |
| `solid` | `true` si el panel usa el relleno más opaco (para los que llevan dato crítico) |
| `body()` | Devuelve el HTML **interior** del widget. Sin marco: el motor pone el marco |
| `mount(node)` | Opcional. Se ejecuta una vez insertado: aquí van listeners, datos y animaciones |

El **orden del objeto** es el orden de aparición en pantallas estrechas. Ponlo por importancia real,
no por dónde caiga en el escritorio.

### Añadir un widget nuevo

Esto es todo. No hay que registrar nada más en ningún otro sitio:

```js
referencias: {
  title: 'Referencias',
  def: { x: 8, y: 19, w: 4, h: 5 },
  min: { w: 3, h: 4 },
  body: function () {
    return '<div class="head"><h2>Referencias</h2>' +
           '<span class="side-note">12 guardadas</span></div>' +
           '<div class="refs"></div>';
  },
  mount: function (node) {
    // datos, listeners, lo que necesite
  }
}
```

Lo que pasa solo, sin escribir una línea más:

- aparece en pantalla en su posición por defecto;
- el editor lo sabe arrastrar, estirar y meter en su menú;
- respeta su tamaño mínimo;
- **entra en el layout ya guardado de quien lleve meses usando la app**, sin descolocarle el resto
  (ver *Migración*).

### Reglas al escribir un widget

1. **El marco no se toca.** `body()` devuelve el interior. El fondo, el borde, el radio y el
   difuminado son del sistema, no del widget. Un widget con su propio fondo rompe el contrato visual.
2. **Nada de alturas fijas dentro del widget.** El widget mide lo que el usuario decida: el contenido
   se adapta a la caja, nunca al revés.
3. **Responsive por contenedor, no por pantalla** (ver punto 4).
4. **Si guarda datos**, que sea con su propia clave versionada (`archicel.<algo>.v1`) y siempre
   dentro de `try/catch`: el almacenamiento puede estar bloqueado.
5. **En modo edición no se interactúa.** Un widget con controles comprueba
   `document.body.classList.contains('editing')` y no hace nada mientras se está ordenando el
   escritorio. Si no, al arrastrar se marcan tareas sin querer.

---

## 3 · El layout y su persistencia

El layout es un objeto plano `{ id: {fx, fw, y, h} }`. Se guarda en `localStorage` bajo
`archicel.layout.v3`.

**Solo se guardan posiciones, nunca contenido.** Es la decisión que hace que esto escale: los datos
viven donde tengan que vivir, y el layout es una preferencia visual del usuario.

### Migración — lo que pasa al añadir o quitar widgets

Al cargar, el motor recorre el registro actual, no el guardado:

- **Widget que existe en ambos** → se respeta la posición del usuario (acotada a límites válidos).
- **Widget nuevo** → entra en su posición `def`, traducida desde celdas.
- **Widget retirado** → su entrada guardada se ignora sin más.
- **Formato viejo** (la versión de rejilla, `v2`) → se descarta entero y se reparte de fábrica. Por eso
  la clave lleva versión: un cambio de formato nunca deja un escritorio a medias.

Por eso se puede publicar una versión con tres widgets nuevos sin romperle el escritorio a nadie.

**Al pasar a Next.js**, esta capa es lo único que cambia: `cargarLayout()` y `guardarLayout()` pasan
a leer y escribir en la base de datos con el id de la usuaria, y el layout la sigue a cualquier
dispositivo. El resto del motor no se entera.

### Solapes

Están permitidos a propósito. Si dos widgets se pisan, manda el último que se tocó: cada arrastre,
cada estirón y la opción **traer al frente** del menú suben el widget en la pila. No hay colisiones
que resolver ni compactación que corrija huecos — la composición es de quien la hace.

---

## 4 · Responsive de verdad: por contenedor

Cada widget declara `container-type: inline-size`, así que **reacciona a su propio ancho**, no al de
la ventana:

```css
@container (max-width: 380px){
  .project p{ display:none }       /* el texto largo sobra si el widget es estrecho */
  .wave svg{ height:56px }
}
```

Esto es lo que hace que un widget estirado a todo el ancho y el mismo widget encogido a un tercio
sean, de hecho, dos diseños distintos — en un monitor de 27 pulgadas, los dos a la vez.

Cada widget decide **qué sacrifica primero** al estrecharse. La regla: se va el detalle, nunca el
dato. El calendario pierde la leyenda antes que los días; las tareas pierden la nota antes que el
texto; las asignaturas pierden el subtítulo antes que el porcentaje.

---

## 5 · El modo edición

Se entra con el **lápiz** de la barra superior, y se sale con **Hecho** o con `Escape`.

### Lo que ocurre al entrar

1. **Una onda recorre la fotografía** desde el punto exacto donde se pulsó. No es un círculo dibujado
   encima: es el shader del fondo deformando la imagen —`uRipple` lleva origen e instante— con una
   sinusoide radial que decae con la distancia y con el tiempo. Literalmente una pulsación sobre agua.
2. **La escena se retira**: el uniforme `uEdit` baja el brillo del fondo al 52 %, interpolado a lo
   largo de varios fotogramas, no de golpe.
3. **La cuadrícula se abre** como un círculo que crece desde el mismo punto (`clip-path`), dibujando
   las 12 columnas y las filas en ámbar tenue.
4. **Cada widget saca sus controles**: asa arriba a la izquierda, menú arriba a la derecha, tirador de
   tamaño en la esquina. Entran con opacidad y desplazamiento, no aparecen de golpe.
5. **La barra inferior sube** desde abajo con lo que se puede hacer.

Al salir, todo lo anterior a la inversa, se guarda, y un aviso lo confirma.

### Arrastrar

- El widget se despega (`position: fixed`) y sigue al puntero sin saltos.
- Los bordes se imantan a 5 px de los de sus vecinos, con guía ámbar; con Alt, libertad total.
- Los demás se recolocan **en vivo** mientras arrastras, con animación FLIP: se mide dónde estaban,
  se aplica el layout nuevo, y se anima la diferencia. Es lo que hace que el reordenado se lea como
  movimiento y no como parpadeo.
- Al soltar se guarda, y el widget se queda exactamente ahí. El que se acaba de mover pasa al frente.

### Redimensionar

Tirador en la esquina inferior derecha, libre al píxel. Respeta el mínimo del widget, se imanta a los
bordes de los vecinos igual que el arrastre, y no deja salirse del lienzo por la derecha.

### Menú por widget

Tres tallas rápidas (estrecho / medio / ancho completo) y **posición original**. Se abre con escala y
desplazamiento desde su esquina, se cierra al pulsar fuera o con `Escape`.

### Opacidad de los bloques

Un deslizador en la barra del editor, de 0 a 100 %, controla el relleno de **todos** los paneles a la
vez. Funciona por tokens: el color y la opacidad viven separados (`--panel-rgb` + `--opa`), así que
un solo valor recalcula paneles, raíl y superficies elevadas sin tocar ninguna regla.

Al 0 % los bloques quedan en puro cristal esmerilado: se conserva el desenfoque, desaparece el tinte.
Por debajo del 35 % el texto pierde su base, así que la página marca `data-translucido` en el `body`
y aplica un halo (`--halo`, distinto por tema) a todo el contenido de los widgets. Es lo que permite
bajar al extremo sin que nada deje de leerse.

Se guarda en `archicel.opacidad.v1`, aparte del layout: son dos preferencias independientes.

### Restablecer

El botón de la barra devuelve **todo** el escritorio a las posiciones `def` del registro.

---

## 6 · Las tres vistas y sus datos

El raíl navega entre tres vistas, y cada una mira los mismos datos desde una altura distinta:

| Vista | Qué muestra | Almacén |
|---|---|---|
| **Escritorio** | Widgets libres: bienvenida, entrega, clases, mini calendario, pendientes, asignaturas, horas, reloj | `archicel.layout.v3` (posiciones) |
| **Semana** | Los siete días con sus **eventos importantes** — entregas, exámenes, presentaciones, correcciones, visitas | `archicel.eventos.v1` |
| **Día** | Agenda de hora a hora con las **tareas** del día, y una banda arriba con los eventos de esa fecha | `archicel.tareas-dia.v1` |

**Eventos y tareas son cosas distintas a propósito.** Un evento pertenece a un día (una entrega no
empieza a las 10:00, es el jueves); una tarea ocupa una franja horaria. Por eso el evento se ve en la
semana y la tarea en el día.

Todo está conectado en una dirección clara: crear un evento repinta la semana, la banda del día, los
puntos del mini calendario y **la cuenta atrás del escritorio**, que toma sus días de la próxima
entrega real en vez de una fecha escrita a mano. Un tipo nuevo de evento es una entrada en `TIPOS`
con su color y su icono; nada más.

La navegación baja de escala: en la semana, la cabecera de cada día y su pie de tareas abren esa
fecha en la vista día. Desde el escritorio, el mini calendario hace lo mismo.

## 7 · Motion

Toda la animación sale de dos curvas, declaradas como tokens:

| Token | Curva | Para qué |
|---|---|---|
| `--ease-out` | `cubic-bezier(.16,1,.3,1)` | Entradas, aterrizajes, revelados. Sale rápido y frena largo |
| `--ease-soft` | `cubic-bezier(.33,1,.68,1)` | Respuestas al puntero: hover, botones |

Duraciones: **240 ms** para responder al dedo, **700–900 ms** para un cambio de estado de la pantalla,
**16–30 s** para lo ambiental del fondo. Nada intermedio: si dudas entre 400 y 600, es que la
animación no tiene claro qué es.

Con `prefers-reduced-motion` se apagan las animaciones, el shader pinta un fotograma y para, y el
editor sigue funcionando entero. **La accesibilidad no recorta funciones, solo movimiento.**

Un detalle de implementación que cuesta caro descubrir: `requestAnimationFrame` **no se dispara en
una pestaña oculta**, así que cualquier animación que dependa de un rAF encadenado se queda a medias.
Por eso el helper `pronto()` combina rAF con un `setTimeout` de respaldo.

---

## 8 · El fondo

Un `<canvas>` WebGL a pantalla completa con la fotografía como textura, en **cuatro pasadas**:

1. **Escena** — encaje *cover*, respiración del encuadre, parallax con el puntero, ondulación del
   asfalto mojado, latido de tungsteno en las ventanas, tinte por ambiente y la onda de edición.
2. **Brillos** — extrae lo que debe resplandecer, con el umbral sesgado hacia lo cálido.
3. **Desenfoque** separable (horizontal + vertical), dos iteraciones a media resolución.
4. **Composición** — escena + resplandor, viñeta, respiración de la luz, grano y **tramado**, que es
   lo que evita el bandeado en los degradados del cielo.

La fotografía va incrustada como WebP de 2000 px al 95 % de calidad (498 KB). Con WebGL2 se generan
mipmaps y filtrado anisotrópico, y se renderiza al doble de densidad de píxel: es lo que quita el
aspecto emborronado al escalar. Sin WebGL2 se pierde el mipmap; sin WebGL, queda el fondo CSS.

Si no hay WebGL, la misma foto se muestra como fondo CSS con un velo. **La página nunca se queda sin
fondo.**

Uniformes que controla la interfaz: `uDay` (0 noche / 1 día), `uEdit` (0 normal / 1 editando),
`uRipple` (origen + instante de la onda).

---

## 9 · Al llevarlo a Next.js

Lo que se conserva tal cual: el registro de widgets, el formato del layout (fracciones + píxeles), la
imantación, los tokens y el shader.

Lo que cambia:

| Ahora | En producción |
|---|---|
| `WIDGETS` como objeto con `body()` que devuelve HTML | Un componente React por widget, con el mismo `def`/`min` en su metadata |
| `localStorage` | Tabla `layouts` con el id de la usuaria |
| `mount(node)` | El propio `useEffect` del componente |
| Datos escritos a mano | La base de datos |

El motor de edición (arrastre, imantación, persistencia) se traduce casi línea a línea: son funciones
puras sobre un objeto de posiciones.
