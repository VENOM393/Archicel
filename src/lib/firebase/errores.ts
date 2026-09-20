/**
 * Lo que Firebase dice, dicho en el idioma de la casa.
 *
 * Los códigos de Firebase (`auth/invalid-credential`) están escritos para quien programa,
 * no para quien entra. Enseñarlos tal cual en una pantalla de acceso es lo que hace que
 * una aplicación parezca un panel de administración: el mensaje no nombra el problema
 * —"credencial inválida" no dice si sobra una letra en el correo o falla la contraseña—
 * y sobre todo no dice qué hacer después.
 *
 * Cada mensaje de aquí nombra las dos cosas: qué ha pasado y por dónde se sale.
 */

const MENSAJES: Record<string, string> = {
  /* credenciales */
  'auth/invalid-credential': 'Ese correo y esa contraseña no coinciden. Vuelve a probar, o crea la cuenta si es la primera vez.',
  'auth/wrong-password': 'La contraseña no es esa. Prueba otra vez o recupérala más abajo.',
  'auth/user-not-found': 'No hay ninguna cuenta con ese correo. Puedes crearla aquí mismo.',
  'auth/invalid-email': 'Ese correo no tiene buena pinta. Revisa que esté completo.',
  'auth/missing-password': 'Falta la contraseña.',
  'auth/email-already-in-use': 'Ese correo ya tiene cuenta. Entra en vez de crearla.',
  'auth/weak-password': 'La contraseña es muy corta: necesita seis caracteres o más.',

  /* la ventana de Google */
  'auth/popup-closed-by-user': 'Se cerró la ventana de Google antes de terminar.',
  'auth/cancelled-popup-request': 'Se cerró la ventana de Google antes de terminar.',
  'auth/popup-blocked': 'El navegador bloqueó la ventana de Google. Permítela y vuelve a intentarlo.',
  'auth/account-exists-with-different-credential':
    'Ese correo ya entra por otra vía. Prueba con la otra forma de acceso.',

  /* Configuración: esto no lo arregla quien entra, lo arregla quien administra. Por eso
     el mensaje dice dónde se toca en lugar de limitarse a decir que no se puede: quien
     lee esto es la única persona que puede resolverlo, y sin la ruta se queda mirando. */
  'auth/operation-not-allowed':
    'Esa forma de entrar no está activada. Consola de Firebase → Authentication → Sign-in method.',
  'auth/configuration-not-found':
    'Falta activar este método. Consola de Firebase → Authentication → Sign-in method.',
  'auth/admin-restricted-operation':
    'Las altas están restringidas en este proyecto. La cuenta se crea desde la consola de Firebase.',
  'auth/unauthorized-domain':
    'Este dominio no está autorizado. Consola de Firebase → Authentication → Settings → Authorized domains.',

  /* el mundo real */
  'auth/network-request-failed': 'No hay conexión con el servidor. Comprueba la red y vuelve a probar.',
  'auth/too-many-requests': 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.',
};

export function mensajeDeError(e: unknown): string {
  const codigo =
    typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : '';
  if (MENSAJES[codigo]) return MENSAJES[codigo];
  /* Sin traducción conocida se dice lo único honesto: que no salió, y que se puede repetir. */
  return 'No se pudo completar. Inténtalo otra vez en un momento.';
}

/** `true` cuando el fallo es de configuración y no de quien está entrando. */
export function esDeConfiguracion(e: unknown): boolean {
  const codigo =
    typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : '';
  return (
    codigo === 'auth/operation-not-allowed' ||
    codigo === 'auth/unauthorized-domain' ||
    codigo === 'auth/configuration-not-found'
  );
}
