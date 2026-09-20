'use client';

/**
 * El selector de asignatura, con las del horario.
 *
 * Era un campo de texto libre con sugerencias, y eso tenía dos problemas: había que
 * escribirlo bien para que el color acertara, y nada impedía acabar con "Fisica",
 * "física" y "Física Aplicada" como si fueran tres asignaturas distintas.
 *
 * Ahora **se guarda la clave**, no lo que se teclee. El nombre visible puede cambiar sin
 * tocar una sola tarea, y el color sale siempre del catálogo.
 *
 * "Sin asignatura" es una opción de verdad y no un hueco: una tarea puede no ser de
 * ninguna —el gimnasio no lo es— y eso no debería obligar a inventarse una.
 */

import { ASIGNATURAS, CLAVES_ASIGNATURA, buscarAsignatura } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/** Valor que representa "esta tarea no es de ninguna asignatura". */
const NINGUNA = 'ninguna';

export function SelectorAsignatura({
  valor,
  onCambio,
  etiqueta = 'Asignatura',
}: {
  /** La clave guardada; se acepta también texto antiguo y se resuelve al abrir. */
  valor: string | undefined;
  onCambio: (clave: string | undefined) => void;
  etiqueta?: string;
}) {
  /* Las tareas creadas antes de esto guardaron el nombre escrito a mano. Se resuelve con
     el buscador tolerante y así siguen mostrando su asignatura en vez de aparecer vacías. */
  const encontrada = buscarAsignatura(valor);
  const clave = encontrada
    ? (CLAVES_ASIGNATURA.find((k) => ASIGNATURAS[k].codigo === encontrada.codigo) ?? NINGUNA)
    : NINGUNA;

  return (
    <Select
      value={clave}
      onValueChange={(v) => onCambio(v === NINGUNA ? undefined : v)}
    >
      <SelectTrigger className="sel-asig" aria-label={etiqueta}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="sel-asig-lista" position="popper" sideOffset={6}>
        <SelectItem value={NINGUNA}>
          <span className="asig-pt sin" aria-hidden="true" />
          Sin asignatura
        </SelectItem>
        {CLAVES_ASIGNATURA.map((k) => {
          const a = ASIGNATURAS[k];
          return (
            <SelectItem key={k} value={k}>
              <span className="asig-pt" style={{ ['--tc' as string]: `var(--c-${a.color})` }} aria-hidden="true" />
              {a.nombre}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
