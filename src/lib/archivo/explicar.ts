/**
 * Qué decirle a quien lo lee cuando algo del archivador falla.
 *
 * Cada fallo en pantalla lleva tres cosas, y las tres hacen falta:
 *
 *   1 · **qué ha pasado**, en el idioma de la casa;
 *   2 · **lo que dijo Drive**, tal cual — es lo único que distingue dos 403 que se
 *       parecen, y tirarlo escondió una vez durante tres rondas que la API estaba apagada;
 *   3 · **cómo se arregla**, que es la mitad que suele faltar. Saber que no queda sitio sin
 *       saber que hay que vaciar la papelera de Drive deja a quien lo lee igual de atascada.
 *
 * Vive aparte de la pantalla para que el mismo fallo se cuente igual al subir, al borrar
 * y al abrir.
 */

import { FalloDeArchivo } from './archivador';

export interface Explicacion {
  motivo: string;
  arreglo: string;
  /** Lo que dijo el proveedor, si dijo algo que añada información. */
  dijo?: string;
  /** Si el arreglo pasa por volver a conectar: el botón lo hace antes de reintentar. */
  reconectar: boolean;
}

const RECONECTA = 'Pulsa «Reconectar y reintentar»: Google lo renueva, normalmente sin preguntar nada.';

export function explicar(e: unknown): Explicacion {
  if (!(e instanceof FalloDeArchivo)) {
    const texto = e instanceof Error && e.message ? e.message : 'Fallo desconocido.';
    return { motivo: texto, arreglo: 'Reintenta. Si vuelve a pasar, recarga la página.', reconectar: false };
  }
  const { dijo, razon } = e.detalle;
  const con = (x: Omit<Explicacion, 'dijo'>): Explicacion => ({ ...x, ...(dijo ? { dijo } : {}) });

  switch (e.causa) {
    case 'sin-conexion': {
      const bloqueada = /bloque/i.test(e.message);
      return con({
        motivo: e.message.endsWith('.') ? e.message : `${e.message}.`,
        arreglo: bloqueada
          ? 'Permite las ventanas emergentes de este sitio y pulsa «Reconectar y reintentar».'
          : 'Pulsa «Reconectar y reintentar» y concede el permiso en la ventana de Google.',
        reconectar: true,
      });
    }
    case 'caducada':
      return con({ motivo: 'La sesión de Drive ha caducado.', arreglo: RECONECTA, reconectar: true });
    case 'sin-permiso':
      if (razon === 'insufficientPermissions' || razon === 'insufficientScopes' || razon === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT') {
        return con({
          motivo: 'El permiso concedido no incluye Drive.',
          arreglo: 'Pulsa «Reconectar y reintentar» y, en la ventana de Google, deja marcada la casilla de Drive.',
          reconectar: true,
        });
      }
      if (razon === 'appNotAuthorizedToFile' || razon === 'insufficientFilePermissions' || razon === 'forbidden') {
        return con({
          motivo: 'Drive dice que esto no lo subió esta cuenta.',
          arreglo: 'Archicel solo ve lo que subió con la cuenta de Google conectada. Comprueba arriba de quién es el Drive.',
          reconectar: false,
        });
      }
      if (razon === 'domainPolicy') {
        return con({
          motivo: 'Tu organización no deja usar Drive desde otras aplicaciones.',
          arreglo: 'Conecta una cuenta de Google personal.',
          reconectar: true,
        });
      }
      return con({
        motivo: 'Drive no lo permite.',
        arreglo: 'Reintenta. Si vuelve a pasar, lo que dice Drive es la pista.',
        reconectar: false,
      });
    case 'api-apagada':
      return con({
        motivo: 'La API de Google Drive está desactivada en el proyecto de Archicel.',
        arreglo:
          'Hay que activarla en console.cloud.google.com › APIs y servicios › Biblioteca › Google Drive API. Después, espera unos minutos y reintenta.',
        reconectar: false,
      });
    case 'limite':
      return razon === 'dailyLimitExceeded'
        ? con({ motivo: 'Se ha agotado la cuota diaria de Drive.', arreglo: 'Vuelve a intentarlo mañana.', reconectar: false })
        : con({
            motivo: 'Drive está recibiendo demasiadas peticiones.',
            arreglo: 'Archicel ya lo reintentó varias veces. Espera un minuto y pulsa «Reintentar».',
            reconectar: false,
          });
    case 'sin-sitio':
      return con({
        motivo: 'No queda espacio en tu Drive.',
        arreglo: 'Vacía la papelera de Drive o libera espacio en tu cuenta de Google, y reintenta.',
        reconectar: false,
      });
    case 'no-esta':
      return con({
        motivo: 'Ya no está en tu Drive.',
        arreglo: 'Puede que se borrara desde Drive: mira en su papelera.',
        reconectar: false,
      });
    case 'sin-carpeta':
      return con({
        motivo: 'La carpeta de destino ya no está en tu Drive.',
        arreglo: 'Sácala de la papelera de Drive, o súbelo a otra carpeta.',
        reconectar: false,
      });
    case 'red':
      /* El texto de un corte no dice nada que no diga el motivo. */
      return { motivo: 'Se cortó la conexión con Drive.', arreglo: 'Comprueba la conexión y pulsa «Reintentar».', reconectar: false };
    case 'servidor':
      return con({
        motivo: `Drive no responde ahora mismo${e.detalle.estado ? ` (${e.detalle.estado})` : ''}.`,
        arreglo: 'Es un fallo de Google, no tuyo. Espera un momento y reintenta.',
        reconectar: false,
      });
    default:
      return {
        motivo: e.message,
        arreglo: 'Reintenta. Si vuelve a pasar, lo que dice Drive es la pista.',
        reconectar: false,
        /* `desconocida` ya lleva el texto de Drive en el mensaje: no se repite. */
        ...(dijo && !e.message.includes(dijo) ? { dijo } : {}),
      };
  }
}
