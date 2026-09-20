# Cuentas y acceso

Archicel funciona entera **sin cuenta**. Entrar no desbloquea nada: lo que hace es que el
escritorio, las tareas y el calendario la sigan a cualquier dispositivo.

Esa frase es la decisión de producto y tiene una consecuencia técnica que conviene no
perder de vista: **si Firebase está caído, mal configurado o sin red, la aplicación abre
igual**. Un muro de acceso habría convertido cualquier fallo de la nube en una aplicación
que no arranca — y esto es un regalo, no un servicio con soporte.

## Las piezas

| Pieza | Fichero | Qué hace |
|---|---|---|
| Pantalla de acceso | [src/app/entrar/page.tsx](../../src/app/entrar/page.tsx) | Entrar, recuperar contraseña, seguir sin cuenta. **No crea cuentas** |
| Sesión | [src/lib/firebase/sesion.tsx](../../src/lib/firebase/sesion.tsx) | Quién entra, por qué vía, y con qué almacén se trabaja |
| Errores | [src/lib/firebase/errores.ts](../../src/lib/firebase/errores.ts) | Los códigos de Firebase dichos en castellano |
| Menú de la cuenta | [src/components/MenuCuenta.tsx](../../src/components/MenuCuenta.tsx) | Quién soy y **dónde están mis cosas** |

La ruta vieja `/conexion` —la pantalla de comprobación de los primeros días— ahora
redirige a `/entrar`. No se borra por si quedó en algún marcador.

## Lo que hay que activar en Firebase

Sin esto, entrar devuelve `auth/operation-not-allowed`, que la pantalla traduce a
«Esa forma de entrar todavía no está activada en Firebase».

1. Consola de Firebase → proyecto **archicel-39** → **Authentication** → *Sign-in method*.
2. Activar **Google** (pide un correo de soporte) y **Correo electrónico/contraseña**.
   En esa misma sección, pestaña *Users* → **Add user**, se dan de alta las cuentas: la
   aplicación **no tiene registro**. Archicel tiene dos cuentas conocidas y un formulario
   de alta en una aplicación privada no es una comodidad, es una puerta que no tendría por
   qué existir.
3. En *Settings → Authorized domains*, comprobar que están `localhost` y el dominio donde
   se publique.

## Los papeles

Archicel tiene dos personas y tres papeles:

| Papel | Quién | Alcanza |
|---|---|---|
| **admin** | Cristian | El árbol entero de cualquiera. Existe para poder arreglar algo sin pedirle a nadie que le deje el portátil |
| **usuaria** | Celeste | Lo suyo, que es exactamente lo que necesita |
| **invitada** | quien entre sin cuenta | Su propio navegador; no toca la nube |

La lista vive en **dos sitios a la vez y hay que tocar los dos**:

- [src/lib/auth/roles.ts](../../src/lib/auth/roles.ts) — para que la interfaz sepa qué enseñar.
  **Esto no protege nada**: corre en el navegador y desde el navegador se puede cambiar.
- [firestore.rules](../../firestore.rules), función `esAdmin()` — esto sí. Corre en el
  servidor de Google y es lo único que de verdad impide leer datos ajenos.

Si solo se actualiza uno, la aplicación dirá que alguien es administrador y el servidor le
dirá que no.

### Por qué la lista va por UID y no por correo

Un correo parece más cómodo, pero como llave tiene un agujero: **mientras la cuenta no
exista, cualquiera puede registrarse con ese correo** y heredar el papel que le hayamos
dejado escrito de antemano. El UID lo genera Firebase al crear la cuenta, no se elige y no
se repite: nombrar un UID es nombrar a una persona que ya existe.

### Cómo se nombra a un administrador

1. Dar de alta la cuenta en la consola (ver arriba) y entrar con ella en Archicel.
2. Abrir el menú del avatar. Mientras no haya ningún administrador configurado, el menú
   enseña el identificador de quien esté dentro con un botón para copiarlo. También está
   en la consola de Firebase → Authentication → Users → *User UID*.
3. Pegarlo en `ADMINS` de `roles.ts` y en `esAdmin()` de `firestore.rules`, sustituyendo el
   marcador `'sin-configurar'`.
4. Publicar las reglas: consola → Firestore Database → Reglas → Publicar.

El bloque del identificador desaparece solo en cuanto `ADMINS` deja de estar vacía. Un
ajuste que se esconde cuando ya no sirve es mejor que un ajuste permanente.

### Qué significa «omnipotente» hoy

Alcanzar los datos de cualquiera. **No hay panel de administración**, y es a propósito: con
una sola usuaria no hay nada que administrar, y una pantalla vacía de botones que no hacen
falta es peor que no tenerla. Cuando haya algo que administrar, se construye.

## Detalles que no se ven pero deciden

- **La ventana de Google tiene plan B.** Si el navegador la bloquea, se entra por
  redirección en vez de fallar. Hay navegadores y modos de privacidad que matan las
  ventanas emergentes sin avisar.
- **Al entrar por primera vez, lo que hubiera en este equipo sube solo.** Lo hace
  `migrarLocalANube`, y deja una marca para no duplicar nada en el siguiente arranque.
  Por eso se puede usar Archicel meses sin cuenta y no perder nada al crearla.
- **El punto del avatar es el único indicador permanente de dónde se guarda todo**:
  apagado, este equipo; verde, la nube. Es un dato que cambia lo que significa cerrar el
  portátil, y no cabía en palabras en la cabecera.
- **La disposición del escritorio va siempre con copia local**, aunque haya sesión. Ver
  [WIDGETS.md § 3](../frontend/WIDGETS.md).
- **Los errores nombran el problema y la salida.** «Credencial inválida» no dice si sobra
  una letra en el correo o falla la contraseña, y sobre todo no dice qué hacer después.

## Lo que todavía no está

- **Verificación del correo** al crear cuenta. Con una sola usuaria conocida no aporta
  nada; si algún día entra alguien más, sí.
- **Cambiar la contraseña desde dentro.** Hoy se hace por el correo de recuperación.
- **Borrar la cuenta.** Requiere decidir antes qué pasa con sus datos, y eso es una
  conversación, no una casilla.
