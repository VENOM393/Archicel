<div align="center">
  <img src="public/icono-192.png" width="88" alt="">
  <h1>Archicel</h1>
  <p><strong>Un panel de estudio para una estudiante de arquitectura.</strong><br>
  Lo contrario de Notion: pocas pantallas, muy compuestas.</p>
</div>

---

Archicel no es una herramienta de productividad. Es un regalo.

Celeste estudia Fundamentos de la Arquitectura y lleva su curso en Notion, que es una base
de datos con una interfaz encima. Esto es lo contrario: un proyecto de taller se presenta
como una página de revista, no como una fila de tabla. Hay una fotografía de una casa a la
hora azul debajo de todo, viva bajo un shader, y una entrega se ve venir desde el otro lado
de la pantalla.

El criterio que decide cada duda: **que le apetezca abrirlo**. El diseño y la animación no
son el envoltorio, son el producto.

## Qué hay hoy

| Pantalla | Qué hace |
|---|---|
| **Escritorio** | Widgets que se arrastran, se estiran y se quedan donde los dejas. Rejilla de 12 columnas, imantación a los vecinos, modo edición |
| **Calendario** | Vista mensual y semanal. De la semana se entra al día |
| **Horario** | Las clases del cuatrimestre, con la de ahora mismo señalada |
| **Acceso** | Entrada con Google o con correo. La cuenta es opcional: sin ella la aplicación funciona igual |

Además: se **instala como un programa** del ordenador (icono propio, ventana sin barra de
direcciones, arranque sin red) y sabe leer del **campus virtual de la UCAM** por la API de
Canvas.

## Cómo se arranca

```bash
npm install
npm run dev
```

Para probar la instalación como programa hace falta una compilación de producción, porque
el *service worker* solo se registra ahí:

```bash
npm run build && npm start
```

### Configuración

Crea un `.env.local` (está en `.gitignore` y ahí se queda):

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# opcional — el campus virtual
CANVAS_URL=https://canvas.ucam.edu
CANVAS_TOKEN=...
CANVAS_ZONA=Europe/Madrid
```

**Sin nada de esto la aplicación arranca igual**, guardando en el navegador. Es deliberado:
un fallo de la nube no puede dejarla sin abrir.

Las claves de Firebase llevan prefijo `NEXT_PUBLIC_` porque son públicas por diseño — lo
que protege los datos son las reglas de [firestore.rules](firestore.rules). El token de
Canvas **no lo lleva**, porque da acceso total a la cuenta del campus y nunca sale del
servidor.

## Cómo está hecho

```
src/app/          las cuatro vistas y la única ruta de servidor (/api/canvas)
src/components/   el marco, el fondo con shader, las hojas de edición
src/lib/data/     la capa de almacén: un contrato, dos implementaciones
src/lib/canvas/   el motor que lee del campus
src/lib/widgets/  el registro de widgets del escritorio
src/hooks/        el motor del escritorio y los datos vivos
docs/             el porqué de todo lo anterior
```

Cuatro decisiones que explican el resto:

- **La interfaz nunca habla con la base de datos.** Todo pasa por una capa con cuatro
  verbos —listar, guardar, borrar, escuchar— con dos implementaciones: el navegador y
  Firestore. Cambiar de una a otra es una línea y ninguna pantalla se entera.
- **Añadir un widget toca solo el registro.** Aparece en pantalla, el editor lo sabe mover
  y entra en el diseño ya guardado sin descolocar el resto.
- **La disposición del escritorio no se pierde nunca.** Se escribe en el acto y siempre con
  copia local, aunque haya sesión. Es lo único que la usuaria coloca a mano, bloque a
  bloque, y lo único que no puede rehacer de memoria.
- **Un solo ambiente: carbón.** No hay modo claro y no lo habrá. La fotografía que sostiene
  la aplicación está tomada a la hora azul y no existe una versión clara de ella.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript en modo estricto · Tailwind 4 ·
shadcn/ui sobre Radix · Firebase (Firestore + Auth) · WebGL a pelo para el fondo

## La documentación

El porqué está escrito. Cada documento explica decisiones, no funciones:

| Documento | De qué trata |
|---|---|
| [DESIGN.md](docs/design/DESIGN.md) | El contrato visual. Manda sobre cualquier otra cosa |
| [ARQUITECTURA.md](docs/arquitectura/ARQUITECTURA.md) | Las capas, dónde se extiende y qué rendimiento está medido |
| [WIDGETS.md](docs/frontend/WIDGETS.md) | El escritorio: rejilla, persistencia, modo edición |
| [FIRESTORE.md](docs/data/FIRESTORE.md) | El modelo de datos y las reglas |
| [SEGURIDAD.md](docs/data/SEGURIDAD.md) | La revisión de seguridad y qué protege cada capa |
| [CUENTAS.md](docs/data/CUENTAS.md) | Acceso, papeles y administrador |
| [CANVAS.md](docs/integraciones/CANVAS.md) | La API del campus y el motor que la consume |
| [INSTALACION.md](docs/frontend/INSTALACION.md) | Cómo se convierte en un programa del ordenador |
| [DESPLIEGUE.md](docs/tooling/DESPLIEGUE.md) | Publicar en Vercel: variables y el dominio que autorizar |
| [CLAUDE.md](CLAUDE.md) | Cómo se trabaja en este repositorio |

## Las herramientas del taller

En `.claude/skills/` viven cinco skills de frontend que se usan para diseñar y verificar.
No son parte del producto: son el taller. Están versionadas para que el entorno se
reproduzca igual en otra máquina.

---

<div align="center">
  <sub>Hecho para Celeste. — Cristian</sub>
</div>
