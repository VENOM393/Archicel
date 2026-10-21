# Métodos de estudio

`/metodos`, la quinta sección del dock. Tres tarjetas de cristal, una por método, y **cada
una enseña dentro lo que hace**: el anillo del pomodoro, la escalera de repasos
separándose, el alzado a trazo. La página es el selector — no hay una lista de nombres y
luego otro sitio donde pasan las cosas.

Al pulsar una **crece hasta ocupar la pantalla**, y dentro va toda la configuración de ese
método. No hay pantalla de ajustes aparte: se configura donde se usa.

**Estado: el pomodoro funciona entero.** Los otros dos abren igual y dicen que están por
definir. De la repetición espaciada quedan decisiones abiertas —sobre todo quién decide
cuándo toca repasar— y de Sketchap no se sabe todavía qué es. Un método a medias que
parece terminado es peor que uno que dice que aún no está.

Ficheros: `src/components/Metodos.tsx`, `src/app/metodos/page.tsx`, las reglas `.met-*` de
`src/styles/archicel.css`, la colección `sesiones` del almacén.

---

## 1 · El taller

### La tarjeta crece: `layoutId`, no una medición

La tarjeta pequeña y la abierta comparten `layoutId={'met-' + clave}`. Motion encuentra la
misma caja en otro sitio del DOM y la lleva de una a otra midiendo lo que hay de verdad.
Es el mismo mecanismo que el agua del dock y la píldora del calendario, y por la misma
razón: **una posición deducida se desincroniza de lo que se ve y no hay forma de notarlo
leyendo el código**.

Dentro de la abierta, el contenido entra con `DENTRO_DEL_METODO` y sus partes con
`METODO_APARTADO`, escalonadas. Las tarjetas que no se han pulsado salen con
`METODO_APARTADO` en vez de desvanecerse en bloque: la que se abre tiene que poder leerse
como *la elegida*, y eso solo pasa si las otras dos se apartan.

### Tres decisiones del aspecto

- **El color del método es un detalle de dentro, nunca el relleno de la superficie.** El
  cristal es carbón neutro, igual que en `/asignaturas`. Tres tarjetas teñidas de naranja,
  azul y morado serían el arcoíris que estas pantallas ya dejaron de ser.
- **La fila lleva tope de alto (470 px) y se centra.** Sin el tope las tarjetas se
  estiraban a 612 px para enseñar un dibujo de 150 px y un párrafo: el nombre quedaba en
  el sótano y la tarjeta se leía como una pantalla a medio cargar.
- **El pie reserva dos líneas.** Una descripción de una línea y otra de dos dejaban los
  tres títulos a alturas distintas y la fila se leía desalineada. Es la misma razón por la
  que el nombre de una celda de apuntes reserva dos.

---

## 2 · El pomodoro

### Lo que se guarda es cuándo empezó, nunca cuánto queda

En `localStorage`, bajo `archicel.pomodoro.v1`:

```ts
interface EnMarcha {
  asignatura: string;
  arranque: number;              // milisegundos desde la época
  largo: number;                 // minutos de ESTA fase
  fase: 'estudio' | 'descanso';
}
```

Esa es la pieza que hace que el cronómetro sobreviva a recargar, a cambiar de sección y a
cerrar la pestaña. Veinticinco minutos son muchos para no tocar nada, y un contador que
vive en memoria se pierde con la página.

**El latido recalcula contra el reloj real**, no descuenta un segundo cada vez. Si la
pestaña se duerme —y se duerme: los navegadores estrangulan los temporizadores de fondo—,
al volver el número es el correcto y no uno viejo que se quedó parado.

No va en Firestore porque no es un dato: es el estado de un aparato en esta ventana. Si
estuviera en la nube, arrancar un pomodoro en el portátil pondría el móvil a contar
también.

### Qué se apunta, y qué no

Una fila por sesión en la colección `sesiones`:

```ts
{ asignatura, fecha, minutos, metodo: 'pomodoro', ini }
```

- **Una fila por pomodoro, no una por asignatura y día que se va sumando.** Desde las filas
  sueltas se reconstruye el total; desde el total no se puede saber a qué hora rinde mejor.
  Lo que no se guarda no se recupera.
- **`ini` son los minutos desde medianoche** en que empezó. Es lo que deja contestar algún
  día «¿a qué hora estudias mejor?» sin volver a pedir nada.
- **Un pomodoro abandonado no cuenta.** «Parar» no escribe nada. Contar los trece minutos
  sería más fiel al tiempo real, pero convierte el cronómetro en algo que se puede empezar
  y dejar para inflar el total, y entonces la tabla deja de decir la verdad — que es justo
  lo único que se le pidió.
- **El descanso no cuenta** en el total de estudio, y al terminar **encadena solo** a la
  siguiente fase. Un pomodoro que exige pulsar algo para descansar no descansa.

`anotado` es un `useRef` con el `arranque` de la última sesión apuntada: el latido corre
cada segundo y sin esa marca un tic de más duplicaría la fila.

### El anillo

- **Parado está vacío, no lleno.** `restante` vale 0 cuando no corre, así que la cuenta
  `1 - restante/total` daba el anillo entero pintado: parecía un pomodoro recién terminado
  en vez de uno que no ha empezado, que es exactamente lo contrario.
- **El color sale de la asignatura elegida, corriendo o no.** El anillo dice de qué es
  antes de empezar, que es cuando hace falta saberlo.
- **El nombre de la asignatura va también parado.** Sin él la columna da un salto de
  maquetación justo al arrancar, que es el peor momento posible para que algo se mueva sin
  motivo.
- `stroke-dashoffset` se anima **desde el CSS** (`transition`), no desde Motion: es una
  propiedad que Motion no toca aquí, y una propiedad tiene un dueño.

### Con la tarjeta cerrada también se ve

Es el arreglo que la primera versión pedía a gritos: se arrancaba un pomodoro, se cerraba
la tarjeta, y **el taller quedaba exactamente igual que antes de empezar**. El único
estado que de verdad importa era el único que no se veía.

Corriendo, la tarjeta del pomodoro:

- cambia su anillo decorativo por **el de verdad**, con la cifra dentro. No cambia de
  forma al arrancar: empieza a decir la verdad;
- toma **el color de la asignatura**, no el del método — lo que identifica un pomodoro
  vivo es de qué es, no que sea un pomodoro;
- dice «Estudiando · Matemáticas Aplicadas I» donde antes iba su descripción, y «Volver»
  donde iba «Empezar».

Y la placa de la cabecera gana «24:57 estudiando» con un punto que late. Hace falta porque
la placa suma **lo terminado**, así que un pomodoro a mitad no aparecía en ninguna de sus
dos cifras.

El filete y un rescoldo, nada más. Teñir la superficie entera sería el segundo saturado que
el contrato prohíbe, y además un cartel.

**Por qué el estado vive fuera de `Pomodoro`.** `leerMarcha`/`escribirMarcha`/`useMarcha`
están al principio del fichero porque la tarjeta cerrada también los necesita, y
`escribirMarcha` lanza un aviso (`archicel:pomodoro`) para que dentro de la misma pestaña
todo el mundo se entere — `storage` solo avisa a **las otras**. El latido de `useMarcha`
**solo late si hay algo que contar**: sin pomodoro no hay `setInterval`, así que el taller
quieto no despierta a React una vez por segundo para no cambiar nada.

### Las duraciones se bloquean mientras corre

Cambiar el largo a mitad haría que lo que se anota al terminar no fuera lo que de verdad se
estudió.

### El aviso es la tira de la casa, no una notificación del sistema

Al terminar sale `avisar(...)`. Sigue abierto si merece la pena pedir permiso de
notificaciones para avisar con la pestaña de fondo — el service worker ya está montado y
haría falta poco. Es la decisión 2 de IDEAS § 2 y no se ha tomado.

---

## 3 · El registro

«A qué le has dedicado tiempo», últimos 30 días, agregado por asignatura con una barra
proporcional a la mayor. Es **el producto**: el cronómetro es la excusa. Lo que se pidió
fue *«así podré ir viendo a qué le he dedicado más tiempo»*.

Dos cosas que no se tocan:

- **Nada de rachas** ni de «llevas tres días sin estudiar». Vale para los tres métodos.
- **El total no se presenta como una meta.** Es un espejo, no un objetivo: dice a qué le ha
  dedicado tiempo, no cuánto le falta.

---

## 4 · La colección `sesiones`

| campo | tipo | |
|---|---|---|
| `asignatura` | `string` | la clave de `ASIGNATURAS`, ≤ 120 |
| `fecha` | `YYYY-MM-DD` | el día en que **empezó** |
| `minutos` | `int` | > 0 y ≤ 1440 |
| `metodo` | `string` | `'pomodoro'` hoy; ≤ 40 |
| `ini` | `int?` | minutos desde medianoche. **Opcional** |

Está en `estaValidada` de `firestore.rules` y tiene su `match` — los dos o ninguno, porque
los `match` de Firestore se suman y el comodín del final dejaría entrar cualquier cosa.

**`ini` es opcional, así que está en la lista de opcionales de `almacen-firestore.ts`**: el
que no llega se manda como `deleteField()`. Y el orden de la colección es **`fecha`**, que
es obligatorio: ordenar por un opcional hace que Firestore excluya en silencio los
documentos que no lo tienen y devuelva una lista vacía.

`'sesiones'` está también en `PASOS` de `src/lib/data/index.ts`, para que lo guardado sin
cuenta suba al entrar.

> **Las reglas se publican ANTES de que la aplicación escriba.** `esRechazo` trata
> `permission-denied` como definitivo y marca la parte como migrada para siempre: si la app
> sale antes que las reglas, el primer arranque da la migración por hecha con todo
> rechazado y no se reintenta nunca.

---

## 5 · Lo que falta

- **Repetición espaciada**: cinco decisiones abiertas en `docs/ideas/IDEAS.md` § 1.
- **Sketchap**: falta saber qué es. Apuntarlo mal es peor que dejarlo en blanco, porque
  luego se construye lo apuntado.
- **Avisar con la pestaña de fondo** (§ 2 de este documento).
- **Enlazar desde la página de una asignatura**: un botón que arranque un pomodoro de
  *esta* asignatura quita un paso, pero esconde la función si es el único sitio donde
  está. Con el taller ya construido, el botón ya no esconde nada.
