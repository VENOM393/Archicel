'use client';

/**
 * El selector de una hora del día.
 *
 * Envuelve el `Select` de shadcn en vez de usarlo pelado porque una lista de horas tiene
 * exigencias propias que el componente genérico no conoce:
 *
 *   · **Los números van en mono tabular.** Son datos, y en una lista vertical de horas
 *     las cifras tienen que caer a plomo o la columna baila al desplazarse.
 *   · **Se abre por la hora seleccionada**, no por el principio. Con setenta y tres
 *     opciones, empezar a las 06:00 para elegir las 18:00 es desplazar a ciegas.
 *   · **Marca la hora en punto.** Los cuartos se leen como variaciones de ella, que es
 *     como se piensa una hora: "las seis y cuarto", no "la opción número veinticinco".
 */

import { hhmm } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function SelectorHora({
  valor,
  onCambio,
  horas,
  etiqueta,
}: {
  valor: number;
  onCambio: (m: number) => void;
  /** Minutos desde medianoche, ya en el paso que corresponda. */
  horas: number[];
  etiqueta: string;
}) {
  return (
    <Select value={String(valor)} onValueChange={(v) => onCambio(Number(v))}>
      <SelectTrigger className="sel-hora" aria-label={etiqueta}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="sel-hora-lista" position="popper" sideOffset={6}>
        {horas.map((m) => (
          <SelectItem key={m} value={String(m)} className={m % 60 === 0 ? 'en-punto' : undefined}>
            {hhmm(m)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
