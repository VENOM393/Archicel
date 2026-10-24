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
| **Repetición espaciada** | Planificar repasos que se van separando en el tiempo | **la tabla, construida** · [METODOS.md](../frontend/METODOS.md) |
| **Pomodoro** | Cronómetro de estudio y cuánto se le ha dedicado a cada asignatura | **construido** · [METODOS.md](../frontend/METODOS.md) |
| **Sketchap** | *Pendiente de aclarar qué es* | § 4 |

Y fuera de los tres métodos: **el modo foco** del escritorio, construido (§ 3).

Lo que tienen en común, y conviene decidirlo una vez para los tres: **todos producen un
registro de tiempo por asignatura y por día**. Si los tres escriben en el mismo sitio, la
pregunta «¿a qué le he dedicado más tiempo este mes?» se contesta sola y una sola vez.

---

## 1 · Repetición espaciada — **la tabla está, el método no**

Construida el 24 de octubre de 2026. La superficie vive en
[docs/frontend/METODOS.md](../frontend/METODOS.md) § 3: cuatro partes del día de dos horas,
asignaturas que se arrastran, un día cada vez.

Se resolvieron dos de las cinco decisiones:

- **Un bloque es una entidad nueva, no una `Tarea`** (decisión 1). Una tarea ocupa una
  franja del reloj; esto ocupa una *parte del día*, y «mañana» no es «de 9 a 11» — las
  horas las sabe ella. Hacerlo tarea habría obligado a inventarle un horario y habría
  mezclado «estudiar física» con «gimnasio» en la agenda y en el mes.
- **Las cuatro partes no llevan horas** (decisión 4), por lo mismo y porque él lo pidió
  así: «cada apartado es de 2 horas, pero eso ya lo tengo que saber yo».

**Siguen abiertas las tres que convierten la tabla en el método**, y son las que importan:

1. **Quién decide cuándo toca repasar.** Hoy lo coloca ella a mano, así que esto es una
   agenda bonita y no repetición espaciada. ¿Propone la aplicación —1 día, 3 días, 1
   semana, 2 semanas— y ella acepta o mueve? Eso es lo que haría que el método funcionara.
2. **Qué se repasa.** ¿Una asignatura entera, un tema, un apunte? Con las **etiquetas** que
   ya existen, «Tema 3» podría ser la unidad — y eso las convertiría de golpe en algo más
   que un filtro.
3. **Qué pasa si un día no estudia.** El repaso que no se hizo, ¿se arrastra, se pierde, o
   reinicia la cuenta? Es la decisión que separa una herramienta que acompaña de una que
   regaña.

Y una que ha aparecido al construirlo: **el planificador escribe `bloques` y el pomodoro
escribe `sesiones`**. Cruzarlos diría «planeaste 2 h de mates y echaste 50 min». Sale casi
gratis; falta decidir si ese espejo ayuda o regaña.

---

## 2 · Pomodoro — **construido**

Se construyó el 21 de octubre de 2026 y vive en [docs/frontend/METODOS.md](../frontend/METODOS.md).
Ahí están las seis decisiones que estaban abiertas aquí y cómo se resolvió cada una: que lo
que se guarda es **cuándo empezó** y no cuánto queda, que se apunta **una fila por
pomodoro**, que **uno abandonado no cuenta**, y que el descanso encadena solo.

Lo único que sigue sin decidir de esta lista es **avisar con la pestaña de fondo**: hoy el
aviso es la tira de la casa y no una notificación del sistema.

---

## 3 · Modo foco — **construido**

Se construyó el 24 de octubre de 2026. Vive en `src/components/Foco.tsx` y está contado
en `CLAUDE.md`, § «Modo foco».

De las tres lecturas que se plantearon, Cristian eligió la segunda: **una sesión que
empieza**. La píldora del escritorio abre el mismo pomodoro a pantalla completa, con lo de
esa asignatura delante — qué viene y los últimos apuntes con su nota.

Lo que se decidió sobre la marcha, por si hace falta volver sobre ello:

- **Qué se ve mientras tanto:** el reloj, la asignatura, lo que viene y lo último subido.
  Nada más.
- **Cómo se sale:** Escape o el botón, y **salir no para el cronómetro** — por eso la
  píldora enseña la cuenta cuando hay algo corriendo.
- **Si cuenta:** sí. Es el mismo pomodoro, así que escribe en `sesiones` como cualquier
  otro. El registro de «a qué le has dedicado tiempo» no distingue de dónde se arrancó, y
  no tiene por qué.

---

## 4 · Sketchap

**Estado:** sin empezar — **falta saber qué es**

Es el tercer método de la lista y no se explicó. Hace falta una frase de Cristian antes de
poder anotar nada: puede ser **SketchUp** (el programa de modelado 3D, que en una escuela
de arquitectura tiene todo el sentido), un método de estudio dibujando a mano, o una
aplicación concreta que use Celeste.

Apuntarlo mal aquí es peor que dejarlo en blanco, porque luego se construye lo apuntado.
