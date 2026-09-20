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

El layout es un objeto plano `{ id: {fx, fw, y, h} }`. Se guarda bajo
`archicel.layout.escritorio.v3` en este equipo y, si hay sesión, también en
`users/{uid}/layout/escritorio`.

**Solo se guardan posiciones, nunca contenido.** Es la decisión que hace que esto escale: los datos
viven donde tengan que vivir, y el layout es una preferencia visual del usuario.

### Las cuatro garantías

Recolocar el escritorio es el único trabajo que la usuaria hace a mano, bloque a bloque, y el
único que no puede rehacer de memoria. Perderlo una vez ya es demasiado. De ahí estas cuatro
reglas, que no son opcionales:

1. **Se escribe en el acto.** Sin retardos. El retardo de 400 ms que hubo aquí no amortiguaba
   ninguna avalancha —el arrastre mueve el nodo del DOM y solo guarda al soltar— y en cambio
   abría una ventana en la que recargar perdía el último cambio, justo cuando uno mueve algo y
   recarga para ver cómo quedó.
2. **Siempre hay copia en este equipo**, aunque haya sesión. La nube es un destino más, no la
   única verdad. Lo monta `conEspejoLocal` en [espejo.ts](../../src/lib/data/espejo.ts).
3. **Un "no hay nada" remoto nunca borra lo de aquí.** Cuando la nube contesta que el documento
   no existe, se sube la copia local en vez de tirarla. Es la trampa clásica y es la que deja el
   escritorio como el primer día.
4. **Un fallo de escritura se ve.** Nada de `catch` vacíos: sale un aviso diciendo que quedó
   guardado en este equipo. Un fallo silencioso solo se descubre al día siguiente.

> **Cuidado con el puerto.** `localhost:3000` y `localhost:3001` son orígenes distintos y cada uno
> tiene su propio almacenamiento. Por eso `.claude/launch.json` fija el puerto y **no** lleva
> `autoPort`: con él, un arranque en otro puerto parece haber borrado el escritorio entero.

### Migración — lo que pasa al añadir o quitar widgets

Al cargar, el motor recorre el registro actual, no el guardado:

- **Widget que existe en ambos** → se respeta la posición del usuario (acotada a límites válidos).
- **Widget nuevo** → entra en su posición `def`, traducida desde celdas.
- **Widget retirado** → su caja **se conserva tal cual**, invisible: nadie la pinta, no estira el
  lienzo y no ocupa turno en la entrada. Si el widget vuelve, vuelve a su sitio. Antes se
  descartaba, y como lo descartado también se guardaba, quitar un widget un rato borraba su
  posición para siempre.
- **Clave de versión anterior** (`v2`, `v1`) → se rescata y se copia a la clave actual la primera
  vez que se lee. Subir la versión del formato ya no borra nada; la clave vieja se deja donde
  está por si hubiera que volver.

Por eso se puede publicar una versión con tres widgets nuevos sin romperle el escritorio a nadie.

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

Cuatro tallas rápidas (un tercio / la mitad / dos tercios / todo el ancho), **quitar o poner marco**,
traer al frente y **posición original**. Se abre con escala y desplazamiento desde su esquina, se
cierra al pulsar fuera o con `Escape`.

Sus iconos son SVG dibujados a 14 px con trazo 1.7 y remates redondeados, no glifos Unicode. Un `▢`
tomado prestado de la fuente del sistema no comparte peso ni óptica con nada del resto del chrome, y
se nota.

### Widgets sin marco

Cada widget puede quedarse **desnudo**: sin cristal, sin borde, sin sombra, flotando directamente
sobre la fotografía. Se activa desde su menú, o para todos a la vez con el botón **Marcos** de la
barra del editor, que conmuta según lo que haya (si queda alguno con marco, los quita todos).

Es un `desnudo?: boolean` en la `Caja`, así que viaja con la posición: se guarda por usuaria y se
conserva al migrar el layout. El texto gana entonces un halo (`--halo`) para no perderse sobre la
imagen, y las líneas internas del widget —cabeceras, separadores de lista— se vuelven transparentes:
un separador sin caja alrededor se lee como un tachón.

### Opacidad de los bloques

Un deslizador en la barra del editor, de 0 a 100 %, controla el relleno de **todos** los paneles a la
vez. Funciona por tokens: el color y la opacidad viven separados (`--panel-rgb` + `--opa`), así que
un solo valor recalcula paneles, raíl y superficies elevadas sin tocar ninguna regla.

Al 0 % los bloques quedan en puro cristal esmerilado: se conserva el desenfoque, desaparece el tinte.
Por debajo del 35 % el texto pierde su base, así que la página marca `data-translucido` en el `body`
y aplica un halo (`--halo`, distinto por tema) a todo el contenido de los widgets. Es lo que permite
bajar al extremo sin que nada deje de leerse.

**El deslizador manda en el escritorio, no en toda la app.** Las superficies con texto largo sobre la
foto —el calendario— declaran su propio suelo con `max(var(--opa), .66)` y solo pueden subir de ahí.

Se guarda en los ajustes de la usuaria, aparte del layout: son dos preferencias independientes.

### Restablecer

El botón de la barra devuelve **todo** el escritorio a las posiciones `def` del registro.

---

## 6 · Las vistas y sus datos

El raíl navega entre tres páginas, y el calendario contiene dos vistas dentro de una:

| Vista | Qué muestra | Colección |
|---|---|---|
| **Escritorio** | Cuatro widgets libres: bienvenida, reloj, mini calendario y pendientes | `layout/escritorio` (posiciones) |
| **Calendario · Mes** | Solo **eventos**: entregas, exámenes, presentaciones, correcciones, visitas | `eventos` |
| **Calendario · Semana** | Solo **tareas**, repartidas por día | `tareas` |
| **Día** | Agenda de hora a hora con las **tareas** del día, y una banda arriba con los eventos de esa fecha | `tareas` + `eventos` |

Todas cuelgan de `users/{uid}` en Firestore, a través del contrato de `almacen.ts`. Quien escribe una
vista nunca toca Firestore directamente: pide `listar`, `guardar`, `borrar` o `escuchar`.

**Eventos y tareas son cosas distintas a propósito.** Un evento pertenece a un día (una entrega no
empieza a las 10:00, es el jueves); una tarea ocupa una franja horaria. De ahí el reparto: el mes
enseña lo que marca el curso, la semana y el día enseñan lo que ocupa las horas. Mezclarlos fue la
primera versión y se leía como una bandeja de entrada — exactamente lo que este producto no es.

Todo está conectado en una dirección clara: crear un evento repinta el mes, la banda del día y los
puntos del mini calendario del escritorio. Un tipo nuevo de evento es una entrada en `TIPOS` con su
color y su icono; nada más.

**El escritorio se quedó en cuatro bloques a propósito.** Los widgets de cuenta atrás, horario,
asignaturas y horas de taller están escritos y siguen en `CONTENIDOS`, pero fuera del registro: con
pocos datos reales llenaban la pantalla de cajas sin nada dentro. Devolver cualquiera de ellos es
añadir su línea a `WIDGETS`.

La navegación baja de escala: en la semana, la cabecera de cada día, cualquiera de sus tareas y su
pie abren esa fecha en la vista día. Desde el escritorio, el mini calendario hace lo mismo.

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
   asfalto mojado en dos escalas, latido de tungsteno en tres frecuencias inconmensurables, tinte
   por ambiente y la onda de edición.
2. **Brillos** — extrae lo que debe resplandecer, con el umbral sesgado hacia lo cálido.
3. **Desenfoque** separable (horizontal + vertical), dos iteraciones a media resolución.
4. **Composición** — la pasada de lente. Por orden: aberración cromática, haces volumétricos,
   halación, viñeta, respiración de la luz y grano.

### El encaje *cover*, que es donde más fácil se falla

Para recortar hay que **encoger** el rango de coordenadas, no agrandarlo:

```glsl
vec2 s = vec2(min(ca/uTexAspect, 1.0), min(uTexAspect/ca, 1.0));
uv = (uv - 0.5) * s + 0.5;
```

Agrandarlo saca la lectura fuera de `[0,1]`, el `clamp` posterior repite el último téxel y la imagen
aparece **embadurnada en franjas** desde los bordes. En horizontal se disimula; en un móvil en
vertical, donde la pantalla es cuatro veces más estrecha que la fotografía, destroza la imagen. Si
alguna vez el fondo se ve rayado, es aquí.

### La pasada de lente

Lo que separa una foto pegada de fondo de una imagen que parece filmada. Ninguna de estas capas sube
el brillo medio: **reparten** el que ya hay.

| Capa | Qué hace | Por qué |
|---|---|---|
| Aberración cromática | Desplaza rojo y azul en direcciones opuestas, proporcional a `d²` | Ninguna lente real enfoca los tres canales en el mismo punto; sin esto los bordes son "de render" |
| Haces volumétricos | Diez muestras del buffer de brillos arrastradas desde `(0.5, 0.54)` con decaimiento `0.855` | Es la luz de la casa atravesando el aire. Se atenúa cerca del origen (`smoothstep`) para no formar un halo plano |
| Halación | El resplandor tira a ámbar cuanto más cálido es, nunca a blanco | Es lo que hace el negativo alrededor de una luz de tungsteno |
| Grano | `0.026` en las sombras, se apaga hacia las luces | En película el grano vive en la sombra. Un grano uniforme se lee como ruido digital |
| Tramado | ±1/255 | Evita el bandeado en los degradados del cielo |

**El brillo es un presupuesto, no un acelerador.** El resplandor está en `0.26` de noche y `0.15` de
día porque encima va una interfaz que hay que poder leer. Si el fondo compite con el texto, el fondo
pierde: sube el suelo de opacidad del panel antes que bajar el shader, y si aun así compite, baja el
shader.

La fotografía va como WebP de 3840 px (1.79 MB). Con WebGL2 se generan mipmaps y filtrado
anisotrópico, y se renderiza al doble de densidad de píxel: es lo que quita el aspecto emborronado al
escalar. Sin WebGL2 se pierde el mipmap; sin WebGL, queda el fondo CSS con un velo. **La página nunca
se queda sin fondo.**

Uniformes que controla la interfaz: `uDay` (0 noche / 1 día), `uEdit` (0 normal / 1 editando),
`uRipple` (origen + instante de la onda).

---

---

## 9 · La materialidad del cristal

Un rectángulo traslúcido no es cristal; es un rectángulo traslúcido. Lo que le da espesor son tres
capas que nadie nota por separado:

| Capa | Dónde | Qué es |
|---|---|---|
| Filo especular | `.widget::before` | 1 px de luz en el canto superior. Es donde la luz rasa se queda en un material con grosor |
| Reflejo móvil | `.widget::after` | Un óvalo de 420×320 que sigue al cursor vía `--mx` / `--my` |
| Sombra proyectada | `box-shadow` del widget | `0 14px 34px -22px` — con **desplazamiento y difuminado**. Un halo sin desplazamiento no es sombra, es decoración |

Las dos primeras son `pointer-events:none` y desaparecen en `.widget.desnudo`: sin cristal no hay
filo que iluminar.

**El reflejo lo escribe un solo escuchador en el lienzo**, no uno por widget, y escribe una vez por
fotograma en variables CSS —nunca en el estado de React—. Ocho paneles bajo el ratón no pueden
costar ocho renders. Está en `Escritorio.tsx`, junto al resto de efectos del lienzo.

### La llegada

Los widgets no aparecen: se posan, en el orden en que se lee la página. `useEscritorio` calcula
`orden` agrupando por bandas de 60 px —así dos paneles alineados a ojo entran juntos aunque difieran
un píxel— y el índice viaja al CSS como `--i`, que se convierte en `52 ms` de retraso por puesto.

La animación cuelga de `.canvas.posado`, y esa clase solo se pone cuando el layout **real** ya llegó
del almacén. Sin esa condición se vería a cada widget aterrizar en su posición de fábrica y saltar
después a la suya.

---

## 10 · El calendario, en dos modos

Una página, dos calendarios que no se mezclan:

| Modo | Muestra | Por qué |
|---|---|---|
| **Mes** | Solo **eventos** | Lo importante del curso, de un vistazo. Una entrega no debe competir con "gimnasio" |
| **Semana** | Solo **tareas** | Lo que ocupa las horas, repartido por días |

La semana lleva al día: cabecera, tarea o pie, todo abre `/dia?f=<fecha>`. El mes también, pero el
día sigue siendo de tareas — mes y día no comparten contenido, solo destino.

### El relevo

Los dos paneles ocupan el mismo hueco, así que no se cruzan: se relevan. El saliente se apaga hacia
el desenfoque (`SALIDA`, 200 ms, que debe coincidir con `calOut`), y **solo entonces** entra el otro.

`key={modo}` remonta el contenedor, y ahí está el detalle que cuesta una tarde: sin el remonte, la
clase `.sale` con `forwards` sostiene `opacity:0` sobre el panel **nuevo** y la vista queda en negro
con el DOM perfectamente correcto. Si alguna vez el calendario aparece vacío pero el DOM tiene sus
siete columnas, mira la animación de salida antes que los datos.

### El suelo de opacidad

El calendario **no obedece al deslizador de opacidad del escritorio**. Un panel al 30 % sobre una
fotografía deja el texto por debajo del mínimo legible, así que `.cal-panel` declara:

```css
--suelo: max(var(--opa), .66);
```

Solo puede subir. Cualquier superficie nueva que lleve texto largo sobre la foto debería hacer lo
mismo en lugar de heredar `--opa` a pelo.

### La semana es una hoja de planos

Siete cajetines separados por filete, no siete tarjetas flotando. El filete lo pone la propia rejilla
con un `repeating-linear-gradient` al que se le recorta el último trazo con una máscara: añadir o
quitar columnas nunca deja un separador huérfano. El fin de semana se marca con **tramado**, como en
un plano; el día de hoy recibe una caída de luz cálida desde arriba.

---

## 11 · El raíl líquido

No es una columna de arriba abajo ni un bloque macizo: son **burbujas de cristal, una por
sección**, centradas en la altura de la ventana. Añadir una página añade su burbuja y el conjunto
crece solo, porque las posiciones se miden del DOM y no hay ninguna constante que actualizar.

El indicador del activo no salta de hueco en hueco: fluye. El efecto se llama **gooey** (o
*metaball*) y es lo que hay debajo de lo que Apple vende como *Liquid Glass*. Se consigue con un
filtro SVG de dos pasos: un desenfoque fuerte y, después, un contraste brutal sobre el canal alfa. El
desenfoque hace que dos formas cercanas se toquen; el contraste convierte esa transición suave en un
contorno nítido. Subir el desenfoque sin subir el contraste da niebla, no líquido.

### Dos capas, cada una con su mitad del efecto

| Capa | Qué aporta |
|---|---|
| `.rail-fluido` | Las burbujas y la gota del activo, pasadas por el gooey. De aquí sale el cuerpo y, sobre todo, la fusión entre burbuja y gota |
| `.nav-btn` | Encima y **sin filtro**: el cristal de verdad, con su `backdrop-filter`. Un `backdrop-filter` no sobrevive dentro de un filtro SVG, y un icono pasado por un gooey es una mancha |

### Las dos gotas

Aquí está el truco, y sin él no hay efecto: **la gota activa son dos círculos con distinta
velocidad**, 400 ms y 880 ms. Al cambiar de sección la rápida sale disparada y la lenta se rezaga;
mientras viajan, el filtro las une con un cuello que se estira, y al llegar se funden otra vez en
una. Medido, se separan unos 14 px a mitad de camino. Con una sola gota el movimiento se lee como un
bloque que resbala.

La lenta lleva además una curva con rebote: al llegar sobrepasa un poco y vuelve, como un líquido que
se asienta.

### Por qué el cuerpo no puede ser translúcido

El contraste de alfa del filtro (`0 0 0 26 -12`) descarta todo lo que baje de ~0.46 de opacidad: una
burbuja translúcida sencillamente desaparece. Para que el raíl no se lea como un agujero negro sobre
la fotografía, lo que se aclara es **el color**, no la opacidad — grises medios a alfa alto.

El `backdrop-filter` tampoco sobrevive dentro de un filtro SVG, así que el desenfoque de fondo vive
en los enlaces, que van encima y sin filtro. El filtro pone el cuerpo y la fusión; los enlaces, el
cristal de verdad.

### Lo que cuesta caro descubrir

- **La región del filtro hay que declararla.** Por defecto recorta a la caja del elemento y la gota
  se decapita al salirse. De ahí el `x="-60%" width="260%"` del `<filter>`.
- **El fondo de la navegación no lo pintaba el raíl.** La banda oscura que llegaba de arriba abajo
  era un `linear-gradient` en `.app`, no el raíl: buscarlo en el raíl no lleva a ninguna parte.
- **La posición se guarda en el módulo, no en el estado.** Cambiar de sección remonta el componente,
  y sin un valor anterior del que partir la transición no se dispara: las gotas nacerían ya en su
  destino. Por eso hay un objeto `memoria` fuera de React.
- **Medir dos veces.** Una en el fotograma siguiente al montaje y otra 120 ms después. En desarrollo
  React monta, desmonta y remonta, y un `requestAnimationFrame` pendiente se pierde por el camino;
  sin la segunda pasada el indicador no aparece.
- **El negro es medio, no absoluto.** Sobre una fotografía nocturna un bloque casi opaco se lee como
  un agujero recortado, no como cristal.

---

## 12 · El motor de datos, y por qué parpadeaba

Los eventos de un mismo día parpadeaban. La causa no era una sino tres, y ninguna se veía
mirando el componente que parpadeaba:

1. **El orden no desempataba.** La consulta ordenaba por `fecha` y nada más. Dos eventos
   del mismo día quedaban empatados, así que su posición relativa podía cambiar de una
   lectura a otra. React los reordena moviendo nodos en el DOM — y **mover un nodo
   reinicia sus animaciones CSS**. De ahí que solo ocurriera con dos o más el mismo día.

2. **El almacén avisaba aunque no hubiera cambiado nada.** Cada emisión construye una
   lista nueva, así que cada una provocaba un render aunque el contenido fuera idéntico.
   Firestore emite dos veces por escritura de serie: una optimista al guardar y otra al
   confirmar el servidor.

3. **Cada chip tenía su propia animación de entrada**, y reposaba en `opacity: 0`
   sosteniendo el resultado con `forwards`. Cualquier reinicio lo devolvía a invisible.

Las tres juntas: un dato se reordena, el nodo se mueve, la animación se reinicia desde
cero y el evento desaparece y reaparece.

### Lo que hace ahora `useDatos`

- **Ordena con desempate final por `id`**, que nunca empata. El orden es el mismo en cada
  lectura, venga de Firestore o de `localStorage`, y los nodos dejan de moverse.
- **Compara antes de avisar**: si la lista nueva es idéntica a la anterior, no actualiza.
  Las dos emisiones de cada escritura dejan de costar dos renders.
- La suscripción se reabre **solo** al cambiar de almacén o de rango; `escuchar` vive en
  una ref para que cambiar de identidad de función no la reabra.

Los chips ya no llevan animación propia: el momento coreografiado del calendario lo
llevan las celdas y las columnas. Un evento es un dato, no una entrada en escena.

### Cómo comprobarlo sin fiarse del ojo

Un parpadeo es un nodo que se recrea o una animación que arranca. Las dos cosas se
cuentan desde la consola, y esa es la prueba que vale:

```js
let anim = 0;
document.addEventListener('animationstart', () => anim++, true);
new MutationObserver(ms => { /* contar addedNodes con .chip-ev */ })
  .observe(document.querySelector('.mes-rejilla'), { childList: true, subtree: true });
```

En reposo, ambos contadores deben quedarse en cero. Recorriendo meses adelante y atrás
los chips **sí** se recrean —es correcto, cambia el mes— pero las animaciones deben
seguir en cero: eso es lo que garantiza que recrear un nodo ya no se vea.

Medido tras el arreglo: 10 s en reposo con un día de dos eventos → 0 y 0. Cuatro idas y
vueltas de mes → 16 chips recreados y **0 animaciones**.
