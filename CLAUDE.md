# Archicel's

App web personal. Hay un prototipo visual completo publicado como artifact; el proyecto Next.js aun no esta creado.

## Producto

- **Qué es:** un panel de estudio para una estudiante de arquitectura. Hoy usa Notion; esto es lo
  contrario de Notion — pocas pantallas muy compuestas, donde un proyecto de taller se presenta
  como una página de revista y no como una fila de base de datos.
- **Para quién:** Celeste, estudiante de arquitectura. Es la única usuaria; Cristian es el autor.
  La app se llama Archicel; la usuaria es Celeste. En el prototipo el nombre sale de una sola
  constante (`USUARIA`), nunca escrito a mano por la interfaz.
- **Qué tiene que conseguir:** que le apetezca abrirlo. El diseño y la animación no son el envoltorio,
  son el producto: es lo que ella más valora.
- **Dispositivo principal: escritorio.** Lo confirmó Cristian. Se diseña y se **verifica en
  escritorio**; el móvil no se comprueba ni condiciona una decisión de composición. Las reglas
  responsive que ya hay se quedan —no estorban— pero nada nuevo se frena por ellas.
- **Contenido dominante:** proyectos de taller, entregas con fecha, referencias visuales y datos de
  arquitectura (escalas, superficies, horas).
- **Prototipo visual aprobado como dirección:** escritorio a pantalla completa sobre una fotografía de
  una casa a la hora azul, con shader WebGL, widgets animados y modo edición con rejilla. Publicado
  como artifact en esta conversación.

Lo que sigue pendiente de Cristian: qué mira ella exactamente un lunes antes de una entrega, y si la
app se usa sobre todo en móvil o en portátil.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS v4
- **shadcn/ui** (base Radix) para los controles. Sus tokens (`--primary`, `--border`, `--ring`…)
  **apuntan** a los de Archicel en `src/app/globals.css`; nunca llevan un color literal. Un control
  nuevo se trae con `npx shadcn@latest add <componente>` antes que escribirlo a mano.
- Verificación en navegador con `@playwright/cli`

## Cómo se trabaja aquí

1. **El contrato visual manda.** `docs/design/DESIGN.md` es la fuente de verdad del aspecto del
   producto. Si aún no existe, lo primero es crearlo con la skill `awesome-design`.
2. **Nada se da por hecho sin abrirlo en un navegador.** Si no se abrió con `playwright-cli`, se dice
   que no está verificado.
3. **El español es el idioma del producto y de la documentación.** El código (nombres de variables,
   componentes, commits) en inglés.
4. **Esto es un regalo, no un SaaS.** Ante la duda entre lo impresionante y lo que emociona, gana lo
   segundo. Pero la ejecución técnica no se relaja por eso.

## Skills de frontend instaladas

Este proyecto tiene cinco skills en `.claude/skills/`. **Están disponibles y hay que usarlas** — no
son opcionales ni decorativas. La guía completa, con disparadores y anti-disparadores de cada una,
está en [docs/frontend/SKILLS.md](docs/frontend/SKILLS.md). Resumen operativo:

| Skill | Cuándo dispararla |
|---|---|
| `awesome-design` | Antes de la primera pantalla y cuando haya que fijar o revisar la dirección visual. Produce `docs/design/DESIGN.md` a partir de 74 sistemas de diseño reales. |
| `impeccable` | Al diseñar, auditar, pulir o animar **UI de producto**: pantallas, componentes, formularios, onboarding, estados vacíos y de error. Invocable con subcomandos (`audit`, `polish`, `animate`, `bolder`, `quieter`, `harden`, `live`...). |
| `design-taste-frontend` | Al construir **landing, portfolio o secciones narrativas**, o al rediseñar algo que sabe a plantilla. No para dashboards ni tablas. |
| `playwright-cli` | Al terminar cualquier cambio visible, y en cualquier flujo multi-paso o con login. Hoy se invoca con `npx @playwright/cli@latest ...` |
| `img2threejs` | Solo si el brief pide una pieza 3D concreta a partir de una imagen de referencia. Es la más cara: confirmar antes de lanzarla. |

Reglas de convivencia:

- `impeccable` y `design-taste-frontend` se solapan. Elige una **antes** de empezar según la pieza
  (producto → `impeccable`; landing/narrativa → `design-taste-frontend`) y dilo explícitamente. Nunca
  las dos sobre el mismo fichero en la misma pasada.
- Si una skill quiere salirse de `docs/design/DESIGN.md`, primero se actualiza el DESIGN.md
  explicando por qué.
- Si hace falta una skill que no está instalada, se pide y se instala. No se improvisa su contenido.

## Graft — la capa de contexto del código

[Graft](https://github.com/trailhq/Graft) (`@nanonets/graft`, MIT) construye un **grafo del código**
en `graft/`: nodos markdown que explican cada parte en prosa y apuntan al `file:line` exacto, más un
grafo de quién-llama-a-qué. Consultar un nodo cuesta unos cientos de tokens; reconstruir ese
entendimiento leyendo ficheros cuesta miles y además pierde las aristas.

Traducido a esta casa: **Graft es cómo se navega el código; las skills de frontend son cómo se
diseña.** No compiten, se usan en fases distintas de la misma tarea.

### Estado: instalado

Graft 0.19.0, instalado de forma global (`npm install -g @nanonets/graft`) y cableado solo para
Claude Code con `graft init --agents claude --no-global`. Dos decisiones de Cristian:

- **Telemetría desactivada**, con `graft telemetry disable`. Se guarda en la máquina, no en el repo;
  `graft telemetry status` tiene que decir `off — you disabled it`. En una máquina nueva hay que
  repetirlo.
- **Sin `--deep`.** Solo el grafo estructural: gratis, sin clave y sin red. `--deep` escribe
  resúmenes con un LLM y consume clave de API de pago; no se lanza.

Lo que está versionado es el cableado, no el grafo: `.claude/settings.json` (statusline y hooks),
`.claude/helpers/graft-*.cjs`, `.claude/skills/graft/SKILL.md` (el manual del propio Graft — **ahí
está el detalle fino, no hay que duplicarlo aquí**), `.mcp.json` y `.ignore`. Todo eso es de Graft:
lo reescribe al actualizarse, así que no se edita a mano. `graft/` es caché local regenerable, como
`node_modules`, y va en `.gitignore` **anclado** (`/graft/`): sin la barra delante también ignoraba
`.claude/skills/graft/` y la skill no llegaba al repositorio.

**Hay que reiniciar Claude Code** después de instalarlo para que cargue el MCP.

### Graft y los worktrees

Cada sesión de AO trabaja en su propio worktree. Nada de lo commiteado lleva la ruta de un worktree:
los hooks se resuelven con `${CLAUDE_PROJECT_DIR}` y el MCP arranca con `npx -y @nanonets/graft mcp`,
que reutiliza la instalación global sin descargar nada. Lo que sí es de esta máquina es la ruta de
Node dentro de `.claude/helpers/*.cjs`, y esos ficheros tienen su propio plan B si no la encuentran.

Tres cosas que no se deducen:

- **Un worktree nuevo, sin preparar, escribe fuera del repo.** Graft recuerda `--no-global` en un sello
  dentro de `graft/`, que no se versiona; sin sello, la primera sesión re-cablea con los valores por
  defecto y mete sus hooks y su MCP en `~/.claude/settings.json` y `~/.claude.json`, **en todos los
  proyectos**. Comprobado en un worktree de prueba. Lo evita esto, antes de abrir la primera sesión:

  ```bash
  graft init --agents claude --no-global --no-build
  ```

  Deja el sello con `global: false` y reescribe los ficheros del repo idénticos, así que no ensucia
  el árbol. Es el `post-create` que tiene que llevar el proyecto en AO.
- **El primer `graft map` o `graft grep` de un worktree construye su grafo**, unos segundos. Cada
  worktree tiene el suyo y nunca se comparte: el código de dos ramas no es el mismo.
- **En Windows no compila `tree-sitter-kotlin`**: no trae binario precompilado y aquí no hay Python ni
  compilador de C++. En esta máquina su `bindings/node/index.js` (dentro de la instalación global) es
  un sustituto vacío, con el original al lado como `index.js.orig`. Graft solo lo usa al leer un
  `.kt` y Archicel no tiene ninguno. **Un `npm install -g` o `graft upgrade` lo deshace**: se vuelve a
  instalar con `--ignore-scripts` y se repone el sustituto, o `graft` no arranca.

### Cómo se usa durante el trabajo

Todos los comandos son gratis, sin clave, y responden en menos de un segundo. **Normalmente basta con
una llamada**: se elige la que encaja, se actúa sobre la respuesta y no se encadenan herramientas a
ver si sale algo mejor.

| Situación | Comando |
|---|---|
| Aterrizar en el repo / "explícame la arquitectura" | `graft map` |
| Entender un flujo ("cómo funciona X") o no saber dónde vive algo | `graft ask "<pregunta>" --source` |
| Ya sabes el símbolo y quieres editarlo | `graft grep "<símbolo>"` |
| Saber qué hay dentro de un fichero antes de tocarlo | `graft skeleton <fichero>` |
| Renombrar, borrar o cambiar una firma | `graft callers <símbolo> --depth 2` |
| Refactor que cruza varios ficheros | `graft callers <símbolo> --depth all` |
| Medir el riesgo de un cambio ya hecho | `graft blast` |

Reglas:

- **Graft antes que `grep`, `find` o abrir ficheros a ciegas.** Ese es el punto de tenerlo.
- **No hay que ejecutar `graft build` después de editar.** Las consultas refrescan el grafo solas,
  incluyendo cambios sin commitear.
- **Nunca pipear un comando de graft por `head`, `tail` o `sed -n`.** La salida ya viene capada y el
  recorte se come resultados y la línea de tokens ahorrados.
- Si un `grep` no encuentra nada, **afloja el patrón** (nombre pelado, sin firma) y reintenta con
  graft; no te pases a `grep -rn`.
- Al cerrar un turno en el que se usó graft, reporta el ahorro: `🌱 graft saved ~N tokens (M calls)`.

### Después: qué no espera de Graft

- **No indexa CSS ni markdown.** `docs/design/DESIGN.md` y `app/globals.css` se leen directamente;
  el contrato visual no vive en el grafo.
- **No sustituye a `playwright-cli`.** Graft dice cómo es el código; solo el navegador dice cómo se ve.
- **No sustituye al criterio de diseño.** Sirve para llegar rápido al fichero correcto, no para
  decidir qué poner en él.
- Antes de dar por cerrado un cambio que toca varios ficheros: `graft blast` para ver qué alcanza, y
  después la verificación visual de siempre.
- Si algo se tuerce, `graft uninstall` revierte exactamente lo que `init` escribió.

Referencia completa de comandos, flags y solución de problemas: [docs/tooling/GRAFT.md](docs/tooling/GRAFT.md).

## Arquitectura y seguridad

Antes de tocar nada estructural, dos documentos:

- [docs/arquitectura/ARQUITECTURA.md](docs/arquitectura/ARQUITECTURA.md) — las capas, los
  cuatro puntos donde se extiende sin tocar el resto, cómo añadir una entidad nueva y qué
  rendimiento está medido (en producción, no en desarrollo).
- [docs/data/SEGURIDAD.md](docs/data/SEGURIDAD.md) — la revisión de seguridad, qué protege
  cada capa y por qué no se cifra el contenido extremo a extremo.

Tres reglas que salieron de esa revisión y que no se saltan:

1. **Ningún dato de la usuaria se convierte en HTML.** Nada de `dangerouslySetInnerHTML`
   con títulos, notas o asignaturas: una tarea llamada `<img onerror=…>` se ejecutaba.
2. **Al añadir una colección, su nombre va en `estaValidada` de `firestore.rules`.** Los
   `match` de Firestore se suman, no se encadenan: el comodín del final dejaría entrar
   cualquier cosa saltándose la validación de forma.
3. **Lo que dependa del reloj pasa por `useAhora`.** La aplicación se prerrenderiza y el
   servidor no sabe la hora de la usuaria; sin eso, el texto cambia solo al hidratar.

## Datos: Firebase

La base de datos del proyecto es **Firestore**. El modelo, las reglas, los índices y los pasos de
la consola están en [docs/data/FIRESTORE.md](docs/data/FIRESTORE.md), y las reglas listas para
publicar en [firestore.rules](firestore.rules).

Dos cosas que no hay que olvidar:

- **La interfaz no habla con Firestore.** Todo pasa por una capa de almacén con cuatro verbos
  (listar, guardar, borrar, escuchar). Hoy esa capa escribe en el navegador; mañana en la nube.
  Cambiar de una a otra es una línea y ninguna pantalla se entera.
- **La clave de la app web es pública** y va en el cliente: lo que protege los datos son las
  reglas. Lo que nunca se comparte ni se sube al repositorio es el JSON de cuenta de servicio.
- **Guardar en Firestore es con `merge`, y un opcional que falta se borra.** Cada colección de
  `almacen-firestore.ts` nombra sus campos opcionales; el que no llega —o llega `undefined`— se
  manda como `deleteField()`. Sin eso, mover un apunte a la raíz lo dejaba en la nube dentro de
  la carpeta de antes, y un `undefined` hacía que Firestore rechazara la escritura entera. **Un
  campo opcional nuevo en `tipos.ts` va también a esa lista**, y `guardar` recibe siempre el
  documento completo, nunca un trozo.
- **La cuenta es una invitación, no un muro.** Archicel abre y funciona sin sesión; entrar solo
  hace que todo la siga a otro dispositivo, y lo guardado sin cuenta sube solo al entrar,
  apuntes y carpetas incluidos. **La migración lleva una marca por colección**: una colección
  nueva que deba sobrevivir a entrar se añade a `PASOS` en `src/lib/data/index.ts` y llega
  también a quien ya había migrado. El acceso, las dos vías (Google y correo), la migración y
  qué hay que activar en la consola están en [docs/data/CUENTAS.md](docs/data/CUENTAS.md).

## El movimiento

La animación la lleva **Motion 13** (lo que antes se llamaba Framer Motion), y el vocabulario entero
—muelles, curvas, tiempos y variantes— vive en un solo fichero: `src/lib/ui/movimiento.ts`. Un
componente elige **cuál** usa, nunca **cuánto dura**. Sin eso, cada pantalla inventa sus propios
números y la interfaz deja de ir a compás sin que nadie sepa decir por qué.

Cuatro reglas que cuestan una tarde cada una si se descubren a mano:

1. **Una propiedad la controla Motion o la controla el CSS, nunca las dos.** Al pasar algo a Motion
   se **borra** la regla de CSS: una `animation` gana sobre el estilo en línea que Motion escribe, y
   el elemento se queda clavado en el último fotograma. Si un `:hover` lo levantaba dos píxeles, ese
   `:hover` se convierte en `whileHover`.
2. **`filter` en un ancestro rompe `position:fixed` dentro.** Por eso la transición de página no
   lleva desenfoque: envuelve la barra del editor y las hojas modales.
3. **El indicador que viaja se hace con `layoutId`**, no midiendo posiciones — el agua del dock y la
   píldora del calendario.
4. **Menos movimiento se declara una sola vez**, en `MotionConfig reducedMotion="user"`. No se
   repite en el `@media` del CSS.

**El cambio de página tiene dirección, y la dirección la manda el dock.** Si la sección nueva está
a la derecha en el dock, la página viaja a la derecha, igual que el agua del indicador; si es el
detalle de la que se deja —`/dia` dentro de `/calendario`— se entra con escala en vez de cruzar. El
orden vive en `ORDEN` dentro de `movimiento.ts`: **si el dock se reordena, esa lista va con él**.

Y el reparto: el envoltorio de página solo **viaja**, y lo que aparece es el contenido pieza a pieza.
Las páginas no declaran `initial` ni `animate` — heredan el estado del envoltorio por el árbol de
Motion. Añadir una parte a una pantalla es escribir `variants={PIEZA}` y nada más.

Se importa `* as m from 'motion/react-m'` y no `motion`; `LazyMotion strict` hace que confundirlos
sea un error y no una regresión silenciosa. Consecuencia práctica: en un fichero que importa `m`, no
puede haber una variable local llamada `m`.

**Las funciones de Motion se cargan con la aplicación, no en diferido**, y eso no es negociable: en
diferido hay una ventana en la que `m.div` pinta pero no anima, y todo lo que se anime al montarse
cae dentro de ella en la primera carga. Costó el escritorio en blanco al entrar.

Dos trampas más, las dos con el mismo síntoma —una pantalla que no se anima— y ninguna visible
leyendo el código:

- **`initial={false}` en un `AnimatePresence` se propaga a todo lo que lleva dentro** y anula la
  animación de montaje de cada descendiente, no solo la del hijo directo.
- **El App Router mete la página nueva dentro del envoltorio que está saliendo**, así que el mismo
  contenido se anima dos veces. Lo arregla `RutaCongelada`.

**Una animación de entrada nunca debe ser lo que decide si algo se ve.** Si falla, lo que se pierde
tiene que ser el movimiento, no el contenido.

**Esto se verifica con Playwright contra `npm run build && npm start`, no con el panel del navegador**:
con el panel oculto no hay fotogramas y no se distingue una animación que no corre de una rota.

El detalle, con la tabla de variantes y qué sigue en CSS a propósito, está en
[docs/frontend/MOVIMIENTO.md](docs/frontend/MOVIMIENTO.md). Léelo antes de animar nada.

## Arquitectura del escritorio

El panel se construye con un **registro de widgets** sobre una rejilla de 12 columnas, un **layout**
con las posiciones del usuario y un **motor** que los coloca, los deja arrastrar y guarda el
resultado. Añadir un widget nuevo toca **solo el registro**: aparece en pantalla, el editor lo sabe
mover y entra en el diseño ya guardado sin descolocar el resto.

Todo está explicado en [docs/frontend/WIDGETS.md](docs/frontend/WIDGETS.md): la rejilla, los campos
de cada widget, cómo añadir uno (con ejemplo), colisiones y compactación, la migración del layout al
cambiar el catálogo, el responsive por contenedor, el modo edición y qué cambia al pasar a Next.js.

Antes de tocar el escritorio, léelo. Antes de añadir un widget, léelo también: hay cinco reglas que
no se deducen mirando el código.

## Se instala como un programa

Archicel es una aplicación instalable: icono propio, ventana sin barra de direcciones y
arranque sin red. Son tres ficheros —`src/app/manifest.ts`, `public/sw.js` y
`src/components/Instalable.tsx`— y no condicionan cómo se programa el resto.

Tres cosas que ahorran un rato de desconcierto:

- **El botón de instalar no sale en `npm run dev`.** El service worker se registra solo en
  producción, porque en desarrollo sirve copias viejas. Para probarlo: `npm run build && npm start`.
- **El service worker no toca nada de fuera del dominio.** Firestore y el login pasan de
  largo. Al cambiar su estrategia hay que subir `VERSION` dentro de `sw.js`.
- **Los iconos no se editan a mano.** Se edita `public/icono.svg` y se lanza `npm run iconos`.

El detalle está en [docs/frontend/INSTALACION.md](docs/frontend/INSTALACION.md).

## Canvas: el campus virtual

Archicel lee del campus de la UCAM, que es **Canvas LMS**. El motor está en `src/lib/canvas/`,
conectado y probado contra el campus real con la cuenta de Celeste.

**Estado hoy: no está enchufado a ninguna pantalla, y es a propósito.** Canvas devuelve
doce asignaturas pero solo **dos fechas** — sus profesores publican entregas sin fecha de
vencimiento y el planificador solo lleva anuncios. El motor funciona; los datos no están.
Dos líneas de calendario no justifican un hueco en el escritorio, y un widget casi vacío se
lee como una aplicación rota, no como una universidad que no pone fechas. Cuando empiecen a
fecharlas no hay que tocar nada: solo decidir dónde se pintan.

Cinco cosas que no se deducen del código:

- **Canvas no admite llamadas desde el navegador** —comprobado: el prevuelo CORS devuelve
  404 sin cabeceras—, así que todo pasa por `/api/canvas`. Es la única pieza de servidor
  del proyecto y la razón de que exista.
- **El token es la cuenta entera** de Celeste: notas, mensajes, entregas. Sin prefijo
  `NEXT_PUBLIC_`, nunca en el cliente, nunca en el repositorio. `server-only` hace que
  importarlo desde un componente de navegador **rompa la compilación** en vez de filtrarlo.
- **Lo de Canvas se convierte en `Evento`, jamás en `Tarea`.** Una tarea ocupa una franja
  que elige ella; una entrega es un vencimiento que no elige nadie.
- **Un anuncio no es un vencimiento.** El planificador los mezcla; `dePlan` los descarta.
  Sin ese filtro, el escritorio se llenaba de tablón marcado como entregas.
- **El token caduca** (el actual, el 19 de diciembre de 2026). Ese día la aplicación dirá
  `credencial`, que es lo que tiene que decir.

Todo el detalle —endpoints, paginación, cuota, caché y qué está comprobado y qué no— en
[docs/integraciones/CANVAS.md](docs/integraciones/CANVAS.md).

## Apuntes: Google Drive

Cada asignatura tiene su página, y en ella los apuntes de Celeste —fotos, PDFs, `.docx`—.
Los bytes van a **Google Drive**; Firestore guarda solo la ficha. El planteamiento entero, con los
pasos de la consola, está en [docs/integraciones/DRIVE.md](docs/integraciones/DRIVE.md).

**Estado: funcionando.** Subida, visor, borrado, **carpetas, renombrar y mover** contra Drive real.
Lo que falta o está a medias —con fichero y línea— está en el § 10 de DRIVE.md; lo más serio: borrar
se traga los fallos de Drive, y la tira presenta cualquier `sin-permiso` como sesión caducada.

La ruta en Drive es `Archicel/Asignaturas/<nombre de la asignatura>`, y dentro el árbol que la
usuaria haya montado. Se llamó `Apuntes` y **la aplicación renombra la vieja** la primera vez que
la encuentra: crear la nueva sin más habría dejado el trabajo repartido en dos carpetas sin que
nada explicara por qué.

**`NEXT_PUBLIC_GOOGLE_CLIENT_ID` va también en las variables de Vercel**, o en producción la
aplicación ni siquiera ofrece conectar: sin ID no tiene con qué pedirlo, la cabecera dice «Sin
conectar», no aparece el botón de Conectar Drive y «Subir» y «Carpeta» quedan deshabilitados. No se
pierde nada —ya no hay caída al disco—, pero tampoco se puede guardar ningún apunte.

Vercel marca esa variable como si fuera una credencial por llevar el prefijo `NEXT_PUBLIC_`. Se
resuelve con **«Change to Config»**, que es su etiqueta para «configuración pública»: un ID de
cliente de OAuth viaja en cada petición a Google y lo puede leer cualquiera: lo que lo protege es la
lista de orígenes autorizados de la consola, no el secreto. **Quitarle el prefijo lo rompe**, porque
es el navegador quien habla con Google.

Y hace falta **volver a desplegar** después de tocarla: las `NEXT_PUBLIC_` se hornean al construir,
no se leen al arrancar.

### Cada persona conecta su propio Drive

La conexión vive **en el navegador**, no en la cuenta de Archicel: quien pulsa «Conectar» elige la
cuenta de Google en esa ventana, y esa es la que recibe los ficheros desde ese navegador. Celeste
conecta el suyo, Cristian el suyo.

De ahí que la cabecera diga **de quién** es el Drive y no solo «En tu Drive»: con dos cuentas de
Google abiertas a la vez —lo normal— es fácil conceder con la que no era y no enterarse hasta que
los apuntes no aparecen donde deberían. El correo sale de `drive/v3/about`, que funciona con
`drive.file` sin pedir ningún permiso extra.

**Se ve y se suelta en Ajustes** (`/ajustes`, desde el menú del avatar): con qué cuenta está
conectado y **Desconectar Drive**, que pide confirmación, revoca el permiso en Google, olvida el
token y el correo, y deja la pantalla en «Sin conectar» sin recargar. **No
borra nada** de Drive ni de Archicel. Si el token ya había caducado, Google no puede confirmar la
revocación y la pantalla lo dice, con el enlace para retirarla desde la cuenta de Google. Los
avisos de conectar/desconectar viajan con `alCambiarDrive`, también entre pestañas. Detalle en
DRIVE.md § 6.

**La consecuencia si algún día comparten cuenta de Archicel:** las fichas viajan por Firestore y los
ficheros no. Uno vería en la lista un apunte del otro y al abrirlo saldría «ese apunte ya no está en
tu Drive», porque con `drive.file` un token solo alcanza lo que la app creó bajo **su**
autorización. No rompe nada —el fallo tiene nombre y la pantalla lo dice— pero es un apunte
fantasma.

### Sin secreto de cliente, y lo que eso cuesta

Se puede montar de dos maneras y se eligió a conciencia:

- **Con secreto**, en una ruta de servidor, Google entrega un `refresh_token` y la conexión es
  permanente de verdad. A cambio hay que mantener un secreto en el entorno.
- **Sin secreto**, que es lo que hay, Google **no entrega refresco** — no es una opción que se esté
  evitando, es que no existe para un cliente web. Lo que se hace es **recordar el token de acceso**
  en `localStorage`, que dura una hora.

Se eligió lo segundo porque Archicel es de una persona y no debe pedirle que mantenga credenciales
a mano. El precio está medido: **dentro de la hora, recargar no pide nada** (comprobado: conectar
una vez y recargar tres veces pregunta a Google **una sola vez**); pasada la hora, **con la pestaña
abierta**, la siguiente acción lo renueva sola, porque subir y arrastrar nacen de un gesto y desde
ahí Google deja abrir su ventana — y si ya se concedió, se abre y se cierra sin enseñar nada.

Lo que no renueva solo es **recargar pasada la hora**: el token recordado ya no vale, la pantalla
vuelve a «Sin conectar» con «Subir» y «Carpeta» deshabilitados, y hay que pulsar **Conectar Drive**
(comprobado en el navegador con un token caducado). Con el consentimiento dado es un clic y una
ventana que se cierra sola, pero es un clic.

Guardar el token es aceptable **por el mismo motivo por el que puede vivir en el navegador**: con
`drive.file` no abre nada salvo lo que esta aplicación creó.

### Siempre Drive, nunca el disco

Una subida acaba en Drive o **falla**. Hubo una caída al almacenamiento del navegador y se quitó a
conciencia: un apunte en el portátil no está en ningún sitio útil —no viaja a otro dispositivo y el
navegador puede tirarlo cuando le falte espacio— y sobre todo **parece guardado**. Media carrera de
apuntes en un almacén que se borra solo es peor final que una subida que se niega a ocurrir.

El archivador local sigue existiendo, pero **solo para abrir y borrar** lo que se guardó ahí antes
de este cambio. Nada nuevo va a parar al disco.

De ahí que sin conectar la pantalla no ofrezca subir: «Subir» y «Carpeta» se deshabilitan y la
acción sólida pasa a ser **Conectar Drive**. Ofrecer un botón sabiendo que va a fallar es hacer
perder el tiempo a quien lo pulse.

### Qué pasa cuando pasa la hora

1. **Se renueva antes de nada.** `subir` pide el token en su **primera línea**, antes de buscar la
   carpeta. Renovar puede abrir una ventana de Google, y eso solo se permite mientras dura el
   permiso que deja un gesto —unos segundos desde el clic—; gastarlo en dos peticiones de red hacía
   que la ventana llegara tarde y la bloquearan. Con el consentimiento ya dado no se ve nada.
2. **Si aun así no se puede, se dice y no se guarda en otro sitio.** Sale una tira con el fichero,
   el motivo **y cómo se arregla** — que es la mitad que faltaba: saber que no queda espacio sin
   saber que hay que vaciar la papelera de Drive deja a quien lo lee igual de atascada. Cada causa
   tiene su salida y la pantalla es el único sitio donde cabe decirla. **Hoy la traducción se
   equivoca en dos casos** (comprobados con Drive simulado): cualquier `sin-permiso` —también una
   API deshabilitada— sale como «La sesión de Drive ha caducado» y el texto de Drive no llega a la
   tira; y un límite de peticiones sale como «No queda espacio». Detalle en DRIVE.md § 10.
3. **El fichero no se pierde de vista.** La tira guarda el `File`, así que reintentar es un botón y
   no volver a buscarlo en el disco. Un aviso que se va en tres segundos es el peor sitio posible
   para un fallo: de cinco ficheros arrastrados no dice cuál falló, ni por qué, ni deja repetirlo.

### Un icono por tipo de fichero

En `src/lib/archivo/iconos.tsx`. Doce clases —imagen, vídeo, audio, PDF, documento, hoja,
presentación, comprimido, **plano**, **modelo 3D**, código y texto— más el genérico.

Tres decisiones:

- **El color sale de la paleta de la casa**, de los mismos `--c-*` que usan las asignaturas, al
  15 % de relleno. El contrato visual prohíbe «un segundo color saturado» y una lista que inventa
  un acento por fila es exactamente eso; reutilizar los tokens existentes no mete **ni un tono
  nuevo** en el sistema, y el color de la asignatura sigue siendo el único saturado de la página.
- **Dos siluetas, no una.** Lo que es un documento se dibuja como una hoja con la esquina doblada;
  lo que no lo es tiene su propia forma. Trece hojas idénticas con un garabato distinto dentro
  obligan a leer el garabato; una silueta distinta se reconoce sin leer nada.
- **`.dwg` y `.skp` tienen icono propio** porque es lo que de verdad va a llegar a una escuela de
  arquitectura. Un `.exe` no: si llega, lo correcto es que se vea como lo que es.

El tipo se decide **por MIME primero y por extensión después**: el navegador manda el MIME vacío
más de lo que parece —`.heic`, `.dwg`, lo que venga de un disco de red— y entonces el nombre es lo
único que queda.

Cuatro cosas más que no se deducen y que cuestan una tarde cada una:

- **No existe un scope de Google «solo esta carpeta».** Se usa `drive.file`, que es más fuerte: la
  app solo ve **lo que ella misma creó**. La carpeta `Archicel` es una comodidad para el humano, no
  la frontera de seguridad.
- **Una cuenta de servicio no sirve.** No tienen cuota propia y no pueden poseer ficheros en un Drive
  personal; la subida falla. La salida oficial es una unidad compartida, que es Workspace de pago.
- **El navegador sube directo a Google, no por `/api`.** Vercel corta el cuerpo de una petición en
  4,5 MB y un PDF escaneado se pasa de ahí sin esfuerzo.
- **`archivo/index.ts` es un encaminador, no un interruptor.** Al subir y al crear carpeta va
  siempre a Drive; al abrir, borrar, renombrar y mover manda el `proveedor` que lleve el propio
  apunte. Eso último no es nostalgia: es lo que hace que lo guardado en el equipo antes de este
  cambio siga abriéndose.

Y tres trampas de las que costó salir:

- **`requestAccessToken` abre una ventana siempre**, incluso con `prompt: ''`, y una ventana que no
  nace de un clic la bloquea el navegador. Por eso no se puede renovar al cargar la página, y por
  eso lo que arregla la recarga es **recordar el token**, no insistir en renovarlo.
- **El cliente de Google no se memoriza.** Su función de respuesta se queda atrapada en el cliente
  que la creó, así que la segunda petición resolvía la promesa de la primera y nunca contestaba a la
  suya. Se crea uno por petición y esa clase entera de avería desaparece.
- **Un error sin el texto de Drive no sirve de nada.** Un «no se pudo subir» genérico escondió
  durante tres rondas que la API de Drive estaba deshabilitada en el proyecto — el mensaje lo decía
  con todas las letras y el código lo estaba tirando.

Y lo de siempre, que aquí entra contenido de fuera por primera vez: **el nombre de un fichero lo
escribe quien sea**, así que se pinta como texto y nunca como HTML.

### Organizarse: carpetas, renombrar y mover

La usuaria decide el árbol. La intención era que pudiera hacerlo **con Drive conectado y sin
conectarlo** —organizarse no debería depender de la infraestructura—, pero **hoy crear una carpeta
exige Drive**: desde que las subidas son solo Drive, `crearCarpeta` pasa por la misma comprobación
y el botón «Carpeta» se deshabilita sin conectar. Renombrar y mover lo antiguo guardado en el equipo
sí funciona sin conectar. Queda por decidir si se vuelve a la intención o se da por buena la
realidad (DRIVE.md § 10).

Cuatro cosas que no se deducen:

- **Una carpeta es un documento propio, no un trozo de ruta dentro de cada apunte.** Si fuera texto,
  crear «Tema 3» antes de tener nada que meter dentro no guardaría nada y desaparecería al recargar
  — y organizarse es precisamente preparar el sitio **antes** de llenarlo. Además, así renombrar una
  carpeta no obliga a reescribir nada de lo que hay dentro.
- **Drive no mueve: quita un padre y pone otro**, en la misma llamada. Por eso `mover` recibe de
  dónde sale además de a dónde va; hacerlo en dos llamadas dejaría el fichero en los dos sitios o en
  ninguno si algo falla entre medias.
- **Mover una carpeta dentro de sí misma o de una hija suya** dejaría ese trozo del árbol sin camino
  a la raíz: invisible y sin forma de recuperarlo. Se comprueba antes de mover, y el dibujo del
  camino lleva tope de profundidad por si un dato corrupto llegara desde otro dispositivo.
- **El arrastre de dentro y el del disco son dos cosas.** Un arrastre interno lleva el tipo
  `application/x-archicel`; uno del sistema lleva `Files`. Sin distinguirlos, el panel entero se
  resaltaba a la vez que la carpeta concreta y no había forma de saber dónde iba a caer.

Y una de interfaz: **`onDragStartCapture` y no `onDragStart`**. Motion declara el suyo —el de su
gesto de arrastre— y tapa el del DOM, que es el que lleva `dataTransfer`.

## La página de una asignatura

`/asignatura/[clave]`, una por cada entrada de `ASIGNATURAS`. Se llega pulsando una clase en el
horario o su chip en la leyenda, y es **una página compuesta, no un tablero de widgets**: la portada
manda, y los apuntes son la superficie de trabajo.

**Estado: terminada**, con los pendientes de DRIVE.md § 10. Los bytes van a Drive —y solo a
Drive—, con carpetas, renombrar y mover. Es una lista, no una rejilla, y sin miniaturas; el visor
enseña dentro imágenes, PDF y vídeo, y el resto se descarga. El planteamiento completo está en
[docs/integraciones/DRIVE.md](docs/integraciones/DRIVE.md).

Lo que no se deduce leyendo el código:

- **La interfaz no habla con el almacenamiento.** Habla con `Archivador`, en `src/lib/archivo/`. Es
  el mismo patrón que el almacén y por el mismo motivo: el día que Drive se sustituya por otra cosa,
  se escribe otro archivador y ninguna pantalla se entera.
- **El almacén guarda la ficha, el archivador los bytes.** `Apunte` lleva nombre, tipo, tamaño y un
  `remoto`; por eso la pantalla se pinta entera sin una sola llamada al almacenamiento.
- **Firestore excluye de una consulta los documentos que no tienen el campo por el que se ordena**, y
  no avisa: devuelve una lista vacía. Los apuntes no tienen `fecha`, así que `crearColeccion` lleva
  ahora el campo de orden como parámetro y ellos se ordenan por `creado`.
- **`.vista.on` tiene dos clases.** Una regla nueva escrita como `.asig` pierde contra ella y no se
  aplica — sin error y sin que se note, porque la página sigue maquetando en bloque. Va
  `.vista.asig`.

## El repositorio

**https://github.com/VENOM393/Archicel** — el repositorio de todo el proyecto: la
aplicación, las skills del taller y la documentación.

Cosas que no se deducen mirando:

- **La rama es `master`.** No `main`.
- **`.env.local` no se sube nunca.** Ahí viven las claves de Firebase y el token de
  Canvas. Está en `.gitignore` y se comprueba con `git check-ignore .env.local` antes de
  cualquier subida. Un token de Canvas filtrado es la cuenta entera del campus.
- **`.claude/skills/` sí se versiona.** Son 11 MB de herramientas de terceros, pero están
  en el historial desde el primer commit y sirven para que el entorno se reproduzca igual
  en otra máquina.
- **La autenticación va por Git Credential Manager**, que abre el navegador. Nunca se
  escribe un token de GitHub en un fichero, en un comando ni en una conversación.
- **Se publica solo.** El repositorio está conectado a Vercel: cada `push` a `master`
  publica. No se despliega a mano desde el portátil — eso deja una versión viva que no está
  en ningún commit. Las variables de entorno y el dominio que hay que autorizar en Firebase,
  en [docs/tooling/DESPLIEGUE.md](docs/tooling/DESPLIEGUE.md).

## Estructura

```
.claude/skills/     las cinco skills de frontend, más la de graft (la escribe graft init)
docs/frontend/      SKILLS.md — uso de las skills
                    MOVIMIENTO.md — el sistema de animación (Motion)
                    WIDGETS.md — arquitectura del escritorio y modo edición
                    INSTALACION.md — la app como programa instalable (PWA)
docs/arquitectura/  ARQUITECTURA.md — capas, extensión y rendimiento medido
docs/data/          FIRESTORE.md — modelo · SEGURIDAD.md — revisión · CUENTAS.md — acceso
docs/integraciones/  CANVAS.md — API del campus de la UCAM y el motor que la consume
                    DRIVE.md — dónde viven los apuntes de cada asignatura
docs/design/        DESIGN.md — contrato visual
docs/tooling/       GRAFT.md — referencia de la capa de contexto
                    DESPLIEGUE.md — publicar en Vercel
README.md           la cara del repositorio
scripts/            iconos.mjs — genera los iconos desde public/icono.svg
graft/              grafo del código (git-ignored, regenerable — uno por worktree)
```
