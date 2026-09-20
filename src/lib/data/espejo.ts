/**
 * El espejo local: lo que Celeste coloca no depende de una sola cosa para sobrevivir.
 *
 * Un documento guardado solo en la nube se pierde en cuanto falla cualquier eslabón, y
 * los eslabones fallan callados: reglas de Firestore sin publicar, un rato sin red, la
 * pestaña cerrada antes de que saliera la escritura. El síntoma siempre es el mismo y
 * siempre es el peor posible — entras y todo está como el primer día.
 *
 * Esto envuelve un documento remoto con una copia en este equipo y establece un orden de
 * autoridad muy concreto:
 *
 *   1 · **Se escribe primero aquí y después allí.** La copia local no puede fallar; si la
 *       de la nube falla, se avisa, pero no se ha perdido nada.
 *   2 · **Se pinta la copia local de inmediato**, sin esperar a la red. La nube corrige
 *       después si trae algo más nuevo.
 *   3 · **Un "no hay nada" remoto nunca borra lo que hay aquí.** Es la trampa clásica:
 *       el documento todavía no existe en la nube, llega un `null`, y la aplicación lo
 *       interpreta como "empieza de cero". Cuando eso pasa, lo que se hace es subir la
 *       copia local, no tirarla.
 *
 * Con esto, para perder una disposición tendrían que fallar a la vez el navegador y la
 * nube. Y si el navegador se borra, la nube la devuelve.
 */

import type { Desuscribir, Documento } from './almacen';

export interface OpcionesEspejo {
  /** Se llama cuando la nube rechaza una escritura. La local ya está hecha. */
  alFallar?: (error: unknown) => void;
}

function iguales(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function conEspejoLocal<T>(
  remoto: Documento<T>,
  local: Documento<T>,
  opciones: OpcionesEspejo = {},
): Documento<T> {
  return {
    async leer() {
      try {
        const alla = await remoto.leer();
        if (alla !== null) {
          await local.escribir(alla);
          return alla;
        }
      } catch {
        /* sin red o sin permiso: manda la copia de aquí */
      }
      return local.leer();
    },

    async escribir(valor) {
      /* Primero lo irrenunciable. Si la línea siguiente explota, esto ya está a salvo. */
      await local.escribir(valor);
      try {
        await remoto.escribir(valor);
      } catch (e) {
        opciones.alFallar?.(e);
      }
    },

    escuchar(cb): Desuscribir {
      let ultimo: T | null | undefined;
      let vivo = true;

      const emitir = (valor: T | null) => {
        if (!vivo || iguales(valor, ultimo)) return;
        ultimo = valor;
        cb(valor);
      };

      /* Lo de aquí, ya. El primer pintado no espera a la red. */
      const offLocal = local.escuchar((valor) => {
        /* Una vez la nube ha hablado, ella manda: si no, la copia local que acabamos de
           escribir volvería a emitirse y competiría con la respuesta remota. */
        if (ultimo === undefined || valor !== null) emitir(valor);
      });

      let offRemoto: Desuscribir = () => {};
      try {
        offRemoto = remoto.escuchar((valor) => {
          if (valor !== null) {
            local.escribir(valor).catch(() => {});
            emitir(valor);
            return;
          }
          /* La nube dice que no hay nada. Si aquí sí lo hay, es que todavía no ha subido:
             se sube, y sobre todo NO se emite el vacío. */
          local
            .leer()
            .then((mio) => {
              if (mio === null) {
                emitir(null);
                return;
              }
              remoto.escribir(mio).catch((e) => opciones.alFallar?.(e));
            })
            .catch(() => {});
        });
      } catch (e) {
        opciones.alFallar?.(e);
      }

      return () => {
        vivo = false;
        offLocal();
        offRemoto();
      };
    },
  };
}
