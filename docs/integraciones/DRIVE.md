# Google Drive: dónde viven los apuntes

Archicel va a tener **una página por asignatura**, y en cada una sus apuntes: fotos de pizarra,
PDFs de teoría, láminas escaneadas, un `.docx` de los que manda un profesor. Los bytes no caben en
Firestore y no deben estar ahí; van a Google Drive.

Este documento es el planteamiento completo: qué permiso hace falta y por qué ese y no otro, de
quién son los ficheros, cómo encaja con el almacén que ya existe, qué hay que tocar, y qué tiene que
hacer Cristian en la consola de Google.

**Estado: fases 1 y 2 escritas.** Lo único que queda es aceptar el consentimiento de Google una
vez desde un navegador de verdad — eso no se puede automatizar, y por eso no está verificado.

---

## 1 · El permiso: lo que pides no existe, y lo que existe es mejor

La petición era «acceso solo a una carpeta llamada Archicel». **Google no ofrece eso.** No hay un
scope de OAuth que diga «esta carpeta y nada más». Las opciones reales son cuatro:

| Scope | Qué da | Sirve aquí |
|---|---|---|
| `drive` | El Drive entero, leer y escribir | **No.** Es justo lo que no quieres |
| `drive.readonly` | El Drive entero, solo leer | No. No podríamos subir nada |
| `drive.appdata` | Una carpeta oculta que el usuario no ve | No. Celeste tiene que poder abrir sus apuntes desde Drive |
| **`drive.file`** | **Solo los ficheros que esta app ha creado** | **Sí** |

`drive.file` funciona al revés de lo que uno espera. No es una carpeta con una valla alrededor: es
que Archicel **solo ve lo que ella misma ha puesto**. Un documento tuyo de hace tres años, una foto,
una factura — para Archicel no es que estén prohibidos, es que **no existen**. No aparecen al listar,
no se pueden leer ni por su identificador, no se pueden borrar.

Y eso lo garantiza Google en su servidor, no una condición escrita en nuestro código. Es la
diferencia entre una puerta cerrada y una habitación que no está en el plano.

### La consecuencia incómoda, dicha antes de que sorprenda

Como el límite es «lo que la app creó» y no «lo que hay en la carpeta», pasan dos cosas que conviene
entender desde el principio:

- **Si Celeste arrastra un PDF suyo dentro de la carpeta Archicel desde Drive, Archicel no lo verá.**
  No lo creó ella. Para meter un fichero que ya está en su Drive hace falta el **Selector de Google**
  (§ 7, fase 3), que es la forma que tiene Google de que el usuario conceda un fichero concreto.
- **Si Celeste mueve un apunte fuera de la carpeta, Archicel lo sigue viendo.** El permiso viaja con
  el fichero, no con su sitio.

O sea: **la carpeta `Archicel` es una comodidad para el humano, no la frontera de seguridad.** La
frontera es `drive.file`. Conviene tenerlo claro porque es lo contrario de lo que sugiere el nombre.

### Qué puede y qué no puede hacer Archicel con ese permiso

| | |
|---|---|
| Crear la carpeta `Archicel` y sus subcarpetas | ✅ |
| Subir, renombrar, mover y borrar **sus** ficheros | ✅ |
| Leer y descargar **sus** ficheros | ✅ |
| Listar el resto del Drive | ❌ Devuelve vacío |
| Abrir un fichero ajeno aunque se sepa su id | ❌ `404` |
| Borrar algo que no subió ella | ❌ `404` |
| Ver correos, fotos, contactos, calendario | ❌ Otros scopes, no se piden |

Y una ventaja que no es menor: **`drive.file` no es un scope sensible ni restringido.** Publicar la
aplicación no obliga a pasar la auditoría de seguridad de Google (CASA), que para `drive` completo
cuesta semanas y dinero.

---

## 2 · De quién son los ficheros

Aquí hay una decisión que condiciona todo lo demás, y una trampa que conviene esquivar antes de
caer en ella.

### La trampa: una cuenta de servicio no sirve

La idea natural es: creo una cuenta de servicio, comparto con ella la carpeta `Archicel`, y la app
sube ahí con una clave del servidor. **No funciona con un Drive personal.**

Las cuentas de servicio **no tienen cuota de almacenamiento propia**, y desde 2024 Google no les
deja poseer ficheros en un *Mi unidad* de cuenta normal. La subida falla con
`Service Accounts do not have storage quota`. La salida oficial es una **unidad compartida**, que
solo existe en Google Workspace de pago.

Así que esa vía está cerrada salvo que el proyecto pase por un Workspace. Mejor saberlo ahora que
después de escribir el cliente entero.

### Lo que sí: Celeste entra con su Google y los apuntes son suyos

Archicel ya tiene acceso con Google (ver [CUENTAS.md](../data/CUENTAS.md)). Sobre esa sesión se pide
**además** el permiso de Drive, y a partir de ahí:

- los ficheros **los crea y los posee ella**;
- ocupan **su** cuota de 15 GB, no la de nadie más;
- **puede abrirlos desde Drive** como cualquier otra cosa suya, sin Archicel de por medio;
- si algún día deja de usar Archicel, **los apuntes se quedan donde están**. No hay rehén.

Eso último importa más de lo que parece para una aplicación que es un regalo: lo que sube no queda
atrapado en ella.

> **Decisión pendiente de Cristian.** El mensaje decía «mi Google Drive». Si los apuntes van al Drive
> de Cristian en vez de al de Celeste, cambian tres cosas: la cuota es la suya, ella no puede abrir
> sus propios apuntes desde su Drive, y hay que compartir la carpeta con permiso de edición — lo que
> obliga a volver a `drive` completo porque un fichero creado por otra persona no entra en
> `drive.file`. **La recomendación es clara: el Drive de Celeste.**

---

## 3 · Cómo encaja con lo que ya hay

La regla de la casa es que la interfaz no habla con el proveedor: habla con un contrato. El almacén
tiene cuatro verbos (`listar`, `guardar`, `borrar`, `escuchar`) y eso es lo que ha permitido pasar de
`localStorage` a Firestore sin que ninguna pantalla se enterase.

Los ficheros merecen el mismo trato, y por el mismo motivo: dentro de un año esto puede ser Drive,
puede ser R2, puede ser Firebase Storage.

### El reparto: los bytes en Drive, la ficha en Firestore

```
Firestore  ──  apuntes/{id}   la ficha: nombre, tipo, tamaño, asignatura, orden, id remoto
Drive      ──  el byte        el PDF, el JPG, el DOCX
```

Firestore nunca guarda un byte de contenido. Drive nunca guarda lógica de la aplicación. Cada uno
hace lo que sabe hacer, y la ficha es lo que los une.

Esto tiene una consecuencia práctica buena: **la página de una asignatura se pinta sin tocar Drive.**
Los nombres, los tipos, las miniaturas y el orden salen de Firestore, que ya es tiempo real y ya
funciona sin conexión. A Drive solo se va al subir, al abrir un fichero y al borrarlo.

### El contrato nuevo: `Archivador`

Cuatro verbos, igual que el almacén, en `src/lib/archivo/archivador.ts`:

```ts
export interface Archivador {
  /** Si se puede usar ahora mismo: hay sesión y hay permiso. */
  disponible(): boolean;
  /** Pide el permiso. Es lo único que enseña una ventana de Google. */
  conectar(): Promise<void>;
  subir(fichero: File, destino: Destino, alAvanzar?: (tanto: number) => void): Promise<Remoto>;
  borrar(remoto: Remoto): Promise<void>;
  /** Una dirección para ver o descargar. Caduca; no se guarda en Firestore. */
  enlace(remoto: Remoto): Promise<string>;
}

/** Dónde va dentro del archivador, en términos del producto y no del proveedor. */
export interface Destino {
  asignatura: ClaveAsignatura;
}

/** Lo que devuelve el proveedor y hay que recordar para volver a encontrarlo. */
export interface Remoto {
  proveedor: 'drive';
  id: string;
}
```

Dos implementaciones desde el primer día, por la misma razón que hay dos almacenes:

- **`archivador-drive`** — el de verdad.
- **`archivador-local`** — guarda en IndexedDB del navegador. Sirve para trabajar sin cuenta, para
  probar sin tocar el Drive de nadie, y para que la pantalla de una asignatura **no dependa de que
  el permiso esté concedido**. Sin él, la primera pantalla que ve alguien sin conectar Drive es un
  error, y eso es exactamente lo que esta aplicación no puede permitirse.

### La carpeta, en Drive

```
Archicel/
  Apuntes/
    Geometría Descriptiva I/
    Física Aplicada I/
    Dibujo Arquitectónico I/
```

Con el **nombre largo** de la asignatura y no con su clave interna: quien abra esto desde Drive tiene
que entender qué está mirando sin saber que existe un fichero `curso.ts`.

Los identificadores de esas carpetas se guardan en los ajustes del almacén, no se buscan cada vez.
Buscar una carpeta por nombre en cada subida es una llamada de más y, peor, se rompe el día que
alguien renombra la carpeta desde Drive.

---

## 4 · Cómo se sube, y por qué no por nuestro servidor

**El navegador sube directamente a Google.** Archicel no ve pasar el fichero.

No es una preferencia estética, hay dos razones duras:

1. **Vercel corta el cuerpo de una petición en 4,5 MB.** Un PDF de teoría escaneado se pasa de ahí
   sin esfuerzo. Pasar los apuntes por `/api` significa que el día que suba una lámina en alta se
   rompe, y se rompe con un error que no dice por qué.
2. **Lo que no pasa por nuestro servidor no puede filtrarse desde nuestro servidor.** Los apuntes van
   del portátil de Celeste a su Drive. Ese es el camino más corto y el que menos confianza exige.

Para eso el token de acceso tiene que estar en el navegador. **Y es aceptable precisamente por
`drive.file`**: aunque alguien lo robase, ese token no abre nada más que los ficheros de Archicel.
Con `drive` completo esta decisión sería indefendible; con `drive.file` es la correcta.

### Subida reanudable, no de un tirón

Un `multipart` de una sola petición vale hasta unos 5 MB. Por encima hay que usar la **subida
reanudable** de Drive: se pide una URL de sesión, se mandan trozos, y si se cae la conexión se
continúa donde iba en vez de empezar de cero.

Como además da el progreso por trozo, es lo que alimenta la barra de la interfaz. Se implementa una
vez, en `archivador-drive`, y ninguna pantalla sabe que existe.

### El token: Google Identity Services, no Firebase

Firebase devuelve un token de Google al entrar con `signInWithPopup`, pero **no devuelve un token de
refresco** y el de acceso dura una hora. Apoyarse en eso significa que a la hora de estar trabajando
deja de subir.

La forma correcta es el **cliente de tokens de Google Identity Services** en el navegador:

- pide el permiso de Drive **aparte** de la sesión y solo cuando hace falta — la primera vez que
  Celeste sube algo, no al entrar. Un permiso que se pide en el momento en que se entiende para qué
  es, se concede; uno que salta al abrir, se cierra;
- renueva el token en silencio cuando caduca, sin volver a preguntar;
- **no necesita secreto de cliente**, así que no hay nada que guardar en el servidor ni que se pueda
  filtrar de él.

---

## 5 · El modelo de datos

Una colección nueva. En `tipos.ts`:

```ts
export interface Apunte {
  id: ID;
  asignatura: ClaveAsignatura;
  /** El nombre tal cual lo trae el fichero. Se pinta como texto, nunca como HTML. */
  nombre: string;
  /** El tipo MIME: `application/pdf`, `image/jpeg`… */
  tipo: string;
  /** Bytes. Para decir "2,4 MB" sin preguntar a Drive. */
  tam: number;
  remoto: Remoto;
  /** Miniatura de Drive, si la hay. Es una URL que caduca: se refresca, no se confía. */
  minia?: string;
  /** Para ordenar a mano dentro de la asignatura. */
  orden?: number;
  creado: number;
}
```

Y **la regla que no se salta**, en `firestore.rules`:

```js
function estaValidada(coleccion) {
  return coleccion in ['eventos', 'tareas', 'ajustes', 'layout', 'apuntes'];
}
```

Está escrita en [CLAUDE.md](../../CLAUDE.md) y se repite aquí porque es el paso que se olvida: los
`match` de Firestore **se suman**, no se encadenan. Sin añadir `apuntes` a esa lista, el comodín del
final deja entrar cualquier cosa saltándose la validación de forma.

Más su `match` propio con las comprobaciones de siempre: que `asignatura` sea una de las conocidas,
que `nombre` tenga tope de longitud, que `tam` sea un número positivo con techo.

### Lo que Firestore no guarda nunca

- **El contenido.** Obvio, pero conviene escribirlo.
- **Enlaces de descarga.** Caducan. Un enlace guardado es un enlace roto dentro de una hora, y peor:
  si no caducara, sería una dirección pública a un apunte, guardada en un sitio donde nadie espera
  encontrar una.

---

## 6 · Las pantallas

Ruta nueva: **`/asignatura/[clave]`**, una por cada entrada de `ASIGNATURAS`.

Se llega desde el horario —pulsando una clase— y desde la leyenda de colores. **Es un detalle del
horario**, igual que `/dia` lo es del calendario, así que entra en el sistema de movimiento por la
puerta que ya existe (ver [MOVIMIENTO.md](../frontend/MOVIMIENTO.md) § 3):

```ts
// en movimiento.ts
const DENTRO_DE: Record<string, string> = {
  '/dia': '/calendario',
  '/asignatura': '/horario',   // ← entra con escala, no cruzando de lado
};
```

Sin esa línea, ir del horario a una asignatura sale con el gesto neutro mientras el agua del dock no
se mueve: se lee como un fallo.

La página, por partes —cada una un `variants={PIEZA}` y nada más, que es lo que hace que lleguen
escalonadas sin tocar un número:

1. **La portada.** Nombre, código, color de la asignatura, horas de clase a la semana sacadas del
   horario. Es lo que hace que la página sea *de esa asignatura* y no una lista con un título.
2. **Lo que viene.** Las entregas y exámenes de esa asignatura, del calendario que ya existe.
3. **Los apuntes.** Rejilla de tarjetas con miniatura, o lista cuando son muchos. Arrastrar ficheros
   encima para subir.
4. **El visor.** Las imágenes se ven dentro; los PDF se ven dentro; un `.docx` se abre en Google
   Docs en otra pestaña, que es lo único razonable sin convertir nada.

---

## 7 · Qué necesito de ti

Todo esto es en la **consola de Google Cloud**, con la cuenta de Google que vaya a ser la dueña del
proyecto. Es gratis y no hace falta tarjeta.

### 1 · Un proyecto

[console.cloud.google.com](https://console.cloud.google.com) → crear proyecto → nombre `Archicel`.

Puede ser el mismo proyecto que ya usa Firebase (`archicel-39`), y de hecho es lo más cómodo: menos
cosas que mantener.

### 2 · Activar la API de Drive

*APIs y servicios* → *Biblioteca* → **Google Drive API** → Habilitar.

(La *Google Picker API* solo hace falta para la fase 3, cuando se pueda adjuntar un fichero que ya
esté en el Drive. Se puede activar luego.)

### 3 · La pantalla de consentimiento

*APIs y servicios* → *Pantalla de consentimiento de OAuth*:

- Tipo: **Externo**
- Nombre de la aplicación: **Archicel** — esto es lo que Celeste va a leer en la ventana de permiso,
  así que conviene que diga lo que es
- Correo de asistencia y de contacto: el tuyo
- **Permisos:** añadir **uno solo** → `.../auth/drive.file`
- **Usuarios de prueba:** el correo de Celeste y el tuyo

Déjalo en **modo de prueba** para empezar. Con `drive.file` y dos usuarios es suficiente, y publicar
no exige auditoría de seguridad el día que haga falta.

### 4 · Las credenciales

*APIs y servicios* → *Credenciales* → *Crear credenciales* → **ID de cliente de OAuth**:

- Tipo: **Aplicación web**
- Nombre: `Archicel web`
- **Orígenes de JavaScript autorizados** — los tres:
  ```
  https://archicel.vercel.app
  http://localhost:3000
  http://localhost:3100
  ```
- **URI de redirección:** ninguno. El flujo de tokens del navegador no los usa.

### 5 · Lo que me pasas, y cómo

Solo esto:

```
NEXT_PUBLIC_GOOGLE_CLIENT_ID = 1234567890-abc...apps.googleusercontent.com
```

Va en `.env.local` y en las variables de Vercel. **Lleva `NEXT_PUBLIC_` a propósito y no pasa nada:**
un ID de cliente es público por diseño, viaja en cada petición de OAuth y lo puede leer cualquiera
que abra la página. Lo que lo protege es la lista de orígenes autorizados del paso 4 — por eso ese
paso no es opcional.

**El secreto de cliente no hace falta. No me lo pases, no lo escribas en ningún sitio y no lo pegues
en esta conversación.** Si la consola te lo enseña, ignóralo.

Cuando lo tengas, ponlo en `.env.local` tú y dime «puesto». Igual que con los demás.

---

## 8 · Por fases

| Fase | Qué entra | Sirve para |
|---|---|---|
| **1** ✅ | `Archivador` + `archivador-local` + la página de asignatura entera | **Hecha.** Todo el diseño y toda la animación funcionando **sin tocar Google** |
| **2** ✅ | `archivador-drive`, conectar, subir reanudable, borrar, visor | **Escrita.** Falta que una persona acepte la ventana de consentimiento una vez |
| **3** | Selector de Google, miniaturas, orden a mano, búsqueda | Adjuntar lo que ya esté en su Drive, y que la pantalla aguante doscientos apuntes |

La fase 1 no es relleno: es lo que permite que el día que llegue el ID de cliente solo haya que
enchufar una implementación detrás de un contrato que ya está probado. Y si Drive acaba no
convenciendo, la fase 1 sigue en pie con otro proveedor detrás.

---

## 9 · Lo que puede salir mal

- **La cuota.** 15 GB los comparten Drive, Gmail y Fotos. Los apuntes de un curso de arquitectura
  escaneados llegan ahí antes de lo que parece. La pantalla debe decir cuánto queda —Drive lo
  informa— y no descubrirlo con una subida fallida.
- **El límite de subidas de Drive**, 750 GB al día por cuenta. Irrelevante aquí, pero escrito para no
  buscarlo dos veces.
- **La ventana de permiso puede volver a salir.** En modo de prueba, y a veces también publicado.
  No es un error: la interfaz tiene que tratarlo como algo normal y no como una caída.
- **El nombre del fichero lo escribe quien sea.** Un apunte llamado `<img onerror=…>.pdf` se pinta
  como texto y nunca como HTML. Es la primera regla de [SEGURIDAD.md](../data/SEGURIDAD.md) y aquí
  entra contenido de fuera por primera vez desde que existe el proyecto.
- **Borrar en Archicel manda el fichero a la papelera de Drive, no lo destruye.** Es lo correcto
  —treinta días para arrepentirse— pero hay que decirlo en la interfaz, porque «eliminar» sugiere
  otra cosa. Y al revés: si Celeste lo borra desde Drive, la ficha de Firestore se queda huérfana.
  La lista tiene que sobrevivir a eso: un apunte que ya no está se enseña apagado y con un botón para
  quitarlo, no rompe la pantalla.
