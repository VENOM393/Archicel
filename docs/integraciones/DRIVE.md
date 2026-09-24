# Google Drive: dónde viven los apuntes

Archicel tiene **una página por asignatura**, y en cada una sus apuntes: fotos de pizarra, PDFs de
teoría, láminas escaneadas, un `.docx` de los que manda un profesor. Los bytes no caben en Firestore
y no deben estar ahí; van a Google Drive.

Este documento es el planteamiento completo: qué permiso hace falta y por qué ese y no otro, de
quién son los ficheros, cómo encaja con el almacén que ya existe, qué hay que tocar, y qué tiene que
hacer Cristian en la consola de Google.

**Estado: funcionando.** Subida, visor, borrado, carpetas, renombrar y mover contra Drive real. Lo
que falta o está a medias está en el § 10, con el fichero y la línea de cada cosa.

**Cada persona conecta su propio Drive** — la conexión vive en el navegador, no en la cuenta de
Archicel. Y **no hace falta secreto de cliente**: a cambio, la sesión de Drive dura una hora en vez
de ser permanente. Dentro de la hora, recargar no pide nada. Pasada la hora, con la pestaña abierta,
la siguiente acción la renueva; si se recarga la página ya caducada, la pantalla vuelve a «Sin
conectar» y hay que pulsar **Conectar Drive** (§ 4). El porqué está en CLAUDE.md.

**Se desconecta desde Ajustes** (`/ajustes`, en el menú del avatar), que dice también con qué cuenta
de Google está conectado. Desconectar no borra nada (§ 6).

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
carpeta, renombrar, mover). La única llamada al cargar es `about`, para saber de quién es el Drive.

Sin sesión de Archicel las fichas viven en el almacén del navegador y los bytes siguen yendo a Drive.
Al entrar con una cuenta, **la migración sube también apuntes y carpetas**, con sus mismos ids —así
un apunte sigue dentro de su carpeta y una carpeta dentro de su madre—. Cada colección lleva su
propia marca, de modo que quien ya había migrado antes de este cambio recibe las dos en su siguiente
arranque sin repetir lo demás. El mecanismo está en [CUENTAS.md](../data/CUENTAS.md).

Un apunte con `remoto.proveedor: 'local'` —de antes de que todo fuera a Drive— sube igual: su ficha
llega a la nube, pero sus bytes siguen en el IndexedDB de **ese** navegador. Ahí se sigue abriendo;
en otro dispositivo sale «ya no está», que es la verdad.

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
  subir(fichero: File, destino: Destino, alAvanzar?: (tanto: number) => void): Promise<Remoto>;
  crearCarpeta(nombre: string, destino: Destino): Promise<Remoto>;
  renombrar(remoto: Remoto, nombre: string): Promise<void>;
  /** Drive no mueve: quita un padre y pone otro. Por eso hace falta `desde`. */
  mover(remoto: Remoto, desde: Remoto | null, hasta: Remoto | null, destino: Destino): Promise<void>;
  borrar(remoto: Remoto): Promise<void>;
  /** Una dirección `blob:` para ver o descargar. Caduca; no se guarda en el almacén. */
  enlace(remoto: Remoto): Promise<string>;
  /** Libera lo que `enlace` reservó. */
  soltar(url: string): void;
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

Los fallos salen como `FalloDeArchivo` con una `causa` (`sin-permiso`, `sin-sitio`,
`demasiado-grande`, `no-esta`, `red`, `desconocida`) para que la pantalla traduzca un código y no
el texto del proveedor.

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
nombre la primera vez que hacen falta en cada pestaña y se recuerdan en memoria. Con `drive.file` la
búsqueda solo devuelve lo que creó la aplicación, así que no se confunde con una carpeta de Celeste
que se llame igual. Consecuencias:

- **Si alguien renombra o mueve `Archicel` desde Drive**, la siguiente pestaña no la encuentra y crea
  otra nueva. Lo ya subido sigue abriéndose —la ficha guarda el id, no la ruta— pero lo nuevo va a la
  carpeta nueva.
- **La primera vez**, si existe `Archicel/Apuntes` (el nombre antiguo), se renombra a `Asignaturas`
  en vez de crear una segunda.
- **Si se borra una carpeta a mitad de sesión**, el id recordado sigue en memoria hasta recargar
  (§ 10).

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
reanudable** de Drive: se pide una URL de sesión y se mandan trozos de 8 MB con `XMLHttpRequest`,
que es lo que da el progreso real a la barra de la interfaz.

**Lo que no hace todavía es reanudar.** Si la conexión se corta a mitad, la subida falla con `red`
y «Reintentar» vuelve a empezar de cero; la URL de sesión no se conserva ni se pregunta a Drive
cuánto había llegado (§ 10). Se implementa una vez, en `archivador-drive`, y ninguna pantalla sabe
que existe.

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
4. **El visor.** Imágenes, PDF y vídeo se ven dentro; el resto (`.docx`, planos, modelos…) ofrece
   **Descargar**, porque sin convertir nada no hay forma razonable de enseñarlo. El fichero se baja
   entero y se envuelve en un `blob:`, porque un `<img>` o un `<iframe>` no saben mandar la cabecera
   de autorización.

### Ajustes: con qué cuenta, y cómo soltarla

Ruta **`/ajustes`** (`src/app/ajustes/page.tsx`), enlazada desde el menú del avatar. Antes no había
pantalla de ajustes: la cuenta vivía solo en ese menú, y la conexión con Google no vivía en ningún
sitio. Es una pantalla y no un trozo más del menú porque desconectar pide confirmar y explicar qué
pasa con los apuntes, y eso no cabe en una caja de 266 px.

Una portada tipográfica —quién es y dónde se guardan sus cosas— y un solo panel de cristal, el de
Drive, con cuatro estados:

| Estado | Cuándo | Qué ofrece |
|---|---|---|
| **Conectado** | hay token válido | el correo de `drive/v3/about` en grande y **Desconectar Drive** (contorno) |
| **Caducado** | se conectó pero pasó la hora | **Renovar ahora** (la acción sólida) y Desconectar |
| **Sin conectar** | nunca, o se desconectó | **Conectar Drive** |
| **No configurado** | falta `NEXT_PUBLIC_GOOGLE_CLIENT_ID` en el despliegue | nada que pulsar |

**Desconectar pide confirmación**, y la pregunta sustituye a la fila de botones en el mismo sitio en
vez de abrir una ventana. El foco va a «Cancelar», Escape la cierra, y al cerrarla el foco vuelve al
botón que la abrió. Confirmar llama a `desconectarDrive()` (`src/lib/archivo/index.ts`), que:

1. olvida el correo y los **ids de carpeta** recordados en la pestaña —se buscaron con esa cuenta, y
   conectando otra en la misma pestaña `drive.file` no los alcanzaría—;
2. olvida el token y la marca de «se ha usado Drive» en `localStorage`;
3. **pide a Google que revoque el permiso**, cargando antes su guion si hace falta: tras recargar el
   token sale de `localStorage` y el guion no se ha pedido nunca, y sin él la revocación era un no-op.

La pantalla pasa a «Sin conectar» **sin recargar**: `google.ts` emite `archicel:drive` al conectar y
al desconectar, y `alCambiarDrive(fn)` lo escucha —también el evento `storage`, así que otra pestaña
abierta suelta su token en memoria en lugar de seguir usando uno revocado—. La página de una
asignatura no necesita escucharlo: se monta de nuevo al volver a ella y lee el estado entonces.

**Desconectar no borra nada.** Los ficheros siguen en Drive y sus fichas en Archicel; al volver a
conectar la **misma** cuenta todo se abre como antes. Con otra cuenta, los apuntes anteriores salen
«ya no está en tu Drive» —`drive.file` solo alcanza lo que se creó bajo su autorización—.

**Si Google no confirma la revocación** —pasa cuando el token ya había caducado, porque sin token no
hay nada que revocar desde el navegador, o sin red—, Archicel se desconecta igual y lo dice: el
permiso queda concedido en la cuenta de Google, sin ningún token que lo use, y la pantalla enlaza a
*Cuenta de Google → Conexiones* para retirarlo desde allí.

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
| **3** | Selector de Google, miniaturas, orden a mano, búsqueda, reanudar una subida cortada | Adjuntar lo que ya esté en su Drive, y que la pantalla aguante doscientos apuntes |

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
- **Borrar en Archicel manda el fichero a la papelera de Drive, no lo destruye.** Es lo correcto
  —treinta días para arrepentirse— pero habría que decirlo en la interfaz, porque «eliminar»
  sugiere otra cosa. **Hoy no se dice**: el aviso es «Apunte eliminado», y un apunte suelto se
  borra sin pedir confirmación (una carpeta con cosas dentro sí pregunta).
- **Si Celeste lo borra desde Drive, la ficha se queda huérfana.** La pantalla sobrevive: al
  abrirlo, el visor dice «Ese apunte ya no está en tu Drive», y la papelera de la fila quita la
  ficha. Lo que no hay es la marca previa: la fila no se enseña apagada hasta que se intenta abrir.

---

## 10 · Lo que falta o está a medias

Resultado de la auditoría del 24 de septiembre de 2026, contrastando este documento con el código.
Lo marcado **(visto)** se reprodujo en el navegador contra `npm run build && npm start`, con Drive
simulado (token falso y respuestas de Google interceptadas); lo demás sale de leer el código.

**Resuelto después:** la migración al entrar ya se lleva apuntes y carpetas (§ 3 y CUENTAS.md), y
Drive se desconecta desde Ajustes (§ 6). Lo que queda de aquella lista sigue abajo.

**Riesgo de perder o descolocar apuntes**

- **Borrar se traga el fallo de Drive (visto).** `Asignatura.tsx:517-523` y `:547-551` ignoran
  cualquier error al mandar a la papelera —no solo «ya no está»— y borran la ficha igual. Con Drive
  devolviendo 503, la carpeta desapareció de Archicel y seguiría viva en Drive, sin nada que la
  enlace ya.
- **Mover a la raíz no llega a la nube.** `Asignatura.tsx:499-506` borra `madre` o `carpeta` del
  objeto y lo guarda, pero `almacen-firestore.ts` escribe con `merge: true`, que **conserva** los
  campos que no vienen: en Firestore el apunte o la carpeta sigue dentro de la carpeta de antes. En
  el almacén local sí funciona, porque reescribe el documento entero. Hace falta `deleteField()`.
- **Borrar una carpeta con subcarpetas llenas vuelve a preguntar por cada una**
  (`Asignatura.tsx:541-546`). Si se cancela una de dentro, la de fuera se borra igual y la hija
  queda con una `madre` que ya no existe: invisible en el árbol.
- **Si el almacén rechaza la ficha después de subir** (`Asignatura.tsx:343`, por ejemplo un nombre
  de más de 300 caracteres, que las reglas no aceptan), el fichero ya está en Drive pero la tira
  dice que «no llegó a Drive», y reintentar lo sube otra vez.

**Errores que no dicen la verdad** — va contra la regla de que un error sin el texto de Drive no
sirve de nada:

- **Cualquier `sin-permiso` se presenta como sesión caducada (visto).** `Asignatura.tsx:362-374`.
  Un 403 de «Google Drive API has not been used in project … or it is disabled» salió en la tira
  como «La sesión de Drive ha caducado» con el botón «Reconectar y reintentar», que no lo arregla.
  El texto de Drive solo queda en la consola.
- **Un límite de peticiones se presenta como «No queda espacio» (visto).**
  `archivador-drive.ts:72` busca `quota` en todo el cuerpo, y el 403 `userRateLimitExceeded` dice
  «…exceed configured project quota». La tira pidió vaciar la papelera.
- **Cualquier 404 dice «Ese apunte ya no está en tu Drive»** (`archivador-drive.ts:77`), también
  cuando lo que falta es la carpeta de destino de una subida o de un movimiento.
- **`demasiado-grande` ya no puede ocurrir** (solo lo lanza el archivador local, que no sube), y su
  arreglo en `Asignatura.tsx:380` propone «enlázalo desde ahí», que no existe.

**Diferencias entre lo que se dice y lo que hace**

- **Crear carpeta exige Drive.** El botón se deshabilita sin conectar (`Asignatura.tsx:612`) y
  `crearCarpeta` pasa por `asegurarDrive` (`index.ts:123`). Contradice «organizarse no puede
  depender de la infraestructura» (CLAUDE.md, `archivador.ts:103-106`, `Asignatura.tsx:213-215`).
  Renombrar y mover lo antiguo local sí funciona sin conectar.
- **La subida «reanudable» no reanuda** (`archivador-drive.ts:323-330`): un corte vuelve a empezar
  de cero. Además da por recibido el trozo entero con cada 308 sin leer la cabecera `Range`
  (`:209`).
- **Los ids de las carpetas fijas se recuerdan por pestaña** (`archivador-drive.ts:47`): si se
  borran desde Drive a mitad de sesión, las subidas fallan con «ya no está» hasta recargar.

**Tipos de fichero**

- **`image/vnd.dwg` nunca llega a «Plano»** (`iconos.tsx:135`): `image/` se comprueba antes
  (`:70`), así que un `.dwg` con ese MIME se enseña como imagen y el visor intenta pintarlo en un
  `<img>`.

**Menores**

- La barra de progreso y la tira identifican cada fichero por su nombre (`Asignatura.tsx:335`,
  `:686`): dos ficheros con el mismo nombre en una tanda se pisan.
- «Reintentar» sube a la carpeta en la que se está **ahora**, no a la de la subida original
  (`Asignatura.tsx:418`).
- El visor descarga el fichero entero a memoria antes de enseñarlo (`archivador-drive.ts:402-403`):
  una lámina de 80 MB tarda en abrir sin decir cuánto le falta.
- Comentarios del código que se quedaron atrás: `archivador.ts:8-12`, `archivador-local.ts:4-11`,
  `tipos.ts:177` («Drive mañana, el navegador hoy»), `firestore.rules:125` e `iconos.tsx:12` (dice
  16 %; el CSS usa 15 %).
