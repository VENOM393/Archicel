# La API de Canvas de la UCAM

El campus virtual de la UCAM es **Canvas LMS**, de Instructure, y trae una API REST
completa. Este documento es lo que hay que saber antes de decidir si Archicel se conecta a
ella, y lo que costaría.

Lo que está marcado como **comprobado** lo he verificado contra el servidor real de la
UCAM; lo que está marcado como **documentado** sale de la documentación oficial de Canvas
y no se ha podido probar sin una cuenta.

## Lo que hay, comprobado

| Dato | Valor |
|---|---|
| Dominio del campus | `https://cv.ucam.edu` → redirige (301) a **`https://canvas.ucam.edu`** |
| Raíz de la API | `https://canvas.ucam.edu/api/v1/` |
| Autenticación | `WWW-Authenticate: Bearer realm="canvas-lms"` — Canvas LMS estándar |
| Sin credencial | `401` con `{"status":"unauthenticated","errors":[{"message":"Autorización del usuario requerida"}]}` |
| Entrada de usuario | **SSO de Microsoft / SAML** — la pantalla de acceso es la de Microsoft Entra |
| OAuth2 | `/login/oauth2/auth` y `/login/oauth2/token` responden: el flujo existe |
| Límite de uso | Cubo con fugas. Cabeceras `x-rate-limit-remaining` (empieza en **700**) y `x-request-cost` (~0,01 por petición trivial) |

## El obstáculo que decide la arquitectura

**La API de Canvas no permite llamadas desde un navegador.** Comprobado: una petición
`OPTIONS` de prevuelo con `Origin: http://localhost:3000` devuelve `404` y **ninguna**
cabecera `Access-Control-Allow-Origin`.

Esto no es un detalle de configuración de la UCAM: Canvas no publica CORS a propósito,
porque su credencial es un token portador que da acceso total a la cuenta. Si el navegador
pudiera llamar, el token tendría que estar en el navegador.

Consecuencia directa para Archicel: **hace falta servidor**. La aplicación es hoy
enteramente de cliente —Firestore la sostiene desde el navegador— y conectar Canvas
significa añadir la primera pieza que corre en el servidor: un *route handler* de Next.js
que guarde el token, hable con Canvas y devuelva solo lo que la pantalla necesita.

## Cómo se entra

### Token personal — la vía realista

Canvas deja a cada usuario generar un token desde **Cuenta → Configuración → Nuevo token
de acceso**. Es lo que usaría Archicel.

- **Comprobar primero**: el administrador de la UCAM puede haber desactivado esa opción.
  Hay que entrar en `https://canvas.ucam.edu/profile/settings` y mirar si el botón existe.
- **Con SSO de Microsoft el token sigue funcionando**: se genera una vez, con sesión
  iniciada, y a partir de ahí no vuelve a hacer falta pasar por Microsoft.
- **Caduca si se le pone fecha**, y la UCAM puede forzar una. Un token caducado devuelve
  `401`, así que la aplicación tiene que distinguir «token caducado» de «Canvas caído».

### OAuth2 — la vía correcta, probablemente cerrada

Es el flujo que usarías si Archicel fuese un producto: la usuaria pulsa, va a Canvas,
acepta y vuelve con un token. Requiere una **clave de desarrollador** emitida por el
administrador de Canvas de la UCAM, con su `client_id`, su `client_secret` y su URL de
retorno registrada.

Para una aplicación personal de una estudiante, pedir eso a la universidad es un trámite
que casi con seguridad no prospera. **No merece la pena intentarlo antes de tener el resto
funcionando con un token personal.**

## Los endpoints que le importan a Archicel

Todos cuelgan de `https://canvas.ucam.edu/api/v1/` y llevan la cabecera
`Authorization: Bearer <token>`.

### El más valioso: el planificador

```
GET /planner/items?start_date=2026-09-01&end_date=2026-12-31
```

Devuelve **todo lo que vence, de todas las asignaturas, en un rango de fechas**, que es
exactamente la pregunta que contesta el escritorio de Archicel. Un estudiante puede pedir
el suyo sin permisos especiales.

Cada elemento trae `plannable_type` (`assignment`, `quiz`, `calendar_event`…),
`plannable_date`, el objeto `plannable` con sus datos, `html_url` y `submissions` con el
estado de entrega. Admite `context_codes[]` para limitarlo a unas asignaturas y `filter`
con `new_activity`, `incomplete_items` o `complete_items`.

Con **una sola llamada** se llena el calendario entero.

### Las asignaturas

```
GET /courses?enrollment_state=active&include[]=term
```

Las del curso en marcha. De aquí saldría el catálogo que hoy está escrito a mano en
[`src/lib/data/curso.ts`](../../src/lib/data/curso.ts) — aunque el **color** seguiría
siendo decisión nuestra: Canvas no tiene ninguno que valga la pena.

### Las entregas de una asignatura

```
GET /courses/:course_id/assignments?include[]=submission&bucket=upcoming&order_by=due_at
```

`bucket` acepta `past`, `overdue`, `undated`, `ungraded`, `unsubmitted`, `upcoming` y
`future`; `order_by`, `position`, `name` o `due_at`. Con `include[]=submission` viene
además el estado de la entrega propia, que es lo que permitiría marcar una tarea como
hecha **sin preguntar**.

Campos útiles del objeto: `id`, `name`, `due_at`, `points_possible`, `html_url`,
`submission_types`, `course_id`.

### El calendario

```
GET /calendar_events?type=event&start_date=…&end_date=…&context_codes[]=course_123
```

Para lo que no es entrega: clases, tutorías, exámenes puestos por el profesor.

### Quién soy

```
GET /users/self
```

La prueba de vida del token y de dónde salen el nombre y el avatar.

## Paginación y límites

**Paginación por cabecera `Link`**, no por número de página:

```
Link: <https://canvas.ucam.edu/api/v1/courses?opaqueB>; rel="next",
      <…>; rel="current", <…>; rel="first", <…>; rel="last"
```

Tres reglas que la documentación insiste en dejar claras:

1. **Las URL son opacas.** Se siguen tal cual; no se reconstruyen a mano.
2. **El nombre de la cabecera no tiene mayúsculas garantizadas.** Se busca sin distinguir.
3. `per_page` sube el tamaño de página (por defecto 10). No hay máximo documentado, pero
   Canvas suele cortar en 100.

**Límite de uso:** cubo con fugas por token. Empieza en 700 y cada petición descuenta su
`x-request-cost`; se rellena solo con el tiempo. Una sincronización razonable —planificador
más asignaturas, una vez cada pocos minutos— no se acerca ni de lejos. Lo que sí lo agota
es pedir las entregas asignatura por asignatura en un bucle sin freno.

## Seguridad: el token es la cuenta entera

Esto no es una advertencia de manual, es la razón por la que este documento existe antes
que el código.

Un token personal de Canvas **puede hacer todo lo que puede hacer Celeste**: leer sus
notas, sus mensajes, entregar trabajos y borrarlos. No hay permisos parciales. Por lo
tanto:

- **Nunca viaja al navegador.** Ni en el HTML, ni en una variable `NEXT_PUBLIC_`, ni en
  localStorage. Vive en el servidor y punto.
- **Nunca entra en el repositorio.** `.env.local` está en `.gitignore` y ahí se queda.
- **Se guarda lo mínimo.** Si Archicel llega a copiar entregas a Firestore, que copie
  título, fecha y asignatura. Notas y comentarios del profesor no le hacen falta para
  pintar un calendario, y lo que no se guarda no se puede filtrar.
- **Se revoca desde Canvas** en un clic, sin tocar Archicel, si algo se tuerce.

No es paranoia abstracta: la propia UCAM
[anunció](https://www.ucam.edu/noticias/incidente-seguridad-canvas-proveedor-universidad)
un incidente de seguridad de Instructure que afectó a datos de la cuenta institucional. La
regla que se deduce es la de siempre — guardar poco.

---

# El motor, ya construido

Las piezas están escritas y probadas. Lo único que falta es el token.

## Cómo se enciende

En `.env.local` (que está en `.gitignore` — comprobado con `git check-ignore`):

```
CANVAS_URL=https://canvas.ucam.edu
CANVAS_TOKEN=xxxxx~xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CANVAS_ZONA=Europe/Madrid
```

**Ninguna lleva el prefijo `NEXT_PUBLIC_`, y eso no es un descuido.** Con ese prefijo, Next
incrustaría el token en el JavaScript que descarga el navegador y sería público para
siempre.

## Las piezas

| Fichero | Qué resuelve |
|---|---|
| [config.ts](../../src/lib/canvas/config.ts) | De dónde salen las llaves. Solo servidor |
| [cliente.ts](../../src/lib/canvas/cliente.ts) | El motor HTTP: plazos, reintentos, cuota, paginación, errores con nombre |
| [tipos.ts](../../src/lib/canvas/tipos.ts) | Lo que Canvas devuelve, recortado a lo que se usa |
| [traductor.ts](../../src/lib/canvas/traductor.ts) | De Canvas al modelo de la casa |
| [servicio.ts](../../src/lib/canvas/servicio.ts) | Caché, vuelo único, tandas |
| [route.ts](../../src/app/api/canvas/route.ts) | La única puerta. El token no la cruza |
| [useCanvas.ts](../../src/hooks/useCanvas.ts) | Lo que ve una pantalla |

`server-only` está instalado: si alguien importa el cliente desde un componente de
navegador, **la compilación falla** en vez de filtrar el token en silencio.

## Lo que hace el cliente, y por qué

- **Plazo de 15 s.** Una petición sin plazo no falla: se queda colgada, y con ella la
  pantalla que la espera.
- **Tres intentos con espera creciente y desordenada** (400, 800, 1600 ms ±250). El
  desorden importa: si varias peticiones fallan a la vez y todas reintentan en el mismo
  milisegundo, vuelven a tumbarlo.
- **Un 401 no se reintenta.** Un token que no vale no va a valer dentro de 400 ms.
- **Un 403 se mira por dentro.** Canvas lo usa para dos cosas distintas: «no tienes
  permiso» y «te has pasado de cuota». Solo se distinguen por el cuerpo, y confundirlas
  haría que la aplicación pidiera un token nuevo por algo que se arregla esperando.
- **Suelo de cuota.** Por debajo de 60 deja de pedir en vez de esperar a que Canvas cierre
  la puerta. Quedarse sin cuota no es un error que se pueda reintentar.
- **Los enlaces de paginación se comprueban.** Vienen del propio Canvas, pero se verifica
  que sigan siendo de su dominio: es lo único que impide que una respuesta manipulada
  mande el token a otro sitio.
- **Tope de 25 páginas.** Un bucle de paginación desbocado es una factura, no un fallo
  visible.

## Lo que hace el servicio

- **Caché con caducidad**: asignaturas 30 min, planificador 5 min.
- **Vuelo único**: tres peticiones simultáneas con la caché vacía producen **una** llamada,
  no tres.
- **Tandas de tres** al pedir entregas por asignatura.
- **Reserva**: si el planificador viene vacío pero hay asignaturas, prueba la vía cara
  antes de decir que no hay nada. Un escritorio vacío por una integración a medias es peor
  que una llamada de más.
- **Nunca lanza.** Devuelve un `estado` con nombre y una lista vacía. Un fallo del campus
  no puede tumbar el escritorio; esa es la diferencia entre una integración y una
  dependencia.

## La regla del traductor

**Todo lo de Canvas se convierte en `Evento`, nunca en `Tarea`.** Una tarea de Archicel
ocupa una franja que elige Celeste; una entrega de Canvas es un vencimiento que no elige
nadie. Traerla como tarea le inventaría una franja de trabajo que la universidad no ha
pedido. Canvas aporta el qué y el cuándo vence; la franja sigue siendo suya.

Las fechas se parten **en la zona del campus**, no en la del servidor. Canvas devuelve UTC:
una entrega de las 23:59 de Madrid llega como `21:59Z` en verano, y en invierno una de las
00:30 llegaría como las `23:30Z` **del día anterior**. Con la zona del servidor se acierta
por casualidad y se falla en octubre, que es cuando empieza el curso.

## Comprobado

| Prueba | Resultado |
|---|---|
| Sin token | `estado: sin-configurar`, sin eventos, sin error |
| Token inválido contra `canvas.ucam.edu` | `estado: credencial`, `cuota: 700` leída de la cabecera real, respuesta en **161 ms** — es decir, no malgastó reintentos en un 401 |
| `.env.local` fuera de git | `git check-ignore` lo confirma |
| Compilación | La ruta aparece como dinámica (`ƒ /api/canvas`) |

Lo que **no** está probado es la vía feliz: hace falta un token válido.

## Cuidado con los tokens

Un token personal de Canvas **puede hacer todo lo que puede hacer su dueña**: leer notas y
mensajes, entregar trabajos y borrarlos. No hay permisos parciales.

- No se pega en un chat, ni en un correo, ni en una captura. Si pasa, se **regenera**
  desde Canvas: el anterior muere en el acto.
- No sale del servidor. No entra en el repositorio.
- Se revoca desde Canvas en un clic, sin tocar Archicel.
- **Caduca.** Cuando lo haga, Archicel dirá `credencial` y habrá que generar otro.

## Qué queda por hacer en Archicel

Por orden, y ninguno de estos pasos está dado todavía:

1. **Que Celeste genere su token** y comprobar que la UCAM no lo tiene desactivado. Sin
   esto, lo demás es teoría.
2. **Un `route handler`** en `src/app/api/canvas/[...]` que guarde el token en el entorno
   del servidor y llame a `/planner/items`. Es la primera pieza de servidor del proyecto.
3. **Un traductor** de Canvas al modelo de la casa: `PlannerItem` → `Evento`/`Tarea` de
   [`tipos.ts`](../../src/lib/data/tipos.ts), resolviendo la asignatura contra
   `curso.ts` para heredar su color.
4. **Una regla de convivencia**: lo que venga de Canvas no se puede editar en Archicel, o
   se edita y deja de coincidir. Lo más honesto es marcarlo como «viene del campus», dejar
   que se le añada una nota propia, y que la fecha y el título los mande Canvas.
5. **Sincronización perezosa**: al abrir el escritorio y como mucho cada quince minutos.
   Canvas no es una fuente en tiempo real y tratarla como tal solo gasta cuota.

## Qué devuelve de verdad — probado con la cuenta de Celeste

Esta era **la pregunta que decidía si la integración merecía la pena**. Ya está contestada,
y la respuesta es incómoda.

| Qué | Cuánto |
|---|---|
| Asignaturas activas | **12** (las seis del grado en I y II, más «Secretaría») |
| Elementos del planificador | **5**, y los cinco son `announcement` |
| Entregas publicadas en total | **21** |
| Entregas **con fecha de vencimiento** | **2**, las dos de Matemáticas Aplicadas I |

Es decir: **hoy Canvas le da a Archicel dos fechas.** El motor funciona; los datos no
están.

Dos consecuencias que salieron de verlo con datos reales y que ya están en el código:

- **Los anuncios no son vencimientos.** Los cinco elementos del planificador eran el acto
  de acogida, un viaje a Lisboa y el horario del curso. Colocarlos en el calendario por su
  fecha de publicación llenaba el escritorio de cosas que no hay que hacer, y encima las
  marcaba como entregas. `dePlan` ahora descarta todo `plannable_type` que no sea una
  fecha de verdad.
- **`bucket=upcoming` no servía.** Ese filtro solo devuelve lo que tiene fecha, y aquí casi
  nada la tiene: con el filtro puesto la vía de reserva devolvía cero y parecía que Canvas
  estaba vacío. Se piden todas y se queda lo fechado.

### Los nombres de la UCAM

Las asignaturas llegan así:

```
Matemáticas Aplic I-G FUND ARQUIT - MU - PRE - CAST-Edición-0
```

Detrás del primer guion va la coleta administrativa, idéntica en las doce. Se corta por ahí
—los nombres de asignatura de este grado no llevan guiones, así que es exacto— y luego se
casa con el catálogo de `curso.ts` comparando **palabra a palabra, aceptando abreviaturas
por dentro**: la UCAM escribe «Arquitc» por «Arquitectónico» y «Descrip» por «Descriptiva»,
y una comparación por prefijo no las encuentra.

**El numeral romano tiene que coincidir exacto.** Es lo que impide que «Matemáticas Aplic
II», de otro cuatrimestre, herede el color de «Matemáticas Aplicadas I». Comprobado:
«Matemáticas Aplic I» resuelve a **Matemáticas** y hereda su azul; «Matemáticas Aplic II»
se queda con su nombre limpio y sin color de catálogo, que es lo correcto.

### Rendimiento medido

| Llamada | Tiempo |
|---|---|
| En frío (12 asignaturas, una petición cada una) | **1,67 s** |
| De caché | **3 ms** |

La vía de reserva también va por caché. Sin eso, cada visita al escritorio costaba doce
peticiones y segundo y medio aunque el planificador ya viniera de memoria — medido: 1,6 s
en la primera llamada y 1,6 s en la segunda, hasta que se arregló.

### Qué hacer con esto

Antes de conectar nada a una pantalla, merece la pena que Celeste mire si sus profesores
**ponen fecha** a las entregas en Canvas. Si el curso sigue así, esta integración aporta dos
líneas al calendario y no justifica ocupar sitio en el escritorio. Si empiezan a fecharlas
—que es lo normal según avanza el cuatrimestre—, el motor ya está y no hay que tocar nada.

## Lo que quedó comprobado por el camino

- El botón de **crear token personal** sí está habilitado para estudiantes en la UCAM.
- Los tokens **caducan**: el primero se emitió con vencimiento a tres meses. Cuando expire,
  Archicel dirá `credencial` y habrá que generar otro. Está contemplado.
- El planificador **no trae trabajo, trae tablón**. Los profesores publican entregas, pero
  casi ninguna con fecha. Ese es hoy el techo de la integración, y no es técnico.

---

Fuentes: [Campus Virtual de la UCAM](https://www.ucam.edu/servicios/cv) ·
[Paginación de la API de Canvas](https://canvas.instructure.com/doc/api/file.pagination.html) ·
[Assignments](https://canvas.instructure.com/doc/api/assignments.html) ·
[Planner](https://canvas.instructure.com/doc/api/planner.html)
