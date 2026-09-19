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
- **Dispositivo principal:** _por confirmar_ — el prototipo se construye y se verifica en escritorio
  y en móvil.
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

### Cuándo instalarlo — todavía no

Graft indexa código, y aquí aún no hay ninguno. Instalarlo hoy produciría un grafo vacío. El momento
correcto es **justo después de scaffoldear Next.js y tener las primeras pantallas**, no antes.

### Antes de `graft init`

1. `git init` y primer commit. Graft se apoya en git para `.gitignore`, para `blast --base` y para
   saber qué ficheros trackea. Sin repo, medio producto no funciona.
2. Node ≥ 20 (aquí hay v24, correcto).
3. Decidir **telemetría**: Graft manda estadísticas anónimas por defecto (sin código, rutas, nombre
   de repo ni consultas). Se desactiva desmarcando la casilla en `init`, con `graft telemetry disable`
   o con `DO_NOT_TRACK=1`. **Preguntar a Cristian antes**, no decidirlo por él.
4. Decidir si habrá build `--deep`. El grafo estructural es gratis y sin clave; `--deep` añade
   resúmenes escritos por un LLM y **consume clave de API de pago**. Por defecto: no.

### Cómo instalarlo

```bash
npm install -g @nanonets/graft
graft init --dry-run
```

`--dry-run` lista todo lo que tocaría sin escribir nada; se revisa **antes** de confirmar. Después:

```bash
graft init --agents claude --no-global
```

- `--agents claude` evita cablear agentes que aquí no se usan (Cursor, Gemini, Copilot…).
- `--no-global` evita que escriba fuera del repo, en `~/.codex/`, que afectaría a **todos** tus otros
  proyectos.

Eso escribe: `.claude/skills/graft/SKILL.md` (el manual de uso del propio Graft, 150 líneas — **ahí
está el detalle fino, no hay que duplicarlo aquí**), un statusline, hooks de auto-sync y el servidor
MCP en `.mcp.json`. **Hay que reiniciar Claude Code** para que cargue el MCP. `init` es idempotente y
nunca toca `CLAUDE.md` ni pisa el resto de `.claude/settings.json`.

Luego se commitea el cableado, no el grafo:

```bash
git add .claude .mcp.json && git commit -m "wire in graft"
```

`graft/` se añade solo al `.gitignore`: es caché local regenerable, como `node_modules`.

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

## Estructura

```
.claude/skills/     las cinco skills de frontend (+ graft, cuando se instale)
docs/frontend/      SKILLS.md — uso de las skills
                    WIDGETS.md — arquitectura del escritorio y modo edición
docs/design/        DESIGN.md — contrato visual
docs/tooling/       GRAFT.md — referencia de la capa de contexto
graft/              grafo del código (git-ignored, regenerable — no existe aún)
```
