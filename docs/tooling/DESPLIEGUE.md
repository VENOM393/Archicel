# Publicar Archicel en Vercel

Archicel es una aplicación de Next.js sin nada raro: no hay contenedor, ni base de datos
propia, ni proceso que tenga que estar vivo. Vercel la construye y la sirve, y la única
pieza de servidor —`/api/canvas`— se convierte en una función.

## La vía recomendada: importar el repositorio

En [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → `VENOM393/Archicel`.

Vercel reconoce Next.js solo: no hay que tocar el comando de construcción, ni el directorio
de salida, ni la versión de Node —el `package.json` declara `>=20`—.

La ventaja de importar el repositorio en vez de usar la CLI es que **cada `git push` a
`master` publica solo**. No hay un segundo paso que se pueda olvidar, y no hay forma de que
lo publicado y lo versionado dejen de coincidir.

## La variable de Google

`NEXT_PUBLIC_GOOGLE_CLIENT_ID` tiene que estar en los tres entornos, o en producción no hay Drive.

Vercel la marca en rojo por el prefijo `NEXT_PUBLIC_`: se responde **«Change to Config»**. Un ID de
cliente de OAuth es público por diseño y lo que lo protege son los orígenes autorizados de la
consola de Google. Quitarle el prefijo la rompe.

Al cambiarla hay que **redesplegar**: se hornea al construir.

Sin ella la página de una asignatura abre, pero dice «Sin conectar», no ofrece Conectar Drive y
deja «Subir» y «Carpeta» deshabilitados: no se puede guardar ningún apunte.

Y el dominio de producción tiene que estar en los **orígenes de JavaScript autorizados** del ID de
cliente, en la consola de Google Cloud (*APIs y servicios → Credenciales*). Si no, la ventana de
Google se abre con un error de origen y no hay permiso. Es el equivalente, para Drive, de autorizar
el dominio en Firebase (más abajo). Los pasos están en
[DRIVE.md § 7](../integraciones/DRIVE.md).

## Las variables de entorno — el paso que rompe todo si se salta

En *Settings → Environment Variables* del proyecto, las mismas que hay en `.env.local`:

| Variable | Para qué | ¿Pública? |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase | Sí, por diseño |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase | Sí |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase | Sí |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase | Sí |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase | Sí |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase | Sí |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Drive (apuntes) | Sí, por diseño — «Change to Config» |
| `CANVAS_URL` | El campus | — |
| `CANVAS_TOKEN` | El campus | **No. Jamás.** |
| `CANVAS_ZONA` | El campus | — |

Las de Firebase llevan `NEXT_PUBLIC_` porque **son públicas a propósito**: viajan al
navegador y quien mire el código las verá. Lo que protege los datos son las reglas de
`firestore.rules`, no el secreto de esa clave.

`CANVAS_TOKEN` **no lo lleva**, y eso no es una preferencia: es la cuenta entera del campus
—notas, mensajes, entregas— y con ese prefijo Next lo incrustaría en el JavaScript que
descarga cualquiera. `server-only` hace que importarlo desde un componente de navegador
rompa la compilación, pero el prefijo se lo saltaría todo.

**Sin ninguna de estas variables la aplicación arranca igual**, guardando en el navegador.
Es deliberado. Lo que no hará es sincronizar, leer del campus ni guardar apuntes: esos solo van
a Drive.

## Después de publicar: autorizar el dominio en Firebase

**Esto es lo que falla siempre y no avisa hasta que alguien intenta entrar.**

Consola de Firebase → **Authentication → Settings → Authorized domains** → *Add domain* →
el dominio que dé Vercel (`archicel.vercel.app`, o el propio si se pone uno).

Sin eso, «Continuar con Google» falla con `auth/unauthorized-domain`. La aplicación lo
traduce diciendo exactamente dónde se arregla, pero mejor hacerlo antes de que pase.

Los dominios de vista previa de Vercel cambian en cada rama, así que **las vistas previas no
tendrán acceso con Google** salvo que se añada cada una. No merece la pena: se prueba el
acceso en producción.

## Qué cambia al estar en Vercel

- **El modo aplicación empieza a funcionar de verdad.** El *service worker* necesita
  HTTPS, y en `localhost` solo funciona por la excepción del navegador. En Vercel,
  Archicel se instala desde cualquier dispositivo.
- **La caché de Canvas rinde menos.** Vive en la memoria del proceso, y en Vercel cada
  función es efímera y puede haber varias a la vez: una visita puede tocar una instancia
  fría aunque otra tenga los datos. Sigue evitando la estampida dentro de una misma
  instancia, que es para lo que más se puso, pero no esperes los 3 ms medidos en local.
  Si algún día molesta, la solución es una caché compartida —no tocar el motor—.
- **Las cabeceras de seguridad viajan igual**: las pone `next.config.ts`, no el servidor.

## Lo que no hay que hacer

- **No publicar con `vercel --prod` desde el portátil** si el repositorio está conectado.
  Se acaba con una versión publicada que no está en ningún commit, y averiguar qué hay
  vivo se vuelve arqueología.
- **No meter `.env.local` en el repositorio** para «que Vercel lo lea». Vercel no lo lee, y
  el token quedaría en el historial para siempre.
- **No subir la clave de cuenta de servicio** de Firebase. No hace falta: Archicel habla
  con Firestore desde el cliente, con las reglas protegiendo.
