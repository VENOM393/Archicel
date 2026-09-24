# Google Drive: dónde viven los apuntes

Archicel tiene **una página por asignatura**, y en cada una sus apuntes: fotos de pizarra, PDFs de
teoría, láminas escaneadas, un `.docx` de los que manda un profesor. Los bytes no caben en Firestore
y no deben estar ahí; van a Google Drive.

Este documento es el planteamiento completo: qué permiso hace falta y por qué ese y no otro, de
quién son los ficheros, cómo encaja con el almacén que ya existe, qué hay que tocar, y qué tiene que
hacer Cristian en la consola de Google.

**Estado: funcionando.** Subida (reanudable de verdad), visor, borrado con confirmación, carpetas,
renombrar y mover contra Drive real. El § 10 recoge lo que arregló la segunda pasada, cómo se
verificó, lo medido y lo que queda.

**Cada persona conecta su propio Drive** — la conexión vive en el navegador, no en la cuenta de
Archicel. Y **no hace falta secreto de cliente**: a cambio, la sesión de Drive dura una hora en vez
de ser permanente. Dentro de la hora, recargar no pide nada. Pasada la hora, con la pestaña abierta,
la siguiente acción la renueva; si se recarga la página ya caducada, la pantalla vuelve a «Sin
conectar» y hay que pulsar **Conectar Drive** (§ 4). El porqué está en CLAUDE.md.

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
  (§ 8, fase 3), que es la forma que tiene Google de que el usuario conceda un fichero concreto.
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

El permiso de Drive se pide **aparte** del acceso a Archicel (ver [CUENTAS.md](../data/CUENTAS.md)):
no cuelga de esa sesión, se puede conceder sin haber entrado con ninguna cuenta y lo concede la
cuenta de Google que se elija en la ventana. Celeste conecta la suya, y a partir de ahí:

- los ficheros **los crea y los posee ella**;
- ocupan **su** cuota de 15 GB, no la de nadie más;
- **puede abrirlos desde Drive** como cualquier otra cosa suya, sin Archicel de por medio;
- si algún día deja de usar Archicel, **los apuntes se quedan donde están**. No hay rehén.

Eso último importa más de lo que parece para una aplicación que es un regalo: lo que sube no queda
atrapado en ella.

> **Decidido: cada persona conecta su propio Drive.** Era la recomendación frente a usar el Drive de
> Cristian, que habría obligado a compartir la carpeta con permiso de edición y a volver a `drive`
> completo. La cabecera de la pantalla dice **de quién** es el Drive conectado («En el Drive de
> …», sacado de `drive/v3/about`), porque con dos cuentas de Google abiertas es fácil conceder con
> la que no era. Lo que pasa si algún día comparten cuenta de Archicel está en CLAUDE.md.

---

## 3 · Cómo encaja con lo que ya hay

La regla de la casa es que la interfaz no habla con el proveedor: habla con un contrato. El almacén
tiene cuatro verbos (`listar`, `guardar`, `borrar`, `escuchar`) y eso es lo que ha permitido pasar de
`localStorage` a Firestore sin que ninguna pantalla se enterase.

Los ficheros merecen el mismo trato, y por el mismo motivo: dentro de un año esto puede ser Drive,
puede ser R2, puede ser Firebase Storage.

### El reparto: los bytes en Drive, la ficha en Firestore

```
Firestore  ──  apuntes/{id}    la ficha: nombre, tipo, tamaño, asignatura, carpeta, orden, remoto
               carpetas/{id}   el árbol: nombre, asignatura, madre, remoto
Drive      ──  el byte         el PDF, el JPG, el DOCX — y la carpeta equivalente
```

Firestore nunca guarda un byte de contenido. Drive nunca guarda lógica de la aplicación. Cada uno
hace lo que sabe hacer, y la ficha es lo que los une.

Esto tiene una consecuencia práctica buena: **la página de una asignatura se pinta sin tocar Drive.**
Los nombres, los tipos y el orden salen del almacén, que ya es tiempo real y ya funciona sin
conexión. A Drive solo se va al subir, al abrir un fichero, al borrarlo y al organizar (crear
carpeta, renombrar, mover). Al cargar, con Drive conectado, hay dos llamadas y ninguna escribe:
`about`, para saber de quién es el Drive, y **una búsqueda** de la carpeta de la asignatura, para
que la primera subida no tenga que esperarla (§ 3, «La carpeta, en Drive»).

Sin sesión de Archicel las fichas viven en el almacén del navegador y los bytes siguen yendo a Drive.
**Ojo:** al entrar con una cuenta, la migración a la nube **no se lleva ni apuntes ni carpetas**
(§ 10).

### El contrato: `Archivador`

En `src/lib/archivo/archivador.ts`. Empezó con cuatro verbos, como el almacén, y creció con la
organización:

```ts
export interface Archivador {
  readonly nombre: 'local' | 'drive';
  /** Si se puede usar ahora mismo, sin pedir nada a nadie. */
  disponible(): boolean;
  /** Pide el permiso. Es lo único que puede abrir una ventana de Google. */
  conectar(): Promise<void>;
  /** Reintentar el mismo `File` tras un corte sigue donde se quedó, al destino de la primera vez. */
  subir(fichero: File, destino: Destino, alAvanzar?: (tanto: number) => void): Promise<Remoto>;
  crearCarpeta(nombre: string, destino: Destino): Promise<Remoto>;
  renombrar(remoto: Remoto, nombre: string): Promise<void>;
  /** Drive no mueve: quita un padre y pone otro. Por eso hace falta `desde`. */
  mover(remoto: Remoto, desde: Remoto | null, hasta: Remoto | null, destino: Destino): Promise<void>;
  /** Solo resuelve si el proveedor lo confirmó (un «ya no estaba» cuenta). Si falla, lanza. */
  borrar(remoto: Remoto): Promise<void>;
  /** Los bytes, con los parciales según llegan. La dirección `blob:` la hace quien pinta. */
  leer(remoto: Remoto, opciones?: { tipo?: string; tam?: number;
       alAvanzar?: (hastaAhora: Blob, tanto: number) => void }): Promise<Blob>;
}

/** Dónde va, en términos del producto y no del proveedor. */
export interface Destino {
  asignatura: string;
  /** La carpeta de dentro, si la hay. Sin ella, la raíz de la asignatura. */
  padre?: Remoto;
}

/** Dónde están los bytes: `Apunte['remoto']`. */
type Remoto = { proveedor: 'local' | 'drive'; id: string };
```

Los fallos salen como `FalloDeArchivo` con una `causa` —`sin-conexion`, `caducada`,
`sin-permiso`, `api-apagada`, `limite`, `sin-sitio`, `no-esta`, `sin-carpeta`, `red`,
`servidor`, `desconocida`— y un `detalle` con el código HTTP, la **razón** estructurada de Drive y
**lo que dijo**, tal cual. La pantalla traduce la causa con `explicar()` (`src/lib/archivo/explicar.ts`)
en motivo, arreglo y el texto de Drive (tabla en § 4). Cada causa existe porque su arreglo es
distinto.

Dos implementaciones, y un encaminador delante (`src/lib/archivo/index.ts`):

- **`archivador-drive`** — el de verdad. **Todo lo nuevo va aquí**: subir y crear carpeta exigen
  Drive y, si no se puede, fallan con nombre. No hay caída al disco.
- **`archivador-local`** — IndexedDB del navegador. Fue la fase 1 y hoy **solo sirve para abrir y
  borrar** lo que se guardó ahí antes de que las subidas fueran solo a Drive. Nada nuevo va a parar
  a él.
- **El encaminador** manda según el `proveedor` que lleve cada apunte al abrir, borrar, renombrar y
  mover. Es lo que hace que lo antiguo siga abriéndose.

### La carpeta, en Drive

```
Archicel/
  Asignaturas/
    Geometría Descriptiva I/
    Física Aplicada I/
    Dibujo Arquitectónico I/
```

Con el **nombre largo** de la asignatura y no con su clave interna: quien abra esto desde Drive tiene
que entender qué está mirando sin saber que existe un fichero `curso.ts`.

Dentro de cada asignatura, las carpetas que haya creado la usuaria desde Archicel.

Los identificadores de esas tres carpetas fijas **no se guardan en ningún sitio**: se buscan por
nombre, **las tres en una sola consulta** (todas las carpetas que se llamen `Archicel` en la raíz,
`Asignaturas`, `Apuntes` o como la asignatura, y el árbol se reconstruye siguiendo los padres; la
más antigua gana). Se buscan al abrir la página —sin crear nada: crear carpetas en el Drive de
alguien por abrir una página sería tocarlo sin que haya hecho nada— y se recuerdan en memoria **como
promesa**, de modo que cinco subidas a la vez esperan a la misma búsqueda y no crean cinco
`Archicel`. Lo que falte se crea en la primera escritura. Con `drive.file` la búsqueda solo devuelve
lo que creó la aplicación, así que no se confunde con una carpeta de Celeste que se llame igual.
Consecuencias:

- **Si alguien renombra o mueve `Archicel` desde Drive**, la siguiente pestaña no la encuentra y crea
  otra nueva. Lo ya subido sigue abriéndose —la ficha guarda el id, no la ruta— pero lo nuevo va a la
  carpeta nueva.
- **La primera vez**, si existe `Archicel/Apuntes` (el nombre antiguo), se renombra a `Asignaturas`
  en vez de crear una segunda.
- **Si se borra una carpeta fija a mitad de sesión**, la primera escritura que se tropiece con el
  identificador muerto (un 404 que nombra la carpeta de destino) lo olvida, busca o crea la ruta
  otra vez y **repite una vez**, sin recargar. Si la que falta es una carpeta de la usuaria no hay
  nada que recrear, y la tira dice «La carpeta «Tema 3» ya no está en tu Drive».

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

Hasta 5 MB se sube con un `multipart` de una sola petición. Por encima se usa la **subida
reanudable** de Drive: se pide una URL de sesión y se mandan trozos de 8 MB. Las dos van con
`XMLHttpRequest`, que es lo que da el progreso real a la barra (`fetch` no informa de la subida).
Una tanda sube **de tres en tres**.

**Y reanuda de verdad:**

- Tras cada trozo, Drive contesta 308 con `Range: bytes=0-N`: lo que tiene **de verdad**, que puede
  ser menos de lo enviado. El siguiente trozo sale de ahí.
- Tras un corte, un 5xx o un límite, se espera (1, 2, 4… s, hasta seis veces, ~1 min) y se
  **pregunta** cuánto llegó (`PUT` con `Content-Range: bytes */total` y cuerpo vacío) en vez de
  suponerlo.
- Si aun así se rinde, la sesión se queda recordada **por `File`** (un `WeakMap`), y como la tira
  guarda el mismo `File`, «Reintentar» pregunta a la misma sesión y sigue: al mismo destino que la
  primera vez y sin reenviar lo que ya estaba. Si la sesión caducó (404/410), se abre otra.
- Si el navegador no dejara leer `Range` (Google la expone, pero una respuesta de otro origen solo
  enseña las cabeceras declaradas), tras enviar un trozo se da por recibido entero —suponer cero
  repetiría el mismo trozo para siempre—; en una consulta, sin `Range` es cero, que es lo que dice
  el protocolo.

### Cuando Drive dice que no

Se clasifica por la **razón estructurada** (`error.errors[].reason` y `error.details[].reason`),
nunca buscando palabras en el texto. La pantalla enseña el motivo, **lo que dijo Drive** y el
arreglo:

| Drive | Causa | Qué pasa |
|---|---|---|
| 401, `authError` | `caducada` | Se tira el token; «Reconectar y reintentar» pide otro |
| 403 `accessNotConfigured` / `SERVICE_DISABLED` | `api-apagada` | «Actívala en la consola…» — reconectar no lo arregla |
| 403 `insufficientPermissions` / `ACCESS_TOKEN_SCOPE_INSUFFICIENT` | `sin-permiso` | Reconectar dejando marcada la casilla de Drive |
| 403 `appNotAuthorizedToFile` / `insufficientFilePermissions` | `sin-permiso` | Es de otra cuenta: mirar de quién es el Drive conectado |
| 403 `domainPolicy` | `sin-permiso` | La organización no deja: cuenta personal |
| 403 `storageQuotaExceeded` | `sin-sitio` | Vaciar la papelera de Drive o liberar espacio |
| 429, 403 `rateLimitExceeded` / `userRateLimitExceeded` | `limite` | **Se reintenta solo** (1, 2, 4 s); si sigue, «espera un minuto» |
| 403 `dailyLimitExceeded` | `limite` | No se reintenta: «mañana» |
| 404 del destino | `sin-carpeta` | Carpeta fija: se recrea y se repite. De la usuaria: se dice cuál |
| 404 del propio fichero | `no-esta` | Al borrar, cuenta como hecho |
| 5xx | `servidor` | Se reintenta solo si repetir no duplica (no en un `POST` que crea) |
| corte | `red` | Igual que 5xx |

Los reintentos pasan en `llamar()` (`archivador-drive.ts`) con espera exponencial y un poco de
azar, respetando `Retry-After` si llega.

### El token: Google Identity Services, no Firebase

Firebase devuelve un token de Google al entrar con `signInWithPopup`, pero **no devuelve un token de
refresco** y el de acceso dura una hora. Apoyarse en eso significa que a la hora de estar trabajando
deja de subir.

La forma correcta es el **cliente de tokens de Google Identity Services** en el navegador
(`src/lib/archivo/google.ts`, el único fichero que sabe de OAuth):

- pide el permiso de Drive **aparte** de la sesión y solo cuando ella lo pide: sin Drive conectado,
  la acción sólida de la pantalla es **Conectar Drive** y «Subir» y «Carpeta» se deshabilitan. Nada
  salta al abrir la página;
- **recuerda el token** en `localStorage` (`archicel.drive.token.v1`) hasta su caducidad, con dos
  minutos de margen para que no caduque a mitad de una subida;
- **renueva desde un gesto, no en silencio.** `requestAccessToken` abre siempre una ventana, y una
  ventana que no nace de un clic la bloquea el navegador. Con el consentimiento ya dado se abre y se
  cierra sin enseñar nada, pero se abre. Por eso con la pestaña abierta la siguiente acción renueva
  sola, y tras recargar ya caducado hay que pulsar Conectar Drive;
- **no necesita secreto de cliente**, así que no hay nada que guardar en el servidor ni que se pueda
  filtrar de él. A cambio, no hay `refresh_token`.

---

## 5 · El modelo de datos

Dos colecciones. En `tipos.ts`:

```ts
export interface Apunte {
  id: ID;
  /** La clave de la asignatura en el catálogo del curso. */
  asignatura: string;
  /** El nombre tal cual lo trae el fichero. Se pinta como texto, nunca como HTML. */
  nombre: string;
  /** El tipo MIME: `application/pdf`, `image/jpeg`… Vacío si el sistema no lo supo decir. */
  tipo: string;
  /** Bytes. Para decir "2,4 MB" sin preguntar a Drive. */
  tam: number;
  remoto: { proveedor: 'local' | 'drive'; id: string };
  /** En qué carpeta está. Vacío significa la raíz de la asignatura. */
  carpeta?: ID;
  /** Para ordenar a mano. Hoy no hay interfaz que lo escriba. */
  orden?: number;
  creado?: number;
  actualizado?: number;
}

export interface Carpeta {
  id: ID;
  asignatura: string;
  /** Dentro de qué otra carpeta está. Vacío significa la raíz de la asignatura. */
  madre?: ID;
  nombre: string;
  remoto: { proveedor: 'local' | 'drive'; id: string };
  creado?: number;
  actualizado?: number;
}
```

En Firestore los apuntes se ordenan por `creado` y las carpetas por `nombre`: una consulta con
`orderBy` sobre un campo que el documento no tiene lo excluye sin avisar (CLAUDE.md).

Y **la regla que no se salta**, en `firestore.rules`:

```js
function estaValidada(coleccion) {
  return coleccion in ['eventos', 'tareas', 'apuntes', 'carpetas', 'ajustes', 'layout'];
}
```

Está escrita en [CLAUDE.md](../../CLAUDE.md) y se repite aquí porque es el paso que se olvida: los
`match` de Firestore **se suman**, no se encadenan. Sin `apuntes` y `carpetas` en esa lista, el
comodín del final deja entrar cualquier cosa saltándose la validación de forma.

Cada una tiene además su `match` propio. Lo que comprueba, sin adornos: que `asignatura` y `nombre`
no estén vacíos y tengan tope de longitud (120 y 300 en apuntes, 120 y 200 en carpetas), que `tam`
sea un entero entre 0 y 2 GB, que `remoto` sea un mapa con `proveedor` `local` o `drive` y un `id`
de hasta 300, y que `carpeta`/`madre` sean texto corto. **No comprueba** que la asignatura sea una
de las del catálogo ni que la carpeta madre exista — Firestore no sigue referencias al validar.

### Lo que Firestore no guarda nunca

- **El contenido.** Obvio, pero conviene escribirlo.
- **Enlaces de descarga.** Caducan. Un enlace guardado es un enlace roto dentro de una hora, y peor:
  si no caducara, sería una dirección pública a un apunte, guardada en un sitio donde nadie espera
  encontrar una.

---

## 6 · Las pantallas

Ruta: **`/asignatura/[clave]`**, una por cada entrada de `ASIGNATURAS`, generadas en la
construcción (`generateStaticParams`, `dynamicParams = false`: una clave inventada es un 404).

Se llega desde el horario —pulsando una clase— y desde la leyenda de colores. **Es un detalle del
horario**, igual que `/dia` lo es del calendario, así que entra en el sistema de movimiento por la
puerta que ya existe (ver [MOVIMIENTO.md](../frontend/MOVIMIENTO.md) § 3):

```ts
// en movimiento.ts
const DENTRO_DE: Record<string, string> = {
  '/dia': '/calendario',
  '/asignatura': '/horario',   // ← entra con escala, no cruzando de lado; resuelve por prefijo
};
```

Sin esa línea, ir del horario a una asignatura sale con el gesto neutro mientras el agua del dock no
se mueve: se lee como un fallo.

La página (`src/components/Asignatura.tsx`), por partes —cada una un `variants={PIEZA}` y nada más,
que es lo que hace que lleguen escalonadas sin tocar un número:

1. **La portada.** Nombre, código, horas de clase a la semana y número de apuntes, y la semana
   dibujada con las clases de esa asignatura. Es lo que hace que la página sea *de esa asignatura*.
2. **Lo que viene.** Hasta cuatro entregas y exámenes de esa asignatura, de hoy en adelante, del
   calendario que ya existe. Si no hay ninguno, la pieza no se pinta.
3. **Los apuntes.** Una **lista** —no una rejilla, y sin miniaturas— con carpetas primero y
   apuntes después; migas de pan arriba («Apuntes › Tema 3»), que también sirven de diana para
   sacar algo arrastrándolo hacia arriba. Arrastrar ficheros del disco encima sube a la carpeta en
   la que se está. Cada fila de Drive lleva un enlace **Verlo en tu Drive**.
4. **El visor.** Las imágenes que el navegador sabe pintar (no `.heic` ni `.tif`), PDF y vídeo se
   ven dentro; el resto (`.docx`, planos, modelos…) ofrece **Descargar**. Un `<img>` o un `<iframe>`
   no saben mandar la cabecera de autorización, así que el fichero se baja con `fetch` **leyendo el
   flujo**: cada ~200 ms se entrega un `Blob` con lo recibido (`Blob` de `Blob`, que no copia), una
   imagen se va pintando de arriba abajo, y lo demás enseña «Abriendo… 12 de 40 MB» con una línea de
   progreso. Descargar solo aparece con el fichero entero. Lo abierto se recuerda en memoria (96 MB,
   32 por fichero), y **posarse 120 ms sobre una fila** precarga lo de hasta 8 MB con el token
   vigente. Va a `body` por un portal, igual que la pregunta de borrar (§ 9).

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
| **1** ✅ | `Archivador` + `archivador-local` + la página de asignatura entera | **Hecha.** El diseño y la animación funcionaron **sin tocar Google**. Hoy lo local solo abre y borra lo antiguo |
| **2** ✅ | `archivador-drive`, conectar, subir por trozos, borrar, visor, token recordado | **Funcionando** contra Drive real |
| **2b** ✅ | Carpetas, renombrar, mover (arrastrando), cabecera con la cuenta, tira de fallos con reintento, iconos por tipo | **Funcionando** |
| **2c** ✅ | Borrar con confirmación y sin perder fichas, errores por razón de Drive con reintento, subida que reanuda, visor por flujo, carpetas en una consulta | **Funcionando**, verificado con Drive simulado (§ 10) |
| **3** | Selector de Google, miniaturas, orden a mano, búsqueda | Adjuntar lo que ya esté en su Drive, y que la pantalla aguante doscientos apuntes |

La fase 1 no fue relleno: es lo que permitió que el día que llegó el ID de cliente solo hubiera que
enchufar una implementación detrás de un contrato ya probado. Y si Drive acaba no convenciendo, el
contrato sigue en pie con otro proveedor detrás.

---

## 9 · Lo que puede salir mal

- **La cuota.** 15 GB los comparten Drive, Gmail y Fotos. Los apuntes de un curso de arquitectura
  escaneados llegan ahí antes de lo que parece. La pantalla debería decir cuánto queda —Drive lo
  informa— y no descubrirlo con una subida fallida. **Hoy no lo dice**: se descubre con la tira de
  fallos («No queda espacio en tu Drive»).
- **El límite de subidas de Drive**, 750 GB al día por cuenta. Irrelevante aquí, pero escrito para no
  buscarlo dos veces.
- **La ventana de permiso puede volver a salir.** En modo de prueba, y a veces también publicado.
  No es un error: la interfaz tiene que tratarlo como algo normal y no como una caída.
- **El nombre del fichero lo escribe quien sea.** Un apunte llamado `<img onerror=…>.pdf` se pinta
  como texto y nunca como HTML. Es la primera regla de [SEGURIDAD.md](../data/SEGURIDAD.md) y aquí
  entra contenido de fuera por primera vez desde que existe el proyecto.
- **Borrar en Archicel manda el fichero a la papelera de Drive, no lo destruye**, y la interfaz lo
  dice: siempre hay una pregunta —«Irá a la papelera de tu Drive, y desde allí se puede recuperar
  durante 30 días»— y el aviso es «En la papelera de Drive». Una carpeta se pregunta una vez para
  todo el árbol. La pregunta y el visor se pintan en `body` por un portal: el panel lleva
  `backdrop-filter`, que encierra todo lo `fixed` de dentro.
- **Si Celeste lo borra desde Drive, la ficha se queda huérfana.** La pantalla sobrevive: al
  abrirlo, el visor dice «Ya no está en tu Drive» con el texto de Drive y dónde mirar, y borrar la
  fila quita la ficha (un 404 al mandar a la papelera cuenta como hecho). Lo que no hay es la marca
  previa: la fila no se enseña apagada hasta que se intenta abrir.

---

## 10 · Lo que se arregló, cómo se comprobó y lo que queda

La auditoría del 24 de septiembre de 2026 dejó aquí una lista de fallos con fichero y línea. La
segunda pasada, ese mismo día, los arregló todos menos los que eran de otra tarea. **Todo lo
marcado (visto) se reprodujo en el navegador** contra `npm run build && npm start`, a escritorio
(1440×900), con Drive simulado: token falso, el cliente de Google sustituido, y cada respuesta de
`googleapis.com` servida por un Drive falso en memoria que entiende las consultas, las carpetas, la
papelera, las subidas `multipart` y las reanudables con su `Range`, y al que se le inyectan fallos
con el cuerpo de error que manda Drive de verdad.

### Arreglado

**Riesgo de perder o descolocar apuntes**

- **Borrar ya no se traga el fallo de Drive (visto).** La ficha solo se borra cuando Drive confirma
  la papelera (o dice que ya no estaba). Con un 503 persistente: tres reintentos (1, 2, 4 s), la
  fila apagada con «A la papelera…», y después la ficha **sigue**, el fichero sigue fuera de la
  papelera y la tira dice «Drive no responde ahora mismo (503)» con el texto de Drive y
  «Reintentar», que con Drive sano lo manda a la papelera y quita la ficha.
- **Borrar pregunta siempre (visto)**, apunte o carpeta, y dice que va a la papelera de Drive y se
  recupera durante 30 días. Cancelar y Escape no tocan nada (cero peticiones). Lo antiguo del
  navegador dice que no tiene vuelta atrás y el foco empieza en «Cancelar».
- **Una carpeta con subcarpetas se pregunta una vez (visto)** —«2 carpetas y 4 apuntes»— y va a la
  papelera con **una** llamada: en Drive la carpeta se lleva todo lo de dentro. Si esa llamada
  falla, no se borra ninguna ficha: ni la carpeta, ni las hijas, ni los apuntes. Nunca queda una
  hija con una madre que ya no existe (`src/lib/archivo/arbol.ts`).
- **La ficha rechazada después de subir ya no se confunde con una subida fallida.** La tira dice
  «Está en tu Drive, pero Archicel no pudo apuntarlo», y reintentar solo vuelve a apuntarla. El caso
  que la auditoría encontró —nombre de más de 300 caracteres— ya no llega ahí **(visto)**: la ficha
  acorta el nombre por el medio conservando la extensión, y en Drive se queda entero. *La rama de
  «ficha rechazada» en sí no se ha visto*: el almacén local nunca rechaza (se traga sus errores) y
  sin sesión no hay Firestore que lo haga.

**Errores que ahora dicen la verdad**

- **Cada 403 con su diagnóstico (visto):** API apagada (con su texto «has not been used in
  project…» y el paso de la consola), permiso sin Drive, fichero de otra cuenta, política de la
  organización, cuota llena, límite diario. Cada uno con su arreglo; solo los que se arreglan
  reconectando ofrecen «Reconectar y reintentar».
- **El límite de peticiones ya no es «no queda espacio» (visto).** Se clasifica por la razón
  (`userRateLimitExceeded`, `rateLimitExceeded`, 429), se reintenta solo con espera exponencial
  (dos 429 seguidos y el tercero bien: sin tira, ~4 s) y, si no cede, «Drive está recibiendo
  demasiadas peticiones… espera un minuto».
- **401 = sesión caducada, y reconectar funciona (visto).** Se tira el token recordado; «Reconectar y
  reintentar» pidió uno nuevo a Google una vez y la subida entró.
- **Un 404 dice qué falta (visto).** Carpeta de la usuaria borrada desde Drive: «La carpeta «Tema 3»
  ya no está en tu Drive». Carpeta de la asignatura borrada a mitad de sesión: se olvida el id
  recordado, se busca, se crea la nueva y la subida entra en ella, **sin recargar y sin tira**.
  Apunte que ya no existe: el visor lo dice con el texto de Drive.
- **`demasiado-grande` ya no existe** como causa, ni su «enlázalo desde ahí».

**Lo que se decía y no se hacía**

- **Crear carpeta exige Drive**, y ahora es lo decidido, no una contradicción: una carpeta de
  Archicel es una carpeta en Drive. Los comentarios que decían lo contrario se corrigieron.
- **La subida reanudable reanuda (visto):** con Drive aceptando solo 5 de cada 8 MB, los trozos
  siguieron desde el `Range` (0, 5, 10, 15 MB) sin un solo desfase; con un corte de red en el
  segundo trozo, preguntó cuánto había llegado y siguió desde los 8 MB, una sola sesión; con un
  503 en un trozo, igual. Con un corte largo se rindió, y «Reintentar» siguió en la **misma
  sesión**: reenvió 12 MB de 20, no 20, y quedó una sola copia.
- **Los ids de las carpetas fijas se recuperan sin recargar (visto)**: arriba.

**Menores**

- **`.dwg` con `image/vnd.dwg` es un plano (visto):** «Plano · 5 kB», y el visor ofrece descargar
  en vez de meterlo en un `<img>`. Una `.heic` tampoco se intenta pintar.
- **Dos ficheros con el mismo nombre en una tanda (visto):** tres `igual.pdf`, tres barras, dos
  filas y una línea en la tira para el que falló, sin avisos de claves repetidas de React.
- **«Reintentar» va a la carpeta original (visto):** subida fallida dentro de «Tema X», reintento
  desde la raíz, el fichero acabó en «Tema X» en Drive y en la ficha.
- **El visor enseña lo antes posible:** lee el flujo, pinta la imagen con lo que ha llegado y
  enseña cuánto lleva lo demás. Lo recordado en memoria y la precarga al posarse **(visto)**: la
  segunda apertura de una imagen de 3 MB tardó 31 ms y no pidió nada. *El pintado progresivo y la
  línea de progreso no se han visto*: el Drive falso entrega la respuesta de golpe, así que no hay
  parciales que mirar.
- **El visor se podía cerrar sin querer (visto, no estaba en la auditoría):** vivía dentro del panel,
  cuyo `backdrop-filter` lo encerraba, y su telón le quedaba encima; cualquier clic dentro lo
  cerraba. Ahora va a `body` por un portal y por encima del telón.
- Comentarios desfasados corregidos en `index.ts`, `archivador.ts`, `archivador-local.ts`,
  `tipos.ts`, `firestore.rules` e `iconos.tsx` (15 %, no 16 %).

### Medido

Drive simulado con 150 ms por petición y 20 MB/s de subida; mismo guion contra la construcción de
antes y la de después:

| | Antes | Después |
|---|---|---|
| Primera tanda (3 × 1 MB, sin carpetas en Drive) | 2246 ms · 10 peticiones | 1292 ms · 7 |
| Segunda tanda (3 × 1 MB) | 1099 ms · 3 | 700 ms · 3 |
| Primera subida con las carpetas ya en Drive | 1198 ms · 5 (4 búsquedas en serie) | 687 ms · 1 |
| Un fichero de 20 MB | 3032 ms · 4 | 3227 ms · 4 (igual: los trozos van en serie por protocolo) |
| Abrir una imagen de 6 MB, primera vez / segunda | 405 / 392 ms · 2 descargas | 422 / 32 ms · 1 |
| Borrar carpeta con 2 subcarpetas y 5 apuntes | 8 peticiones · 3 preguntas | 1 petición · 1 pregunta |
| Al abrir la página | `about` | `about` + 1 búsqueda (sin crear nada) |

### Lo que queda

- **La migración al entrar no se lleva apuntes ni carpetas.** `src/lib/data/index.ts` solo sube
  eventos, tareas, ajustes y el layout. Lo lleva otra tarea.
- **No hay forma de desconectar Drive.** `soltarPermiso` (`google.ts`) y `olvidarQuien`
  (`archivador-drive.ts`) siguen sin pantalla que los llame. Lo lleva otra tarea.
- **Recargar pasada la hora** vuelve a «Sin conectar» y pide pulsar Conectar Drive: es el precio de
  no tener secreto de cliente (§ 4), no un fallo.
- **Si el navegador no dejara leer `Range`**, tras un trozo se daría por recibido entero (§ 4). No
  se ha podido comprobar contra Google de verdad qué cabeceras expone; el Drive falso las expone.
- **Borrar una carpeta confía en que Drive refleja el árbol de Archicel.** Si alguien movió un
  fichero fuera de su carpeta desde Drive, mandar la carpeta a la papelera no se lo lleva, y su
  ficha se borra igual: el fichero queda vivo en Drive, fuera de Archicel.
- **Un 404 al borrar quita la ficha.** Es lo correcto si se borró desde Drive; si algún día dos
  personas comparten cuenta de Archicel, borrar un apunte fantasma del otro quitaría su ficha
  (su fichero seguiría en su Drive). La pregunta de confirmación sale igual en los dos casos.
- **La fila no se marca huérfana** hasta que se intenta abrir (§ 9).
