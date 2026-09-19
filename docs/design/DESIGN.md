---
version: alpha
name: Archicel-design
description: >
  Vidrio sobre la casa. Un panel de estudio para una estudiante de arquitectura, construido
  como una ventana flotante sobre una fotografía: una casa de vidrio a la hora azul, con el
  asfalto mojado y las ventanas encendidas. Un shader WebGL la mantiene viva —el encuadre
  respira, el suelo ondula, la luz de tungsteno late— y de ahí sale toda la paleta: el frío
  del crepúsculo es el aire, el ámbar de las ventanas es el único acento. Tipografía sans muy
  pesada con tracking negativo agresivo en los tamaños grandes. La atmósfera vive en el fondo,
  nunca en los componentes. Dos ambientes reales: noche azul (por
  defecto, es cuando ella trabaja) y porcelana de día. Los datos técnicos —escalas, cotas,
  metros, horas— van en monoespaciada tabular porque en arquitectura los números son
  material, no adorno.

colors:
  # ——— noche (ambiente por defecto)
  night-canvas-deep: "#0A1317"
  night-canvas: "#101C21"
  night-glass-fill: "rgba(190, 214, 222, 0.11)"
  night-glass-fill-strong: "rgba(190, 214, 222, 0.18)"
  night-glass-edge: "rgba(214, 234, 240, 0.24)"
  night-glass-edge-lit: "rgba(236, 247, 250, 0.55)"
  night-ink: "#EAF2F4"
  night-ink-muted: "#B6C8CD"
  night-ink-subtle: "#93A8AF"
  night-accent: "#F0A85C"      # luz de ventana, muestreada de la foto
  night-accent-soft: "#F8CB94"
  night-cool: "#8FB7C4"       # el frío del crepúsculo, para datos y series

  # ——— día (porcelana)
  day-canvas-deep: "#AFC4CC"
  day-canvas: "#C8D8DE"
  day-glass-fill: "rgba(255, 255, 255, 0.56)"
  day-glass-fill-strong: "rgba(255, 255, 255, 0.76)"
  day-glass-edge: "rgba(255, 255, 255, 0.82)"
  day-glass-edge-lit: "rgba(255, 255, 255, 0.96)"
  day-ink: "#0D1B20"
  day-ink-muted: "#3A5058"
  day-ink-subtle: "#4E6970"
  day-accent: "#9A5613"       # el mismo ámbar, oscurecido para leer sobre claro
  day-accent-soft: "#C07A24"
  day-cool: "#37606F"

  # ——— semánticos (idénticos en ambos ambientes)
  on-track: "#7FC8A9"
  overdue: "#E8735A"

typography:
  family-ui: "Outfit, 'SF Pro Display', system-ui, sans-serif"
  family-data: "ui-monospace, 'SF Mono', 'Cascadia Mono', monospace"
  display-xl:
    fontSize: "clamp(30px, 4.2vw, 52px)"
    fontWeight: 700
    lineHeight: 0.96
    letterSpacing: "-0.035em"
  display:
    fontSize: "clamp(30px, 4vw, 44px)"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.03em"
  metric:
    fontSize: "clamp(38px, 4.6vw, 48px)"
    fontWeight: 700
    lineHeight: 0.9
    letterSpacing: "-0.04em"
    fontVariantNumeric: "tabular-nums"
  title:
    fontSize: "13.5px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  body:
    fontSize: "13.5px"
    fontWeight: 300
    lineHeight: 1.6
  label:
    fontSize: "11px"
    fontWeight: 500
    letterSpacing: "0.14em"
    textTransform: "uppercase"
  data:
    fontFamily: "family-data"
    fontSize: "12px"
    letterSpacing: "0.04em"
    fontVariantNumeric: "tabular-nums"

spacing:
  base: "4px"
  scale: [4, 8, 12, 16, 22, 30, 40, 56, 76]
  gutter-min: "16px"
  panel-padding: "17px 18px"
  row-gap: "12px"

radius:
  panel: "16px"
  control: "12px"
  chip: "10px"
  pill: "999px"

glass:
  blur: "24px"
  saturate: "150%"
  edge-width: "1px"
  inner-highlight: "inset 0 1px 0 var(--glass-edge-lit)"
  shadow: "0 26px 60px -34px rgba(3, 10, 13, 0.9)"

motion:
  enter: "700ms cubic-bezier(0.16, 1, 0.3, 1)"
  hover: "240ms cubic-bezier(0.33, 1, 0.68, 1)"
  ambient: "20s ease-in-out infinite alternate"
  stagger: "70ms"
---

# Vidrio azul — contrato visual de Archicel

## De dónde sale

Del moodboard que pasó Cristian y de una referencia concreta de dashboard: panel flotante,
cristal esmerilado, foto de atmósfera detrás, tipografía enorme y pesada. La lógica de escala
tipográfica con tracking negativo fuerte viene de estudiar `references/design-md/linear.app`; la
idea de un único primario cromático saturado, de `references/design-md/coinbase`. Los valores de
este documento son propios: ninguna paleta ni tipografía de esas marcas se copia.

## Reglas

1. **La atmósfera vive en el fondo, nunca en los componentes.** La fotografía respira bajo el
   shader; el cristal está quieto. Un panel con gradiente propio compite con la foto y ensucia
   las dos. El shader oscurece la imagen un 50 % en noche: es lo que hace legible todo lo demás,
   así que bajar ese velo obliga a subir el relleno del cristal en la misma medida.
2. **El cristal es un efecto, no una decoración.** Solo lo llevan las superficies que flotan sobre
   el cielo. Nada de cristal sobre cristal: un panel dentro de otro panel se dibuja con una
   línea de 1px y un cambio de relleno, jamás con un segundo blur.
3. **Un solo acento, y es cálido.** El ámbar de las ventanas marca el foco, el elemento activo,
   la entrega y como mucho una acción. El azul frío del crepúsculo no es acento: es aire, y solo
   se usa para series de datos secundarias. Los semánticos (al día, vencida) tampoco son acento
   y nunca decoran.
4. **La tipografía pesa.** En los tamaños grandes, 700 y tracking negativo hasta -0.04em. Lo que
   no es titular baja a 300 y se aparta. No hay pesos intermedios paseándose por la interfaz.
5. **Los números son material.** Escalas (1:100), cotas, metros cuadrados, horas y cuentas atrás
   van en monoespaciada tabular. Ahí la mono no es disfraz: es medición.
6. **El movimiento tiene un solo protagonista por pantalla.** Una entrada orquestada al cargar y
   una capa ambiente lentísima de fondo. Todo lo demás son respuestas al dedo: 240 ms y fuera.
7. **La noche es el ambiente por defecto** porque es cuando se entrega. El día no es el modo noche
   invertido: es su propia composición, con el cristal más opaco para que aguante la luz.
8. **Las superficies del navegador también son diseño.** Selección de texto, cursor de escritura,
   barra de scroll y anillo de foco se pintan desde estos tokens. Nada se queda en el gris del
   sistema.

## Anti-patrones — prohibido en este proyecto

- **Etiqueta o antetítulo sobre un titular.** El titular se sostiene solo; la etiqueta sobra siempre.
- **Cristal sobre cristal**, y cualquier blur que no separe la interfaz del cielo.
- **Texto con degradado.** El énfasis se consigue con peso y tamaño.
- **Rejilla de tarjetas idénticas** como estructura de pantalla. La jerarquía la marca el tamaño:
  un panel manda, los demás acompañan.
- **Emojis o glifos Unicode como iconos.** Todos los iconos son SVG dibujados, trazo 1.6, misma familia.
- **Un segundo color saturado.** Si algo necesita destacar y ya hay acento en pantalla, se destaca
  con tamaño o con aire, no con un color nuevo.
- **Sombras de color sin desplazamiento** (el halo). Toda sombra tiene desplazamiento y difuminado.
- **Números decorativos de sección** (01 / 02 / 03) salvo que el orden sea información real.

## La fotografía

El fondo es una imagen real, no una textura generada. Va incrustada en la página como WebP a
1800 px (83 KB) y la dibuja un shader WebGL a pantalla completa. Si el navegador no tiene WebGL,
la misma foto se muestra como fondo CSS estático con un velo por encima: la página nunca se queda
sin fondo. Con `prefers-reduced-motion` el shader pinta un fotograma y se detiene.

Al cambiar de fotografía hay que volver a muestrear la paleta de ella y actualizar este documento.
Una foto nueva con otra temperatura de luz rompe el acento.

## Sincronización

Estos tokens se reflejan en `app/globals.css` en el mismo cambio que los modifique. Un valor que
viva solo aquí es documentación muerta; uno que viva solo en el CSS es deriva.
