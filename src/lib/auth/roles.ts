/**
 * Quién puede qué.
 *
 * Archicel tiene dos personas y tres papeles:
 *
 *   · **admin** — Cristian. Alcanza todo: los datos de cualquiera, no solo los suyos.
 *     Existe para poder arreglar algo sin pedirle a nadie que le deje el portátil.
 *   · **usuaria** — Celeste. La cuenta principal y para la que está hecha la aplicación.
 *     Alcanza lo suyo y nada más, que es exactamente lo que necesita.
 *   · **invitada** — cualquiera que entre sin cuenta. Trabaja contra su propio navegador
 *     y no toca la nube. No es un castigo: es el modo en que la aplicación funciona sola.
 *
 * ## Por qué la lista va por UID y no por correo
 *
 * Es la decisión importante de este fichero. Un correo parece más cómodo —se lee, se
 * escribe de memoria— pero como llave tiene un agujero: mientras la cuenta no exista,
 * **cualquiera puede registrarse con ese correo** y heredar el papel que le hayamos
 * asignado de antemano. El UID lo genera Firebase al crear la cuenta, no se elige y no se
 * repite, así que nombrar un UID es nombrar a una persona concreta que ya existe.
 *
 * Los correos están escritos abajo, pero como comentario para saber de quién es cada UID.
 * **No se usan para decidir nada.**
 *
 * ## Esto de aquí no protege nada por sí solo
 *
 * Lo que hay en este fichero vive en el navegador, y todo lo que vive en el navegador se
 * puede cambiar desde el navegador. Sirve para que la interfaz sepa qué enseñar. Quien de
 * verdad impide leer los datos de otra persona es `firestore.rules`, en el servidor, y
 * **la misma lista de UID tiene que estar allí**. Si sólo se actualiza aquí, la interfaz
 * dirá que alguien es admin y el servidor le dirá que no.
 */

/**
 * Los UID con poder total. Se rellenan **después** de crear las cuentas.
 *
 * De dónde sale un UID: consola de Firebase → Authentication → Users → columna
 * «User UID». O, más rápido, entrando en Archicel con esa cuenta: mientras esta lista
 * esté vacía, el menú de la cuenta enseña el UID de quien esté dentro, con un botón para
 * copiarlo.
 *
 * Al añadir uno aquí hay que añadirlo **también** en `firestore.rules`, en `esAdmin()`.
 */
export const ADMINS: readonly string[] = [
  // 'xxxxxxxxxxxxxxxxxxxxxxxxxxxx',  // Cristian · cristianrosa05@gmail.com
];

/**
 * La cuenta principal, la de Celeste. Se rellena igual que la anterior.
 *
 * No da ningún permiso extra: una cuenta cualquiera ya alcanza sus propios datos. Está
 * para que la interfaz pueda distinguir «la usuaria de la casa» de «una cuenta más», por
 * si algún día hay algo que enseñarle solo a ella.
 */
export const PRINCIPALES: readonly string[] = [
  // 'xxxxxxxxxxxxxxxxxxxxxxxxxxxx',  // Celeste · celesturria@gmail.com
];

export type Rol = 'admin' | 'usuaria' | 'invitada';

/** El papel de quien esté dentro. Sin sesión, invitada. */
export function rolDe(uid: string | null | undefined): Rol {
  if (!uid) return 'invitada';
  if (ADMINS.includes(uid)) return 'admin';
  return 'usuaria';
}

export function esAdmin(uid: string | null | undefined): boolean {
  return Boolean(uid) && ADMINS.includes(uid as string);
}

export function esPrincipal(uid: string | null | undefined): boolean {
  return Boolean(uid) && PRINCIPALES.includes(uid as string);
}

/** Cómo se llama cada papel cuando hay que enseñarlo. */
export const NOMBRE_ROL: Record<Rol, string> = {
  admin: 'Administrador',
  usuaria: 'Cuenta personal',
  invitada: 'Sin cuenta',
};

/**
 * `true` mientras no se haya configurado ningún administrador.
 *
 * La interfaz lo usa para ofrecer el UID a quien entre: es el único momento en que hace
 * falta verlo, y en cuanto la lista deja de estar vacía ese trozo de interfaz desaparece
 * solo. Un ajuste que se esconde cuando ya no sirve es mejor que un ajuste permanente.
 */
export const FALTA_CONFIGURAR_ADMIN = ADMINS.length === 0;
