# Skills de frontend disponibles en este proyecto

Este proyecto lleva instaladas cinco skills en `.claude/skills/`. No son documentación: son
instrucciones que el agente **carga y obedece** cuando la tarea encaja. Están pensadas solo para
frontend (diseño, UI, 3D y verificación en navegador). Para backend, datos o infraestructura no
aportan nada y no deben dispararse.

> Regla de oro: **no escribas una sola pantalla sin haber pasado antes por `awesome-design`.**
> Todo lo demás se construye encima de ese contrato.

---

## Resumen

| Skill | Para qué sirve | Momento en que se dispara | Salida |
|---|---|---|---|
| `awesome-design` | Fijar la dirección visual del producto a partir de 74 sistemas de diseño reales | Antes de la primera pantalla, o cuando hay deriva visual | `docs/design/DESIGN.md` + tokens en CSS |
| `impeccable` | Diseñar, auditar, pulir y animar interfaz con criterio de director de arte | En cada pantalla o componente con peso visual | Código de UI + justificación de decisiones |
| `design-taste-frontend` | Anti-slop para landing, portfolio y rediseño: que no parezca plantilla | Páginas de entrada, secciones narrativas, rediseño de algo existente | Código de landing/sección no genérico |
| `playwright-cli` | Conducir un navegador real: navegar, clicar, rellenar, capturar, testear | Al terminar cualquier cambio visible, y para cualquier flujo con login o multi-paso | Verificación real + capturas + tests |
| `img2threejs` | Reconstruir un objeto de una foto como modelo Three.js procedural en código | Solo cuando hay una pieza 3D que justifique el coste | `.ts` + spec JSON, sin binarios pesados |

---

## Orden canónico de trabajo

```
1. awesome-design        ->  docs/design/DESIGN.md  (el contrato)
2. impeccable            ->  pantallas y componentes dentro del contrato
   design-taste-frontend ->  landing / secciones narrativas / rediseño
3. img2threejs           ->  solo si la pieza 3D está en el brief
4. playwright-cli        ->  verificar en navegador antes de decir "hecho"
```

Saltarse el paso 1 produce el efecto típico: cada pantalla bonita por separado y un producto que no
parece el mismo producto. Saltarse el paso 4 produce el otro efecto típico: "está hecho" sobre algo
que nunca se abrió en un navegador.

---

## 1. `awesome-design` — dirección visual

**Qué es.** Biblioteca de 74 ficheros `DESIGN.md` de marcas reales (Apple, Linear, Stripe, Vercel,
Ferrari, Spotify, Notion, Starbucks, Raycast...) en `.claude/skills/awesome-design/references/design-md/`.
Cada uno trae paleta con tokens semánticos, escala tipográfica, espaciado, radios, sombras, motion,
reglas de componente y el *porqué* de cada regla.

**Dispárala cuando:**
- se arranca el frontend y no existe `docs/design/DESIGN.md`;
- el usuario describe una sensación ("más cálido", "como Linear pero con alma") y no hay contrato escrito;
- dos pantallas ya escritas no se parecen entre sí;
- hay que añadir un tema nuevo (dark mode, modo lectura, una pantalla con reglas propias).

**No la dispares para:** cambiar un botón, ajustar un margen o cualquier decisión local dentro de una
dirección ya fijada.

**Qué produce:** `docs/design/DESIGN.md` con valores **propios** y una sección de anti-patrones, más
los tokens sincronizados en `app/globals.css`. La lógica de las referencias se toma prestada; los hex
de una marca real, nunca.

## 2. `impeccable` — el director de arte

**Qué es.** La skill más completa de las cinco (v4.3.1, Apache 2.0). Cubre jerarquía visual,
arquitectura de información, carga cognitiva, accesibilidad, rendimiento, responsive, theming,
tipografía, espaciado, color, motion, micro-interacciones, copy de interfaz, estados de error,
estados vacíos, i18n y sistemas de tokens reutilizables.

**Es invocable directamente** con subcomandos:
`shape`, `audit`, `critique`, `animate`, `bolder`, `colorize`, `delight`, `layout`, `overdrive`,
`quieter`, `typeset`, `adapt`, `clarify`, `distill`, `harden`, `onboard`, `optimize`, `polish`,
`init`, `document`, `extract`, `live`, `generate`.

**Dispárala cuando:**
- se diseña o rediseña cualquier pantalla, componente, formulario, onboarding o estado vacío;
- hay que auditar o criticar una UI existente (`audit`, `critique`);
- algo está soso y tiene que ser más audaz (`bolder`, `delight`) o al revés, demasiado ruidoso (`quieter`);
- falta pulido final: estados, foco, error, carga, responsive (`polish`, `harden`);
- se quiere iterar sobre un elemento en el navegador en vivo (`live`).

**No la dispares para:** tareas sin interfaz. Si el cambio es de API o de datos, no toca.

**Cómo se lleva con `design-taste-frontend`:** se solapan. Si la pieza es una **landing, portfolio o
sección narrativa**, manda `design-taste-frontend`. Para **producto** (pantallas internas, formularios,
dashboards, ajustes), manda `impeccable`. Nunca las dos a la vez sobre el mismo fichero: elígela antes
de empezar y dilo en voz alta.

## 3. `design-taste-frontend` — anti-slop

**Qué es.** La taste-skill original ([leonxlnx/taste-skill](https://github.com/leonxlnx/taste-skill)).
Lee el brief, infiere la dirección correcta y construye interfaces que no parecen plantilla. Audita
primero cuando se trata de un rediseño y pasa un pre-flight estricto antes de dar nada por terminado.

**Dispárala cuando:** la página de entrada, una sección con carga emocional o narrativa, un portfolio,
o el rediseño de algo que ya existe y sabe a genérico.

**No la dispares para:** dashboards, tablas de datos o UI de producto multi-paso. La propia skill lo
dice: ése no es su terreno.

**Nota.** El repo de origen trae más sub-skills que **no** están instaladas (rediseño de proyectos
existentes, brandkit, direcciones estéticas minimalista/brutalista/soft, generación de imágenes de
referencia). Si alguna hace falta, se pide y se instala; no se improvisa su contenido.

## 4. `playwright-cli` — verificación en navegador real

**Qué es.** La CLI oficial de Microsoft para agentes. Abre un Chrome real, navega, clica por
referencia de elemento, rellena formularios, mantiene sesión con login, intercepta red, graba vídeo
y traza, y genera tests de Playwright.

**Dispárala cuando:**
- se ha terminado cualquier cambio visible — antes de decir que está hecho;
- hay un flujo con varios pasos o detrás de un login;
- algo "no se ve bien" y hace falta mirarlo, no adivinarlo;
- hay que convertir un flujo manual en un test automático.

**Cómo ejecutarla hoy.** El binario `playwright-cli` no está en el PATH todavía. Hasta que exista
`package.json`, se usa con `npx`:

```bash
npx @playwright/cli@latest open http://localhost:3000
```

En cuanto se cree el proyecto, añadirlo como dependencia de desarrollo y usar el binario directo:

```bash
npm install -D @playwright/cli@latest
```

**Regla:** una captura o un snapshot del navegador vale más que una afirmación. Si no se abrió, no
está verificado, y hay que decirlo así.

## 5. `img2threejs` — imagen a Three.js procedural

**Qué es.** Reconstruye el objeto de una imagen de referencia como modelo Three.js **escrito en
código**: TypeScript diffeable más un spec JSON, con jerarquía de pivotes, sockets y colliders lista
para animar. Sin binarios de megas en el repositorio. Pipeline por etapas con puertas de calidad.
Necesita Python 3.10+ (solo librería estándar, cero dependencias).

**Dispárala cuando:** el brief pide una pieza 3D concreta a partir de una referencia visual y esa
pieza es parte del producto, no un adorno.

**No la dispares para:** fondos animados, partículas o efectos genéricos — eso es CSS, canvas o un
shader, y sale más barato. Tampoco para escenas completas: la skill reconstruye **un objeto**.

**Coste.** Es la más cara de las cinco en tiempo y tokens. Antes de lanzarla, confirma con el usuario
que esa pieza 3D merece el viaje.

---

## Definition of done visual

Una tarea de frontend no está terminada hasta que:

1. respeta `docs/design/DESIGN.md` (y si tuvo que salirse, el documento se actualizó y se explicó);
2. tiene todos los estados: carga, vacío, error, foco, hover, deshabilitado;
3. funciona en móvil real (360px) y en escritorio;
4. contraste y foco visibles cumplen AA;
5. se abrió en el navegador con `playwright-cli` y hay captura o snapshot que lo demuestre.

## Qué no hacer

- No inventar contenido de una skill que no está instalada. Si se necesita, se instala.
- No mezclar `impeccable` y `design-taste-frontend` sobre el mismo fichero en la misma pasada.
- No copiar la paleta o la tipografía literal de una marca real del catálogo.
- No dar por buena una pantalla sin abrirla en un navegador.

---

## Procedencia y licencias

| Skill | Origen | Licencia |
|---|---|---|
| `design-taste-frontend` | [leonxlnx/taste-skill](https://github.com/leonxlnx/taste-skill) (`skills/taste-skill`) | ver repo |
| `impeccable` | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) v4.3.1 | Apache 2.0 |
| `awesome-design` | `DESIGN.md` de [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md); el `SKILL.md` lo escribimos aquí porque el repo no trae ninguno | MIT (contenido) |
| `playwright-cli` | `npx @playwright/cli install --skills` (Microsoft) | Apache 2.0 |
| `img2threejs` | [img2threejs/img2threejs](https://github.com/img2threejs/img2threejs) v2.0.0 | Apache 2.0 |

Para actualizarlas se vuelve a clonar el repo de origen y se sustituye la carpeta; no se editan a
mano, salvo `awesome-design/SKILL.md`, que es nuestro.
