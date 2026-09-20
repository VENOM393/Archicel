'use client';

/**
 * El selector de un día, en un calendario que se despliega.
 *
 * Hasta ahora la fecha de una tarea era la del sitio desde donde se creaba y no se podía
 * cambiar: para mover una tarea a otro día había que borrarla y rehacerla. Esto lo
 * arregla.
 *
 * Tres decisiones que no trae el componente de serie:
 *
 *   · **En español y con la semana empezando en lunes**, como el resto de la aplicación.
 *     Un calendario que empieza en domingo dentro de otro que empieza en lunes es un
 *     error que se nota en cuanto se comparan.
 *   · **El disparador enseña la fecha escrita**, no un código: "vie 25 de septiembre" se
 *     comprueba de un vistazo; `2026-09-25` hay que descifrarlo.
 *   · **Se cierra al elegir.** Elegir un día es el final de la tarea, no un paso.
 */

import { useState } from 'react';
import { es } from 'date-fns/locale';

import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { aFecha, deFecha } from '@/lib/data';

export function SelectorFecha({
  valor,
  onCambio,
  etiqueta = 'Cambiar la fecha',
}: {
  /** Fecha en `YYYY-MM-DD`, como la guarda el modelo. */
  valor: string;
  onCambio: (fecha: string) => void;
  etiqueta?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const fecha = valor ? deFecha(valor) : undefined;

  const escrita = fecha
    ? fecha.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'long' })
    : 'Sin fecha';

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger className="sel-fecha" aria-label={etiqueta}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M8 3v4M16 3v4M3 10h18" />
        </svg>
        <span>{escrita.charAt(0).toUpperCase() + escrita.slice(1)}</span>
      </PopoverTrigger>
      <PopoverContent className="sel-fecha-caja" align="start" sideOffset={8}>
        <Calendar
          mode="single"
          locale={es}
          weekStartsOn={1}
          defaultMonth={fecha}
          selected={fecha}
          onSelect={(d) => {
            if (!d) return;
            onCambio(aFecha(d));
            setAbierto(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
