import { redirect } from 'next/navigation';

/**
 * La antigua pantalla de comprobación, ahora un desvío.
 *
 * Existió para verificar la cadena entera —configuración, sesión, escritura en Firestore
 * y escucha en tiempo real— antes de que hubiera pantallas de verdad. Ese trabajo ya lo
 * hace la pantalla de acceso, y el menú de la cuenta dice en todo momento dónde se están
 * guardando las cosas. Se deja el desvío y no se borra la ruta porque puede estar
 * guardada en algún marcador.
 */
export default function Conexion() {
  redirect('/entrar');
}
