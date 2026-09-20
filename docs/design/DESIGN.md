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
  nunca en los componentes. Un solo ambiente: la noche azul, que es cuando ella trabaja.
  Los datos técnicos —escalas, cotas,
  metros, horas— van en monoespaciada tabular porque en arquitectura los números son
  material, no adorno.

colors:
  # Un solo ambiente: la noche. Todo el frío vive en el matiz 214-218 grados, muestreado
  # del cielo de la propia fotografía (#2E528B). La paleta anterior estaba en 193, que es
  # turquesa: por eso la interfaz y la imagen no parecían el mismo sitio.
  canvas-deep: "#0B0B0D"
  canvas: "#141417"
  glass-fill: "rgba(14, 14, 17, 0.70)"
  glass-fill-strong: "rgba(23, 23, 27, 0.80)"
  glass-edge: "rgba(255, 255, 255, 0.12)"
  glass-edge-lit: "rgba(255, 255, 255, 0.30)"
  ink: "#F4F4F6"
  ink-muted: "#C2C2C9"
  ink-subtle: "#92929B"
  accent: "#2B5090"        # relleno: azul oscuro, con texto blanco encima (7.9:1)
  accent-linea: "#7AA6E8"  # detalle: el mismo acento, legible como texto (6.4:1)
  accent-soft: "#A3C2F2"
  cool: "#A5A5AF"          # neutro: en carbon un frio azul seria el unico resto de la otra paleta
  on-accent: "#FFFFFF"

  # ——— semánticos
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
  # Cinco escalones y ni uno mas. La casa de la fotografia es ortogonal -losas, vidrio,
  # cantos vivos- y la interfaz que va encima se comporta igual: esquinas suaves, nunca
  # blandas. La capsula solo sobrevive donde algo es redondo de verdad.
  xs: "4px"    # marcas, casillas, chips diminutos
  sm: "7px"    # botones, campos, controles
  md: "10px"   # celdas, filas, tarjetas internas
  lg: "14px"   # widgets y paneles
  xl: "20px"   # superficies grandes: agenda, rejillas, hojas
  pill: "999px"  # SOLO circulos reales: avatar, puntos de color, pulgar del deslizador

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
3. **El frío sale de la fotografía, no del gusto de nadie.** Todos los azules de la paleta viven
   entre 214 y 218 grados de matiz, que es el del cielo de la imagen (#2E528B, muestreado del
   propio archivo). Un token frío que se aleje de esa franja se nota al instante: la interfaz deja
   de parecer parte de la escena y pasa a estar pegada encima. El tinte de ambiente del shader
   traduce `--canvas-deep` a lineal; si se cambia la paleta, se cambia también ahí.
4. **Los controles vienen de shadcn/ui y solo hay una acción sólida por pantalla.** Los botones son
   el componente de shadcn, no CSS propio, y sacan su color de estos mismos tokens: en
   `globals.css` los nombres de shadcn (`--primary`, `--border`, `--ring`…) **apuntan** a los de la
   casa en lugar de tener valores propios. Si alguna vez un token de shadcn lleva un color literal,
   hay dos sistemas conviviendo y eso es un error, no una excepción.

   La jerarquía es la regla que más se nota: **una sola pieza sólida por pantalla**, la que crea
   algo. Filtrar, navegar, cancelar o cambiar de vista son contorno o fantasma. Antes cinco botones
   ámbar idénticos competían en la misma barra y ninguno guiaba; eso —más que ningún color— es lo
   que hace que una interfaz parezca generada.
5. **Un solo acento, y lo pone el ambiente — pero tiene dos papeles.** En azul el acento es el ámbar
   de las ventanas; en carbón es un azul. Marca el foco, el elemento activo, la entrega y como mucho
   una acción. Los semánticos (al día, vencida) no son acento y nunca decoran.

   Lo que no se puede olvidar: el acento se usa de **relleno** —con texto encima— y de **detalle**,
   donde el color es justo lo que se lee. El ámbar servía para los dos porque es luminoso. Un azul
   oscuro no: de relleno es elegante (blanco encima a 7.9:1) y de texto sobre el panel daría 2.0:1,
   ilegible. Por eso hay dos tokens, `--accent` y `--accent-linea`, y cada ambiente decide si
   coinciden. Escribir `color: var(--accent)` es el error fácil aquí; para texto, filetes, anillos de
   foco y marcas dibujadas va siempre `--accent-linea`.
6. **La tipografía pesa.** En los tamaños grandes, 700 y tracking negativo hasta -0.04em. Lo que
   no es titular baja a 300 y se aparta. No hay pesos intermedios paseándose por la interfaz.
7. **Los números son material.** Escalas (1:100), cotas, metros cuadrados, horas y cuentas atrás
   van en monoespaciada tabular. Ahí la mono no es disfraz: es medición.
8. **El movimiento tiene un solo protagonista por pantalla.** Una entrada orquestada al cargar y
   una capa ambiente lentísima de fondo. Todo lo demás son respuestas al dedo: 240 ms y fuera.
9. **Un solo ambiente: carbón.** No hay modo claro y no lo habrá: la fotografía que sostiene la
   aplicación está tomada a la hora azul y no existe una versión clara de ella, así que un tema
   claro obligaba a inventar un segundo mundo visual que nunca casaba. El cristal es carbón neutro
   y el shader lo acompaña: la escena pierde parte de su color para no leerse como dos capas
   pegadas, pero nunca del todo — sigue siendo una fotografía, no una radiografía.
   `color-scheme: dark` hace que el navegador pinte también en oscuro lo que no dibujamos.
10. **Las superficies del navegador también son diseño.** Selección de texto, cursor de escritura,
   barra de scroll y anillo de foco se pintan desde estos tokens. Nada se queda en el gris del
   sistema.

**La segunda excepción: la firma del autor.** La placa «Made by Cristian» que hay bajo el
panel de acceso lleva **Instrument Serif en cursiva**, y es la única letra de todo Archicel que no
es Outfit ni la monoespaciada. La razón es que una firma escrita con la misma letra que la interfaz
no se lee como una firma: se lee como otra etiqueta del producto. El cambio de familia es justo lo
que dice «esto no lo escribió la aplicación, lo escribió una persona». Se carga con `next/font`
desde `src/lib/ui/fuentes.ts`, autoalojada, y no aparece en ninguna otra pantalla.

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

**La única excepción: la pantalla de acceso.** Ahí la fotografía **no** aparece dentro de la
interfaz. Estuvo, y se veía mal: la misma imagen que sostiene la aplicación por detrás, repetida
dentro de un panel a otra escala y con otro revelado, no se lee como composición sino como un
error de recorte. En su lugar va la marca —los dos triángulos del raíl— a tamaño de alzado sobre
papel milimetrado, con sus cotas, dibujándose sola. Es la única pieza de Archicel que no sale de
la fotografía, y es lo que hace que esa pantalla se distinga de todas las demás sin dejar de ser
la misma casa. Si algún día entra una fotografía distinta ahí, esta regla decae; mientras solo
haya una, no se repite.

## Sincronización

Estos tokens se reflejan en `app/globals.css` en el mismo cambio que los modifique. Un valor que
viva solo aquí es documentación muerta; uno que viva solo en el CSS es deriva.
