# Ideas

Lo que Cristian quiere que Archicel haga algún día, apuntado cuando se le ocurre y no
cuando se construye. **Esto no es una lista de tareas ni un compromiso**: es memoria, para
que al atacar una idea no haya que reconstruir de qué iba ni por qué importaba.

Cada entrada guarda tres cosas: **qué se pidió** (lo más fiel posible a sus palabras), **con
qué se conecta** de lo que ya existe, y **qué falta decidir** — que suele ser la parte que
convierte una idea de diez minutos en una tarde.

Cuando una idea se construye, se quita de aquí y pasa a su documento propio.

---

# Métodos de estudio

**La sección existe** (`/metodos`, quinta del dock). De momento tres métodos:

| Método | Qué es | Estado |
|---|---|---|
| **Repetición espaciada** | Planificar repasos que se van separando en el tiempo | idea · § 1 |
| **Pomodoro** | Cronómetro de estudio y cuánto se le ha dedicado a cada asignatura | **construido** · [METODOS.md](../frontend/METODOS.md) |
| **Sketchap** | *Pendiente de aclarar qué es* | § 3 |

Lo que tienen en común, y conviene decidirlo una vez para los tres: **todos producen un
registro de tiempo por asignatura y por día**. Si los tres escriben en el mismo sitio, la
pregunta «¿a qué le he dedicado más tiempo este mes?» se contesta sola y una sola vez.

---

## 1 · Repetición espaciada

**Estado:** idea · pedida el 21 de octubre de 2026

### Qué se pidió

Una **tabla diaria** dividida en las **cuatro partes del día** (mañana, mediodía, tarde,
noche). Cada bloque dura **2 horas fijas**, y dentro de cada uno ella reparte las
asignaturas como quiera respetando ese tope:

> «por la mañana 2 h de mates, por el mediodía 1 h física y 1 h dibujo, pero respetando
> siempre las 2 h»

Dos cosas que pidió explícitamente:

- **Mover las asignaturas arrastrando** dentro de cada bloque, e indicar cuántas horas le
  dedica a cada una.
- **Moverse entre días con flechas**, viendo qué día es, para poder organizarse qué
  asignaturas toca cada día.

Y el porqué del método, que es lo que no hay que perder de vista:

> «comenzar con repasos o estudios seguidos de la asignatura como al día siguiente etc y
> luego ir posponiéndolo para mejorar nuestra memoria»

Es decir: no es un horario, es un **calendario de repasos que se van separando**. Primero
hoy, luego mañana, luego a los tres días, luego a la semana. La tabla diaria es la
superficie; lo que la llena es el método.

### Con qué se conecta

- **`Tarea`** (`src/lib/data/tipos.ts`) ya es casi esto: tiene `fecha`, `ini`, `fin` en
  minutos, `asignatura?`, `hecha` y `progreso`. Un bloque de estudio **podría ser una
  tarea**, y entonces aparecería sola en la agenda del día y en la vista de semana del
  calendario, que ya existen y ya la saben pintar.
- **La vista Semana de `/calendario`** ya reparte tareas por día y hora. Es el pariente más
  cercano a lo que se pide.
- **`ASIGNATURAS` y sus colores** (`src/lib/data/curso.ts`) dan el catálogo y el color de
  cada bloque sin inventar nada.
- **El arrastre** del panel de apuntes (`TIPO_ARRASTRE`, dianas con anillo) es el mismo
  gesto y se puede reutilizar entero.
- **`useAhora`** para saber qué día es hoy, nunca `new Date()` en el render.

### Qué falta decidir

1. **¿Un bloque de estudio es una `Tarea` o una entidad nueva?** Si es una tarea, sale
   gratis en el calendario y en la agenda del día, pero hereda cosas que no le pegan
   (`icono`, `color` propio) y mezcla «estudiar física» con «gimnasio» en las mismas
   listas. Si es nueva, hace falta colección, reglas de Firestore, migración y hooks — la
   receta entera de `docs/data/FIRESTORE.md`.
2. **Quién decide cuándo toca repasar.** Es el corazón del método y no se pidió explícito:
   ¿lo propone la aplicación (1 día, 3 días, 1 semana, 2 semanas…) y ella acepta o mueve?
   ¿O lo coloca ella a mano y la aplicación solo lo recuerda? Lo primero es lo que hace
   que el método funcione; lo segundo es una agenda bonita.
3. **Qué se repasa.** ¿Una asignatura entera, un tema, o un apunte concreto? Con las
   **etiquetas** que ya existen, «Tema 3» podría ser la unidad de repaso — eso las
   convertiría de golpe en algo más que un filtro.
4. **Las cuatro partes del día: ¿a qué horas?** Mañana/mediodía/tarde/noche necesitan
   franjas concretas para poder convivir con el horario de clase, que ya ocupa de 9 a 14.
5. **Qué pasa si un día no estudia.** El repaso que no se hizo, ¿se arrastra al día
   siguiente, se pierde, o reinicia la cuenta? Es la decisión que separa una herramienta
   que acompaña de una que regaña.

---

## 2 · Pomodoro — **construido**

Se construyó el 21 de octubre de 2026 y vive en [docs/frontend/METODOS.md](../frontend/METODOS.md).
Ahí están las seis decisiones que estaban abiertas aquí y cómo se resolvió cada una: que lo
que se guarda es **cuándo empezó** y no cuánto queda, que se apunta **una fila por
pomodoro**, que **uno abandonado no cuenta**, y que el descanso encadena solo.

Lo único que sigue sin decidir de esta lista es **avisar con la pestaña de fondo**: hoy el
aviso es la tira de la casa y no una notificación del sistema.

---

## 3 · Sketchap

**Estado:** sin empezar — **falta saber qué es**

Es el tercer método de la lista y no se explicó. Hace falta una frase de Cristian antes de
poder anotar nada: puede ser **SketchUp** (el programa de modelado 3D, que en una escuela
de arquitectura tiene todo el sentido), un método de estudio dibujando a mano, o una
aplicación concreta que use Celeste.

Apuntarlo mal aquí es peor que dejarlo en blanco, porque luego se construye lo apuntado.
