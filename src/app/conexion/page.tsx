'use client';

/**
 * Comprobación de la conexión.
 *
 * Esta pantalla es temporal: existe para verificar la cadena entera —configuración,
 * sesión de Google, escritura en Firestore y escucha en tiempo real— antes de traer
 * aquí el escritorio y el calendario del prototipo.
 */

import { useEffect, useState } from 'react';

import { useArchicel } from '@/lib/firebase/sesion';
import { hayFirebase, PROYECTO } from '@/lib/firebase/config';
import { hoy, type Evento } from '@/lib/data';

export default function Comprobacion() {
  const { usuario, cargando, almacen, enLaNube, entrar, salir, error } = useArchicel();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [trabajando, setTrabajando] = useState(false);

  useEffect(() => almacen.eventos.escuchar(setEventos), [almacen]);

  async function crearPrueba() {
    setTrabajando(true);
    try {
      await almacen.eventos.guardar({
        tipo: 'entrega',
        titulo: 'Prueba de conexión',
        materia: 'Proyectos IV',
        fecha: hoy(),
        hora: null,
        nota: 'Creada desde la pantalla de comprobación',
      });
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <span className="text-sm text-[var(--color-ink-subtle)]">Archicel</span>
        <h1 className="text-4xl font-bold tracking-tight">Comprobación de conexión</h1>
      </header>

      <section className="flex flex-col gap-3 rounded-2xl border border-[var(--hairline)] bg-[var(--panel)] p-5">
        <Fila etiqueta="Proyecto" valor={PROYECTO} />
        <Fila etiqueta="Configuración" valor={hayFirebase ? 'encontrada' : 'ausente'} bien={hayFirebase} />
        <Fila
          etiqueta="Sesión"
          valor={cargando ? 'comprobando…' : usuario ? (usuario.email ?? usuario.uid) : 'sin iniciar'}
          bien={Boolean(usuario)}
        />
        <Fila
          etiqueta="Datos"
          valor={enLaNube ? 'Firestore' : 'este navegador'}
          bien={enLaNube}
        />
        {error && <p className="text-sm text-[var(--color-ev-rojo)]">{error}</p>}
      </section>

      <div className="flex flex-wrap gap-3">
        {usuario ? (
          <button onClick={salir} className="rounded-full border border-[var(--hairline)] px-5 py-2.5 text-sm">
            Cerrar sesión
          </button>
        ) : (
          <button
            onClick={entrar}
            disabled={!hayFirebase}
            className="rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--color-on-accent)] disabled:opacity-40"
          >
            Entrar con Google
          </button>
        )}
        <button
          onClick={crearPrueba}
          disabled={trabajando}
          className="rounded-full border border-[var(--hairline)] px-5 py-2.5 text-sm disabled:opacity-40"
        >
          {trabajando ? 'Creando…' : 'Crear evento de prueba'}
        </button>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-[var(--color-ink-muted)]">
          Eventos ({eventos.length})
        </h2>
        {eventos.length === 0 && (
          <p className="text-sm text-[var(--color-ink-subtle)]">Todavía no hay nada guardado.</p>
        )}
        <ul className="flex flex-col gap-2">
          {eventos.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-[var(--hairline)] bg-[var(--panel)] px-4 py-3"
            >
              <span className="flex flex-col">
                <span className="text-sm">{e.titulo}</span>
                <span className="font-[family-name:var(--font-data)] text-xs text-[var(--color-ink-subtle)]">
                  {e.tipo} · {e.fecha}
                </span>
              </span>
              <button
                onClick={() => almacen.eventos.borrar(e.id)}
                className="text-xs text-[var(--color-ink-subtle)] hover:text-[var(--color-ev-rojo)]"
              >
                borrar
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function Fila({ etiqueta, valor, bien }: { etiqueta: string; valor: string; bien?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-[var(--color-ink-subtle)]">{etiqueta}</span>
      <span className="flex items-center gap-2 font-[family-name:var(--font-data)] text-xs">
        {bien !== undefined && (
          <i
            className="block h-1.5 w-1.5 rounded-full"
            style={{ background: bien ? 'var(--color-ev-verde)' : 'var(--color-ink-subtle)' }}
          />
        )}
        {valor}
      </span>
    </div>
  );
}
