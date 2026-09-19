# Graft — referencia

Repo: [trailhq/Graft](https://github.com/trailhq/Graft) · paquete `@nanonets/graft` v0.18.0 · MIT ·
requiere Node ≥ 20.

Lo operativo (cuándo instalarlo, qué hacer antes y después, reglas de uso diario) está en
[CLAUDE.md](../../CLAUDE.md). Esto es la referencia larga: comandos, flags, qué corre dónde y qué
hacer cuando algo no cuadra.

---

## Qué es

Un agente empieza cada sesión sin saber nada del repositorio: busca ficheros, sigue imports, lee
documentación, y quema tokens redescubriendo lo mismo una y otra vez. Graft construye **una vez** un
grafo local y lo reutiliza entre sesiones.

El grafo vive en `graft/` como ficheros markdown regenerables (git-ignored). Cada nodo contiene:

- **Summary** — qué hace ese trozo de código, en prosa.
- **Crux** — las líneas que cargan realmente con la lógica (≤ 8 líneas).
- **Sources** — los ficheros exactos que cubre, con hash de contenido para detectar que se han quedado atrás.
- **Links** — aristas tipadas: `depends_on`, `part_of`, `uses`, `implements`, `produces`.
- **Notes** — contexto escrito a mano, que sobrevive a las regeneraciones.

Esa profundidad de tres niveles (summary → crux → fichero fuente) es lo que permite responder sin
abrir el fuente.

Números que publica el proyecto: en una barrida controlada de 162 ejecuciones sobre dos bases de
código, −46% llamadas a herramientas, −42% tokens, −60% latencia sin pérdida de corrección; en
SWE-bench Verified (50 issues reales), 66% de acierto frente al 54% base, con −23% tokens.

## Lenguajes

- **Resolución completa entre ficheros:** TypeScript/JavaScript, Python, Go, Java, Kotlin, PHP, Swift, R.
- **Parseo amplio** (símbolos + aristas básicas): Rust, C, C++, C#, Ruby, Scala, Elixir, Solidity, OCaml, Zig, Dart, Clojure, Nix, Lua.
- **Aristas de grado compilador** (opcional, vía LSP): Rust, C/C++, Go, Python, TypeScript/JavaScript.

Nuestro stack (TypeScript) está en el primer grupo. **CSS, markdown y JSON no se indexan**: los
ficheros que no son de un lenguaje soportado se saltan enteros, no se indexan mal. Por eso
`docs/design/DESIGN.md` y `app/globals.css` se siguen leyendo a mano.

## Qué corre dónde

| Parte | Coste | Red |
|---|---|---|
| Grafo estructural: `build`, `check`, `ask`, `grep`, `skeleton`, `callers`, `map`, `blast` | $0, determinista (tree-sitter) | ninguna |
| `build --deep`: nodos de concepto, resúmenes y cruxes por símbolo | consume clave de API | tu proveedor |
| Estadísticas anónimas | — | un ping agrupado al día |

La telemetría envía solo etiquetas fijas y buckets: nunca código, rutas, nombre del repo, símbolos,
consultas ni mensajes de error. `graft telemetry debug` imprime exactamente qué se enviaría.
Se apaga con `graft telemetry disable`, `DO_NOT_TRACK=1`, o desmarcando la casilla en `init`.
Está apagada en CI y en compilaciones desde fuente.

Para `--deep`, Graft es agnóstico de proveedor: `GRAFT_PROVIDER` (`openai` para cualquier endpoint
compatible, `anthropic` para la API nativa, `litellm`/`orcarouter` para un gateway), `GRAFT_API_KEY`,
`GRAFT_MODEL` y `GRAFT_BASE_URL`. También por línea de comandos: `--provider/--model/--api-key/--base-url`.

---

## Comandos

### Construir

```bash
graft build [dir]                    # grafo de wiring + fichas por fichero (sin LLM, sin clave)
graft build --deep                   # añade la capa LLM: nodos de concepto + summary/crux por símbolo
graft build --extensions .ts .tsx    # limita las extensiones indexadas
graft build --no-reuse               # re-parsea todo en vez de reusar caché
graft build --follow-submodules      # incluye submódulos (por defecto se excluyen)
graft build --follow-nested-repos    # incluye clones git anidados (por defecto se excluyen)
```

### Consultar

```bash
graft ask "<pregunta>" --source      # nodos rankeados + file:line, con el código inline
graft ask "<pregunta>" --full        # el span entero cuando el crux se queda corto
graft ask "<pregunta>" --in app/     # acota a un subárbol antes de rankear
graft ask "<pregunta>" -n 12         # nº de resultados (por defecto 8)
graft ask "<pregunta>" --json        # salida legible por máquina

graft grep "<regex>"                 # búsqueda exhaustiva, agrupada por símbolo contenedor
graft grep "<texto>" -i --fixed      # sin distinguir mayúsculas; patrón literal, no regex
graft grep "<regex>" --in app/       # acota a un prefijo de ruta

graft skeleton <fichero>             # todas las firmas de un fichero, sin cuerpos (~1/10 de tokens)

graft callers <símbolo>              # quién lo llama / referencia / importa / implementa / extiende
graft callers <símbolo> --direction out   # lo contrario: de qué depende él
graft callers <símbolo> --depth 2    # radio de impacto habitual antes de renombrar
graft callers <símbolo> --depth all  # clausura completa: todo fichero conectado

graft map                            # orientación del repo: clusters, hubs, hotspots
graft map --max-dirs 30              # más o menos directorios
```

Las llamadas a métodos se resuelven por el **tipo del receptor** (asignaciones en el constructor y
anotaciones de tipo), no solo por el nombre en el punto de llamada, así que `callers` devuelve las
llamadas del tipo correcto y no todos los métodos del repo que se llamen igual.

`ask`, `skeleton`, `callers`, `grep`, `map` y `blast` **refrescan el grafo solos** si el árbol de
trabajo se ha movido. Para evitarlo: `--no-refresh`, o `GRAFT_NO_REFRESH=1` para todos los comandos.
`GRAFT_REFRESH=hash` hashea cada fichero en vez de fiarse de tamaño + mtime.

### Riesgo de un cambio

```bash
graft blast                          # qué depende de las líneas que toca el diff actual
graft blast --base origin/main       # contra el merge base: lo que correría un job de PR
graft blast --format markdown        # comentario de PR listo
graft blast --base origin/main --name  # nombra las áreas con una sola llamada LLM cacheada
graft blast --depth all --format json  # clausura transitiva completa, en JSON
graft blast --no-owners              # sin "a quién avisar" (por defecto lo saca del historial de git)
```

### Ver y mantener

```bash
graft viz                            # visor interactivo en localhost
graft viz --port 5000 --no-open
graft viz --export site/ --title "PR #12"   # un index.html autocontenido

graft check                          # sale con código 1 si graft/ ha derivado del código (para CI)
graft check --json

graft version                        # versión instalada + última publicada
graft upgrade                        # actualiza a la última
graft uninstall                      # lista lo que borraría, sin borrar
graft uninstall -y                   # borra de verdad (el inverso exacto de init)
graft uninstall --keep-cache         # quita el cableado, deja graft/ y la entrada de .gitignore
```

### Cablear agentes

```bash
graft init [dir]                     # pregunta qué agentes cablear; no escribe nada hasta que eliges
graft init --dry-run                 # lista cada fichero que tocaría y sale
graft init --agents claude           # solo Claude Code, sin preguntar
graft init --no-global               # no escribe fuera del repo (~/.codex/)
graft init --no-mcp                  # sin registrar el servidor MCP
graft init --no-hooks                # sin hooks
graft init --no-statusline           # sin statusline (= GRAFT_NO_STATUSLINE=1)
graft init --no-build                # solo cablea, no construye el grafo
graft init --list-agents             # ids conocidos: agents, cursor, gemini, grok, copilot, kiro, windsurf, adal, claude
```

Sin terminal interactiva (CI, Dockerfile, shell con pipe) `init` **no escribe nada** e imprime el
comando a ejecutar. Hay que pasar `--agents <ids>` o `--yes` para que un script sea explícito.

---

## Integración con Claude Code

`graft init` con `claude` seleccionado deja:

| Qué | Dónde |
|---|---|
| Manual de uso del propio Graft (150 líneas) | `.claude/skills/graft/SKILL.md` — fichero **suyo**, se reemplaza entero al re-ejecutar `init` |
| Statusline con tamaño del grafo, % enriquecido y aviso `⚠ N stale` | `.claude/settings.json` + `.claude/helpers/graft-statusline.cjs` |
| Hooks de auto-sync y aviso de radio de impacto al editar | `.claude/settings.json` + `.claude/helpers/graft-hooks.cjs` |
| Servidor MCP con 6 herramientas | `.mcp.json` — **requiere reiniciar Claude Code** |

Herramientas MCP: `graft_find_code` (pregunta), `graft_file_api` (ruta de fichero),
`graft_trace_calls` (símbolo, con `direction` y `depth`), `graft_find_all` (regex),
`graft_repo_map` (nada), `graft_check_freshness` (nada). La guía es idéntica a la de la CLI; se usa
la superficie que esté disponible.

`init` es idempotente: mezcla sus bloques y deja el resto de `.claude/settings.json` intacto. Un
`statusLine` que no sea el suyo (cualquiera cuyo comando no mencione `graft-statusline.cjs`) no lo
toca. **Nunca toca `CLAUDE.md`.**

El auto-sync es estructural y gratis: nunca lanza el LLM por su cuenta. Si se quiere la capa de
resúmenes hay que pedir `graft build --deep` explícitamente.

---

## Limitaciones y cosas que sorprenden

- **El grafo es caché local.** `graft/` está git-ignored; cada persona que clone el repo corre su
  propio `graft build`. Lo que se comparte es el cableado de `.claude/`.
- **Las fichas markdown bajo `graft/` van un paso por detrás.** Se regeneran al final del turno, no
  en cada consulta. Los *comandos* sí están siempre al día; si se hace `grep` directamente sobre los
  ficheros de `graft/`, hay que tratar como sospechosos los spans de un fichero editado en ese turno.
- **Si Graft nombra una ruta que no existe en disco**, su índice va por delante del checkout (cambio
  de rama, o un movimiento sin pullear). No leas el fichero que falta: `graft grep` el símbolo para
  ver dónde vive ahora, o `graft build` para refrescar.
- **Span truncado** ("+N more lines"): ahí sí, abre el fichero en ese rango exacto.
- **Submódulos y repos anidados quedan fuera** salvo `--follow-submodules` / `--follow-nested-repos`.
- **Los lenguajes no soportados no se indexan a medias: se saltan.**
- **`graft check` no refresca nada** a propósito — es el informe de deriva, pensado para CI.
