# Arquitectura de Archicel

Cómo está montado y, sobre todo, **dónde se toca cada cosa** cuando el proyecto crezca.

## Las capas, de dentro afuera

```
src/lib/data      el modelo y el almacén — no sabe que existe React
src/lib/ui        catálogo visual: iconos, tipos de evento, prioridades
src/lib/firebase  la sesión y el arranque de Firebase
src/hooks         el puente entre el almacén y los componentes
src/components    piezas de interfaz
src/app           las rutas
```

La dirección de las dependencias va **siempre hacia dentro**. `data` no importa nada de
`components`; `components` no habla con Firestore. Romper eso es lo que convierte un
proyecto en algo imposible de cambiar, así que es la única regla innegociable.

## Los cuatro puntos donde se extiende sin tocar nada más

Cuando algo crece, casi siempre se toca **uno solo** de estos sitios:

| Quiero… | Toco | Y ya está |
|---|---|---|
| un widget nuevo en el escritorio | `lib/widgets/registro.ts` + su componente | aparece, se puede mover y entra en el layout guardado |
| un tipo de evento nuevo | `lib/ui/catalogo.tsx` → `TIPOS` | color, icono y nombre salen solos en mes, agenda y leyenda |
| un icono nuevo para tareas | `lib/ui/catalogo.tsx` → `ICONOS` | aparece en el selector de la hoja |
| guardar una entidad nueva | `lib/data/almacen.ts` (contrato) + las dos implementaciones | las vistas la consumen con los mismos hooks |

Si para añadir algo hay que tocar cinco ficheros, es señal de que falta un registro como
estos. Merece la pena pararse a crearlo antes que repetir el cambio en cinco sitios.

## El almacén: un contrato, dos implementaciones

`lib/data/almacen.ts` define cuatro verbos — `listar`, `guardar`, `borrar`, `escuchar` —
y nada más. Hay dos implementaciones: `almacen-local.ts` (navegador) y
`almacen-firestore.ts` (nube). `crearAlmacen(uid)` elige.

Ninguna pantalla sabe cuál está usando. Esa es la razón de que la aplicación funcione sin
sesión y de que migrar a la nube al entrar sea una línea.

**Para añadir una entidad** (asignaturas, proyectos, referencias):

1. su tipo en `tipos.ts`;
2. una `Coleccion<T>` en el contrato;
3. la línea correspondiente en las dos implementaciones;
4. sus reglas en `firestore.rules` — **y su nombre en `estaValidada`**, o el comodín de
   las reglas dejará entrar cualquier cosa;
5. su hook en `useDatos.ts`, apoyado en `useLista`, que ya trae orden estable y
   deduplicación.

## Los hooks, y por qué no son un envoltorio tonto

`useLista` resuelve dos cosas que si no hay que recordar en cada pantalla:

- **orden estable**, con desempate final por `id`. Sin él, dos elementos con la misma
  fecha pueden intercambiarse entre lecturas, React mueve los nodos y las animaciones se
  reinician: eso era el parpadeo de los eventos.
- **nada de avisos vacíos**: si la lista nueva es idéntica a la anterior, no hay render.
  Firestore emite dos veces por escritura —una optimista y otra al confirmar—, y eso
  costaba el doble de trabajo en cada guardado.

`useAhora` existe por otra razón: la aplicación se prerrenderiza y el servidor no sabe qué
hora es donde está la usuaria. Todo lo que dependa del reloj tiene que pedirla a este hook
y enseñar una versión estable mientras llega, o el texto cambia solo al hidratar. Ese era
el reformateo del escritorio al entrar.

## Rendimiento: lo que está medido

Medido en **producción**, que es lo único que cuenta: en desarrollo cada ruta se compila al
visitarla y todo parece diez veces más lento.

| | antes | ahora |
|---|---|---|
| carga inicial | — | 30 ms |
| ir al calendario (mediana) | 1029 ms | 143 ms |
| ir a la agenda | — | 62 ms |
| memoria tras 16 navegaciones | — | 7 → 8 MB (sin fuga) |

El salto del calendario no era el código: era la caché del router caducando y volviendo al
servidor. Se arregló con `prefetch` en los enlaces del raíl —son tres y están siempre en
pantalla— y subiendo `staleTimes.static` a tres minutos, que no puede servir nada viejo
porque en ese HTML no hay datos: todo llega después por Firestore.

**Antes de optimizar nada, medir en `next build && next start`.** Esta sección existe
porque el primer diagnóstico apuntaba a un problema que no existía fuera de desarrollo.

## Lo que todavía no está hecho

Sinceridad sobre el estado real:

- **No hay colección de asignaturas.** El color de una tarea se deriva del nombre escrito
  (`colorDeAsignatura`). Cuando exista la entidad, esa función lee su color y ninguna
  tarea cambia, porque ya no guardan el suyo.
- **No hay pruebas automatizadas.** Todo se verifica midiendo en el navegador. Para el
  tamaño actual funciona; en cuanto haya más de una persona tocando, hará falta.
- **`hecha` y `progreso` conviven** en las tareas. `hecha` es el campo antiguo y se sigue
  escribiendo para no romper lo guardado. Cuando no queden tareas viejas, se retira.
