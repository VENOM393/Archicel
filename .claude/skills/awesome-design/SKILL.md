---
name: awesome-design
description: Biblioteca de 74 ficheros DESIGN.md de marcas reales (Apple, Linear, Stripe, Vercel, Ferrari, Spotify, Notion...) usada para fijar la direccion visual de un proyecto antes de escribir UI. Usala cuando haya que elegir o definir la estetica del producto, crear el DESIGN.md del proyecto, extraer tokens de color/tipografia/espaciado/motion coherentes, o resolver una discusion de "como deberia sentirse esto". No la uses para implementar componentes concretos: eso es trabajo de impeccable o design-taste-frontend.
license: MIT
---

# awesome-design — direccion visual antes de escribir UI

Fuente: [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) (MIT).
Esta skill **no genera codigo**. Produce o actualiza **un unico artefacto**: `docs/design/DESIGN.md`,
el contrato visual del proyecto que el resto de skills de frontend consumen.

## Cuando dispararla

- Al arrancar el frontend, antes de la primera pantalla.
- Cuando el usuario describe una sensacion ("que se sienta calido", "como Linear pero mas humano")
  y no existe todavia un `docs/design/DESIGN.md`.
- Cuando dos pantallas ya escritas no se parecen entre si: hay deriva y falta contrato.
- Cuando hay que anadir un tema nuevo (dark mode, modo lectura, pantalla especial).

No la dispares para cambios locales dentro de una direccion ya fijada.

## Material disponible

- `references/design-md/<marca>/DESIGN.md` — 74 sistemas completos: paleta con tokens semanticos,
  escala tipografica, espaciado, radios, sombras, motion, reglas de componente y el *porque* de cada regla.
- `references/design-md/<marca>/README.md` — resumen de esa direccion.
- `references/CATALOG.md` — indice del repo original.

Marcas: airbnb, airtable, apple, binance, bmw, bmw-m, bugatti, cal, claude, clay, clickhouse, cohere,
coinbase, composio, cursor, dell-1996, elevenlabs, expo, ferrari, figma, framer, hashicorp, hp, ibm,
intercom, kraken, lamborghini, linear.app, lovable, mastercard, meta, minimax, mintlify, miro, mistral.ai,
mongodb, nike, nintendo-2001, notion, nvidia, ollama, opencode.ai, pinterest, playstation, posthog, raycast,
renault, replicate, resend, revolut, runwayml, sanity, sentry, shopify, slack, spacex, spotify, starbucks,
stripe, supabase, superhuman, tesla, theverge, together.ai, uber, vercel, vodafone, voltagent, warp, webflow,
wired, wise, x.ai, zapier.

## Procedimiento

1. **Lee el brief.** Publico, tono, contenido dominante (texto / foto / datos / 3D), dispositivo principal.
   Si el brief no existe, preguntalo antes de elegir nada.
2. **Elige 2 o 3 referencias** que resuelvan problemas distintos, no tres variantes del mismo gusto.
   Ejemplo util: una por *estructura* (linear.app), una por *calidez cromatica* (starbucks),
   una por *tratamiento de imagen* (apple). Lee sus `DESIGN.md` enteros, no solo el README.
3. **Justifica la mezcla en dos frases.** Si no puedes explicar por que esa combinacion sirve a este
   producto concreto, la eleccion es decorativa: vuelve al paso 1.
4. **Escribe `docs/design/DESIGN.md` propio.** Mismo formato que las referencias (frontmatter con
   `colors`, `typography`, `spacing`, `radius`, `motion` + secciones de reglas y anti-patrones).
   Valores **propios**: nunca copies la paleta ni la tipografia de una marca real tal cual — es su
   identidad, no la nuestra. Toma la *logica* (relaciones de contraste, ritmo de escala, rol de cada color),
   no los hex.
5. **Cierra con anti-patrones**: que esta prohibido en este proyecto concreto. Sin esa seccion el
   documento no frena nada.
6. **Sincroniza los tokens** con `app/globals.css` (o el theme de Tailwind v4) en el mismo cambio.
   Un DESIGN.md que no esta reflejado en el codigo es documentacion muerta.

## Contrato con las demas skills

- `awesome-design` **decide** la direccion → `docs/design/DESIGN.md`.
- `impeccable` y `design-taste-frontend` **ejecutan** dentro de esa direccion y la leen antes de disenar.
- `playwright-cli` **verifica** el resultado en navegador real.

Si una de esas skills quiere salirse del DESIGN.md, primero se actualiza el DESIGN.md y se dice por que.
