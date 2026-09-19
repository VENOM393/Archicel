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

### 5. Storage (solo cuando subamos imágenes)
**Compilación → Storage → Comenzar**, misma región. Es lo que usaremos para las fotos de maquetas,
las láminas y el fondo personalizado.

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
**Firestore → Reglas → Publicar**. Lo que hacen:

- Nadie lee ni escribe sin haber iniciado sesión.
- Cada usuario solo alcanza su propio árbol `users/{uid}`.
- Se valida lo esencial al escribir: que los campos obligatorios estén, que la fecha tenga forma de
  fecha y que las horas sean enteros dentro del día. Una regla que no valida nada es una puerta abierta.

---

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

El orden de trabajo cuando tengamos la configuración:

1. Meter `firebaseConfig` en variables de entorno del proyecto Next.js (`NEXT_PUBLIC_FIREBASE_*`).
2. Entrar con Google y comprobar que aparece el `uid`.
3. Subir de una vez lo que haya en `localStorage` a Firestore (migración única).
4. Cambiar el almacén a Firestore y verificar que la app se comporta igual.
5. Encender la escucha en tiempo real: marcar una tarea en el móvil y verla cambiar en el portátil.

---

## 6 · Una advertencia sobre el prototipo publicado

El prototipo que estás viendo como artifact **no puede conectarse a Firebase**: esa página solo
admite lo que lleva dentro, y cualquier conexión a un servidor externo queda bloqueada. La conexión
real vive en el proyecto Next.js.

Así que el plan es: el prototipo sigue con almacenamiento local para probar diseño y flujos, y
Firestore entra en cuanto montemos Next.js. El modelo y las reglas de este documento valen para los dos.
