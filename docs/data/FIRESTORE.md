# Firebase — modelo de datos, reglas y conexión

Esto es lo que necesita Archicel para que sus datos vivan en la nube y sigan a Celeste entre el
portátil y el móvil. Está pensado para crecer: hoy son tareas y eventos, mañana serán proyectos,
referencias, imágenes de láminas y lo que venga.

---

## 1 · Qué hay que hacer en la consola de Firebase

Cinco pasos. Los tres primeros son imprescindibles; los dos últimos, en cuanto queramos subir imágenes.

### 1. Crear el proyecto
[console.firebase.google.com](https://console.firebase.google.com) → **Añadir proyecto**.
Nombre sugerido: `archicel`. Google Analytics: **no hace falta**, se puede desactivar.

### 2. Registrar la app web
Dentro del proyecto, icono **`</>`** (Web) → nombre `archicel-web` → **Registrar**.
Firebase devuelve un bloque como este:

```js
const firebaseConfig = {
  apiKey: "AIza…",
  authDomain: "archicel.firebaseapp.com",
  projectId: "archicel",
  storageBucket: "archicel.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123…:web:abc…"
};
```

**Eso es lo que necesito.** Pégamelo tal cual.

> No es un secreto: la `apiKey` de una app web de Firebase es pública por diseño y va en el código
> del navegador. Lo que protege los datos son las **reglas de seguridad** (punto 3), no ocultar esa
> clave. Lo que **nunca** hay que compartir ni subir al repo es el JSON de *cuenta de servicio*
> (Admin SDK): ese sí abre la base de datos entera.

### 3. Activar Firestore
**Compilación → Firestore Database → Crear base de datos**.

- Modo: **producción** (las reglas de abajo se encargan del acceso).
- Ubicación: **`eur3` (europe-west)** — es multirregión europea y es la que menos latencia da desde España. **La ubicación no se puede cambiar después**, así que ojo con este paso.

### 4. Activar Authentication
**Compilación → Authentication → Comenzar → Google** → activar → elegir correo de soporte → guardar.

Con Google basta: Celeste entra con su cuenta y sus datos quedan bajo su identificador. Si prefieres
que entre sin cuenta, dímelo y lo montamos con *enlace por correo* o incluso anónimo, pero entonces
pierde el acceso desde otro dispositivo.

### 5. Storage (hoy no se usa)
**Compilación → Storage → Comenzar**, misma región. Estaba pensado para las fotos de maquetas, las
láminas y el fondo personalizado. **Los apuntes no van aquí sino a Google Drive** —el de cada
persona, con `drive.file`—, y el porqué está en [DRIVE.md](../integraciones/DRIVE.md). Storage solo
haría falta si algún día se sube el fondo personalizado.

---

## 2 · Modelo de datos

Todo cuelga del usuario. Es la forma más simple de tener reglas de seguridad correctas y de que
añadir colecciones nuevas no obligue a repensar nada.

```
users/{uid}
  nombre: "Celeste"
  creado: <timestamp>

  users/{uid}/ajustes/app          ← documento único
    tema: "dark" | "light" | "auto"
    opacidad: 70
    fondo: "<id del asset>" | null

  users/{uid}/layout/{superficie}  ← "escritorio", y mañana otras
    widgets: { bienvenida: {fx, fw, y, h}, entrega: {...}, … }
    actualizado: <timestamp>

  users/{uid}/eventos/{eventoId}   ← entregas, exámenes, presentaciones…
    tipo: "entrega" | "examen" | "presentacion" | "correccion" | "visita" | "otro"
    titulo: "Entrega final"
    materia: "Proyectos IV"
    fecha: "2026-09-29"            ← texto YYYY-MM-DD, se ordena y filtra solo
    hora: 540 | null               ← minutos desde medianoche; null = todo el día
    nota: "9 láminas A1 + maqueta"
    creado / actualizado: <timestamp>

  users/{uid}/tareas/{tareaId}     ← lo que ocupa una franja del día
    fecha: "2026-09-20"
    ini: 480                       ← minutos desde medianoche
    fin: 600
    titulo: "Gimnasio"
    color: "verde"
    icono: "pesa"
    prio: "baja" | "media" | "alta"
    hecha: false
    creado / actualizado: <timestamp>

  users/{uid}/apuntes/{apunteId}   ← la FICHA de un fichero; los bytes están en Drive
    asignatura: "geometria"        ← clave del catálogo del curso
    nombre: "Tema 3 - diédrico.pdf"
    tipo: "application/pdf"        ← MIME; vacío si el navegador no lo supo
    tam: 2516582                   ← bytes, hasta 2 GB
    remoto: { proveedor: "drive" | "local", id: "<id en Drive>" }
    carpeta: "<carpetaId>"         ← opcional; sin él, la raíz de la asignatura
    orden: 3                       ← opcional; hoy no hay interfaz que lo escriba
    calificacion: 8.5              ← opcional; la nota del profesor, de 0 a 10

      Se llama `calificacion` y no `nota` porque `Evento.nota` ya existe y es un texto
      de observaciones. Dos campos hermanos con el mismo nombre y significados distintos
      es exactamente la clase de cosa que costó un diálogo roto con `.campo`.
    creado / actualizado: <timestamp>   ← se ordena por `creado`

  users/{uid}/carpetas/{carpetaId} ← el árbol con el que se organiza cada asignatura
    asignatura: "geometria"
    nombre: "Tema 3"
    madre: "<carpetaId>"           ← opcional; sin él, la raíz de la asignatura
    etiquetas: ["<etiquetaId>"]    ← opcional; una carpeta entera puede ser «Tema 3»
    remoto: { proveedor: "drive" | "local", id: "<id de la carpeta en Drive>" }
    creado / actualizado: <timestamp>   ← se ordena por `nombre`

  users/{uid}/etiquetas/{etiquetaId} ← lo que algo ES, que pueden ser varias cosas a la vez
    nombre: "Pasar a limpio"       ← ≤ 60, lo escribe ella
    color: "ambar"                 ← de los catorce de COLORES
    creado / actualizado: <timestamp>   ← se ordena por `nombre`, nunca por un opcional

    El catálogo es GLOBAL, no por asignatura: «pasar a limpio» vale en todas, y tenerlas
    por asignatura obligaría a recrear las mismas cinco seis veces. Lo que evita la mezcla
    es la pantalla, que solo enseña las que se usan en la asignatura que se está mirando.

    No tiene `asignatura` ni `remoto`: no vive en ninguna carpeta y no tiene bytes en
    ningún sitio. Es el documento más pequeño de la base.

  users/{uid}/bloques/{bloqueId}   ← el plan de un día, repartido en cuatro partes
    fecha: "2026-10-24"            ← el día que se planea
    franja: "manana"               ← manana | mediodia | tarde | noche
    asignatura: "geometria"        ← la clave de ASIGNATURAS, ≤ 120
    minutos: 90                    ← 15 a 120, múltiplo de 15
    creado / actualizado: <timestamp>   ← se ordena por `fecha`

    **La franja NO es una hora del reloj**, y de ahí sale todo lo demás: «mañana» no es
    «de 9 a 11». Por eso esto no es una `Tarea` —que sí ocupa una franja medida en
    minutos desde medianoche— y por eso no sale en la agenda del día ni en el mes.

    El tope de dos horas por franja **lo vigila la pantalla, no las reglas**: una regla
    solo ve el documento que se escribe, nunca la suma de los que ya están. Lo que sí
    acotan las reglas es que ninguno solo pase de 120.

    El detalle, en [docs/frontend/METODOS.md](../frontend/METODOS.md) § 3.

  users/{uid}/sesiones/{sesionId}  ← cuánto se ha estudiado, de qué y cuándo
    asignatura: "geometria"        ← la clave de ASIGNATURAS, ≤ 120
    fecha: "2026-10-21"            ← el día en que EMPEZÓ
    minutos: 25                    ← > 0 y ≤ 1440 (un día entero no es una sesión)
    metodo: "pomodoro"             ← ≤ 40; hoy solo hay uno
    ini: 1035                      ← opcional; minutos desde medianoche
    creado: <timestamp>            ← se ordena por `fecha`, que es obligatorio

    Una fila POR SESIÓN, no una por asignatura y día que se va sumando. Desde las filas
    sueltas se reconstruye el total; desde el total no se puede saber a qué hora rinde
    mejor. Lo que no se guarda no se recupera.

    `ini` es lo que deja contestar algún día «¿a qué hora estudias mejor?» sin volver a
    pedir nada. Es opcional porque una sesión apuntada a mano podría no tenerlo.

    El detalle, en [docs/frontend/METODOS.md](../frontend/METODOS.md).

  users/{uid}/asignaturas/{id}     ← lo siguiente que toca
    nombre, color, profesor, progreso

  users/{uid}/proyectos/{id}
    titulo, asignatura, escala, superficie, laminas: {hechas, total}, horas
```

### Por qué así

- **Fechas como texto `YYYY-MM-DD`.** Ordenan y se consultan por rango sin trucos:
  `where('fecha', '>=', '2026-09-14').where('fecha', '<=', '2026-09-20')` devuelve la semana entera.
  Un `Timestamp` obligaría a pelearse con zonas horarias para algo que es un día del calendario, no
  un instante.
- **Horas como minutos enteros.** `480` es las 08:00. Se sortean, se restan y se pintan sin parsear nada.
- **Una colección por tipo de cosa**, no un documento gigante con arrays. Así dos pestañas abiertas no
  se pisan, y añadir mil tareas no hace crecer un documento que Firestore limita a 1 MB.
- **Subcolecciones del usuario.** Las reglas caben en seis líneas y no hay forma de leer lo ajeno.

### Cuando haya que compartir

Si algún día Cristian debe ver o editar lo mismo, no se toca este modelo: se añade
`espacios/{espacioId}` con un mapa `miembros: {uid: "editor"|"lector"}` y las colecciones se mueven
bajo el espacio. Es el camino estándar y no rompe lo de arriba.

---

## 3 · Reglas de seguridad

Están en [`firestore.rules`](../../firestore.rules), listas para pegar en
**Firestore → Reglas → Publicar**.

> **`fechaValida` usa [0-9] y no la abreviatura con barra invertida.** Dentro de una cadena de las reglas,
> `\` abre una secuencia de escape y `\d` no es ninguna: la consola contesta
> *«Unexpected 'd'»* y se niega a guardar **el fichero entero**, con un segundo error en
> otra línea que es solo el analizador descarrilando. Escrito `\\d`, la cadena contiene
> una barra y una d, que es lo que el motor de expresiones regulares necesita ver.
>
> Estuvo mal desde el primer commit, así que lo que había publicado en la consola nunca
> salió de este fichero. Si alguien lo «arregla» quitando una barra, vuelve a ser
> impublicable.

Lo que hacen:

- Nadie lee ni escribe sin haber iniciado sesión.
- Cada usuario solo alcanza su propio árbol `users/{uid}`.
- Se valida lo esencial al escribir: que los campos obligatorios estén, que la fecha tenga forma de
  fecha y que las horas sean enteros dentro del día. Una regla que no valida nada es una puerta abierta.

---

### El comodín del final: `delete` va aparte de `create, update`

En Firestore **`allow write` cubre create, update y delete**, pero en un borrado
`request.resource` es **null**. El comodín del final llevaba

```
allow write: if esPropietario(uid) && !estaValidada(coleccion)
  && request.resource.data.keys().size() <= 50;
```

y esa última condición revienta en un borrado, así que **denegaba todos los borrados** de
cualquier colección que cayera ahí. El efecto es de los que no se encuentran leyendo: se
puede crear y no se puede borrar, y solo aparece el día que alguien pulsa la equis.

Pasó con `bloques` recién estrenada: las reglas publicadas aún no la conocían, cayó en el
comodín, y Celeste podía colocar bloques en el plan y no quitarlos. Ahora el comodín tiene
su `allow delete` aparte, **y da igual que una colección nueva tarde en tener su `match`**.

## 4 · Índices

Firestore crea solo los de un campo, que cubren casi todo. Harán falta índices compuestos cuando
consultemos:

| Consulta | Índice |
|---|---|
| Tareas de un día ordenadas por hora | `fecha` ASC + `ini` ASC |
| Eventos de un rango ordenados por fecha y hora | `fecha` ASC + `hora` ASC |
| Tareas pendientes de un día | `fecha` ASC + `hecha` ASC + `ini` ASC |

No hay que adivinarlos: cuando una consulta los necesite, Firestore falla con un enlace directo que
los crea. Los dejo apuntados para no perder tiempo buscando por qué "no devuelve nada".

---

## 5 · Cómo se conecta el código

La app **no llama a Firestore directamente desde la interfaz**. Hay una capa de almacén con cuatro
verbos —`listar`, `guardar`, `borrar`, `escuchar`— y dos implementaciones:

- **Local**: `localStorage`, que es lo que corre hoy en el prototipo.
- **Firestore**: la misma interfaz contra la nube, con escucha en tiempo real.

Cambiar de una a otra es una línea. La interfaz nunca sabe dónde viven los datos, y por eso se puede
trabajar sin conexión, hacer pruebas sin tocar la base real y migrar sin reescribir pantallas.

**Cómo escribe `guardar` en Firestore.** Con `setDoc(…, { merge: true })`, para no perder `creado`
ni lo que otra versión de la aplicación haya añadido al documento. El precio de `merge` es que
**conserva todo campo que no venga**, así que quitar un campo del objeto no lo quita de la nube:
mover un apunte a la raíz (`delete a.carpeta`) lo dejaba dentro de la carpeta de antes. Por eso
cada colección declara sus campos opcionales en `almacen-firestore.ts`:

| Colección | Opcionales |
|---|---|
| `eventos` | `materia`, `nota` |
| `tareas` | `asignatura`, `progreso` |
| `apuntes` | `carpeta`, `orden`, `etiquetas` |
| `carpetas` | `madre`, `etiquetas` |
| `etiquetas` | — |
| `sesiones` | `ini` |
| `bloques` | — |

Y `apuntes` lleva además `calificacion`, la nota del profesor.

El opcional que no llega, o llega `undefined`, se manda como `deleteField()` y desaparece.
`undefined` necesitaba ese trato de todas formas: Firestore rechaza la escritura entera si lo
encuentra, y una tarea sin asignatura no se guardaba. Las reglas aceptan el resultado, porque
todas escriben los opcionales como `!('campo' in request.resource.data) || …`.

Dos condiciones para que esto siga siendo cierto: **`guardar` recibe siempre el documento
completo** —el que se leyó, con lo que cambió—, nunca un trozo, porque un trozo borraría los
opcionales que no trajera; y **un opcional nuevo en `tipos.ts` va también a esa lista**. El almacén
local no lo necesita: reescribe el documento entero.

El orden de trabajo cuando tengamos la configuración:

1. Meter `firebaseConfig` en variables de entorno del proyecto Next.js (`NEXT_PUBLIC_FIREBASE_*`).
2. Entrar con Google y comprobar que aparece el `uid`.
3. Subir lo que haya en `localStorage` a Firestore al entrar (`migrarLocalANube`): eventos,
   tareas, ajustes, el layout, carpetas y apuntes, con sus ids y **una marca por colección**, sin
   pisar lo que ya esté en la nube. Las reglas aceptan lo que sube tal cual: la ficha local tiene la
   misma forma que la de la nube, y `remoto.proveedor` puede ser `'local'` para lo anterior a
   Drive. El detalle, en [CUENTAS.md](CUENTAS.md).
4. Cambiar el almacén a Firestore y verificar que la app se comporta igual.
5. Encender la escucha en tiempo real: marcar una tarea en el móvil y verla cambiar en el portátil.

---

## 6 · Una advertencia sobre el prototipo publicado

El prototipo que estás viendo como artifact **no puede conectarse a Firebase**: esa página solo
admite lo que lleva dentro, y cualquier conexión a un servidor externo queda bloqueada. La conexión
real vive en el proyecto Next.js.

Así que el plan es: el prototipo sigue con almacenamiento local para probar diseño y flujos, y
Firestore entra en cuanto montemos Next.js. El modelo y las reglas de este documento valen para los dos.
