'use client';

/**
 * El contenido de cada widget.
 *
 * Los que ya tienen modelo (bienvenida, entrega, calendario) leen datos vivos del almacén.
 * Los que aún no lo tienen (clases, asignaturas, horas de taller) muestran datos de
 * ejemplo marcados como tales: entran en el modelo cuando les toque su colección.
 */

import { useEffect, useMemo, useState } from 'react';

import { useAhora, useEventos, useProximaEntrega, useTareas, useTareasDeHoy } from '@/hooks/useDatos';
import { useArchicel } from '@/lib/firebase/sesion';
import { NOMBRE_PROGRESO, aFecha, deFecha, hhmm, progresoDe, type Tarea, type TipoEvento } from '@/lib/data';
import { Nivel, TIPOS } from '@/lib/ui/catalogo';

const USUARIA = 'Celeste';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/* ───────────────────────── bienvenida ───────────────────────── */

/**
 * Un trozo del saludo. `fuerte` es lo único que decide el énfasis.
 *
 * El mensaje se arma con estos trozos y no con una cadena de HTML: dentro van títulos
 * que escribe la usuaria, y montarlos con `dangerouslySetInnerHTML` significaba que una
 * tarea llamada `<img onerror=…>` se ejecutaba al abrir el escritorio. React escapa cada
 * trozo por su cuenta, así que el texto es texto pase lo que pase.
 */
interface Trozo {
  txt: string;
  fuerte?: boolean;
}

export function Bienvenida() {
  const tareas = useTareasDeHoy();
  const entrega = useProximaEntrega();
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setListo(true), 1700);
    return () => clearTimeout(t);
  }, []);

  /* Sin hora del cliente no hay saludo posible: el servidor no sabe qué hora es donde
     está ella. Hasta que llega se enseña el saludo neutro, que es igual en los dos lados
     y por tanto no salta al hidratar. */
  const f = useAhora();
  const h = f ? f.getHours() : -1;
  const saludo =
    !f ? 'Hola,'
    : h < 5 ? 'Aún despierta,' : h < 8 ? 'Muy buenos días,' : h < 13 ? 'Buenos días,' : h < 15 ? 'Buenas,' : h < 21 ? 'Buenas tardes,' : 'Buenas noches,';

  const mensaje = useMemo<Trozo[]>(() => {
    if (!f) return [];
    const fecha = f.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    const pend = tareas.filter((t) => progresoDe(t) !== 'hecha');
    const ahora = h * 60 + f.getMinutes();
    const prox = pend.find((t) => t.fin > ahora);
    const p: Trozo[] = [{ txt: 'Hoy es ' }, { txt: fecha, fuerte: true }, { txt: '. ' }];

    if (!tareas.length) {
      p.push({ txt: 'No hay nada en la agenda todavía: buen momento para plantear el día.' });
    } else if (!pend.length) {
      p.push({ txt: 'Has cerrado ' }, { txt: `las ${tareas.length} tareas`, fuerte: true }, { txt: ' del día.' });
    } else if (prox && prox.ini - ahora > 0 && prox.ini - ahora <= 45) {
      p.push({ txt: prox.titulo, fuerte: true }, { txt: ' empieza en ' }, { txt: `${prox.ini - ahora} min`, fuerte: true }, { txt: '.' });
    } else if (prox) {
      p.push(
        { txt: 'Te quedan ' },
        { txt: `${pend.length} ${pend.length === 1 ? 'tarea' : 'tareas'}`, fuerte: true },
        { txt: ' y la siguiente es ' },
        { txt: prox.titulo, fuerte: true },
        { txt: ` a las ${hhmm(prox.ini)}.` },
      );
    } else {
      p.push({ txt: 'Se te ha hecho tarde: ' }, { txt: `${pend.length} sin marcar`, fuerte: true }, { txt: '.' });
    }

    if (entrega) {
      p.push({ txt: ' ' });
      if (entrega.dias === 0) p.push({ txt: `${entrega.evento.titulo} es hoy`, fuerte: true }, { txt: '.' });
      else if (entrega.dias === 1) p.push({ txt: entrega.evento.titulo, fuerte: true }, { txt: ' es ' }, { txt: 'mañana', fuerte: true }, { txt: '.' });
      else p.push({ txt: `${entrega.evento.titulo} es en ` }, { txt: `${entrega.dias} días`, fuerte: true }, { txt: '.' });
    }
    return p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tareas, entrega]);

  return (
    <div className="hola">
      <h1 className={`nombre${listo ? ' listo' : ''}`} tabIndex={0}>
        <span className="saludo">{saludo}</span>
        {USUARIA.split('').map((c, i) => (
          <span className="ltr" key={i} style={{ ['--i' as string]: i }}>
            {c}
          </span>
        ))}
      </h1>
      <p className="mensaje">
        {mensaje.map((t, i) => (t.fuerte ? <b key={i}>{t.txt}</b> : <span key={i}>{t.txt}</span>))}
      </p>
    </div>
  );
}

/* ───────────────────────── entrega ───────────────────────── */

export function Entrega() {
  const entrega = useProximaEntrega();
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!entrega) return;
    const destino = entrega.dias;
    const desde = Math.max(1, Math.round(destino / 3));
    let t0: number | null = null;
    let raf = 0;
    const paso = (ts: number) => {
      if (t0 === null) t0 = ts;
      const p = Math.min((ts - t0) / 900, 1);
      setN(Math.round(desde + (destino - desde) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [entrega]);

  if (!entrega) {
    return (
      <div className="countdown">
        <div className="top">
          <span className="title">Sin entregas a la vista</span>
        </div>
        <p className="legend">Añade una desde el calendario.</p>
      </div>
    );
  }

  const f = new Date(entrega.evento.fecha + 'T00:00:00');
  const etiqueta = `${f.getDate()} ${f.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '').slice(0, 3).toUpperCase()}`;

  return (
    <div className="countdown">
      <div className="top">
        <span className="title">{entrega.evento.titulo}</span>
        <span className="tag">{etiqueta}</span>
      </div>
      <div className="metric">
        <span className="n">{n}</span>
        <span className="u">{n === 1 ? 'día' : 'días'}</span>
      </div>
      <div className="bar">
        <b style={{ ['--w' as string]: '66%' }} />
      </div>
      <div className="legend">
        <span>{entrega.evento.materia ?? 'Proyectos IV'}</span>
        {/* sin recorte por caracteres: el ancho real manda y el CSS pone los puntos */}
        <span title={entrega.evento.nota ?? undefined}>{entrega.evento.nota ?? ''}</span>
      </div>
    </div>
  );
}

/* ───────────────────────── clases (ejemplo) ───────────────────────── */

const CLASES_EJEMPLO = [
  { h: '09:00', n: 'Proyectos IV · corrección', w: 'aula 3.2 · llevar sección 1:20' },
  { h: '12:30', n: 'Estructuras III', w: 'aula 1.4 · problemas 4–6' },
  { h: '16:00', n: 'Taller libre', w: 'planta −1 · cortadora reservada' },
];

export function Horario() {
  const finde = [0, 6].includes(new Date().getDay());
  return (
    <>
      <div className="head">
        <h2>{finde ? 'El lunes en la escuela' : 'Hoy en la escuela'}</h2>
        <span className="side-note">{CLASES_EJEMPLO.length} clases</span>
      </div>
      <div className="schedule">
        {CLASES_EJEMPLO.map((c) => (
          <div className="class" key={c.h}>
            <span className="h">{c.h}</span>
            <span>
              <span className="n">{c.n}</span>
              <span className="w">{c.w}</span>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

/* ───────────────────────── mini calendario ─────────────────────────

   El acceso rápido al mes desde el escritorio. Dos piezas en una:

     · la rejilla, donde cada día lleva debajo un punto por cada TIPO de evento que
       tenga —entrega ámbar, examen rojo, presentación violeta—. Un día sin punto es
       un día libre, y eso se lee de un vistazo sin contar nada.
     · los próximos eventos, plegables, con los días que faltan.

   Los puntos son por tipo, no por evento: tres entregas el mismo día ponen un punto,
   no tres. Lo que importa de un vistazo es "ese día hay entrega", no cuántas.        */

export function MiniCalendario() {
  const hoyD = new Date();
  const mes = hoyD.getMonth();
  const anio = hoyD.getFullYear();
  const primero = `${anio}-${pad(mes + 1)}-01`;
  const ultimo = `${anio}-${pad(mes + 1)}-${pad(new Date(anio, mes + 1, 0).getDate())}`;
  const eventos = useEventos({ desde: primero, hasta: ultimo });
  const [abierto, setAbierto] = useState(true);

  /* qué tipos de evento cae en cada día del mes */
  const marcas = useMemo(() => {
    const m: Record<number, TipoEvento[]> = {};
    eventos.forEach((e) => {
      const d = Number(e.fecha.slice(8, 10));
      m[d] = m[d] ?? [];
      if (!m[d].includes(e.tipo)) m[d].push(e.tipo);
    });
    return m;
  }, [eventos]);

  /**
   * Los tres que vienen, contando desde hoy.
   *
   * Se comparan cadenas `YYYY-MM-DD` y no fechas: ordenan igual, y así un evento de hoy
   * sigue contando como próximo hasta que el día termina, sin depender de la hora.
   */
  const proximos = useMemo(() => {
    const hoyClave = aFecha(hoyD);
    return eventos
      .filter((e) => e.fecha >= hoyClave)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .slice(0, 3);
  }, [eventos, hoyD]);

  const offset = (new Date(anio, mes, 1).getDay() + 6) % 7;
  const total = new Date(anio, mes + 1, 0).getDate();
  const previo = new Date(anio, mes, 0).getDate();
  const celdas: Array<{ n: number; fuera: boolean; hoy: boolean; tipos: TipoEvento[] }> = [];
  for (let p = offset; p > 0; p--) celdas.push({ n: previo - p + 1, fuera: true, hoy: false, tipos: [] });
  for (let d = 1; d <= total; d++)
    celdas.push({ n: d, fuera: false, hoy: d === hoyD.getDate(), tipos: marcas[d] ?? [] });
  const cola = (7 - ((offset + total) % 7)) % 7;
  for (let t = 1; t <= cola; t++) celdas.push({ n: t, fuera: true, hoy: false, tipos: [] });

  const nombreMes = hoyD.toLocaleDateString('es-ES', { month: 'long' });

  return (
    <>
      <div className="head">
        <h2>{nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)}</h2>
        <span className="side-note">{eventos.length === 1 ? '1 evento' : `${eventos.length} eventos`}</span>
      </div>

      <div className="cal-grid" role="grid">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
          <span className="dow" role="columnheader" key={d}>
            {d}
          </span>
        ))}
        {celdas.map((c, i) => (
          <span
            key={i}
            role="gridcell"
            className={`cell${c.fuera ? ' out' : ''}${c.hoy ? ' today' : ''}`}
            style={{ animationDelay: `${i * 11}ms` }}
          >
            <span className="n">{c.n}</span>
            {/* el hueco se reserva siempre: sin él, los días con punto son más altos
                que los vacíos y la rejilla baila al cambiar de mes */}
            <span className="dots">
              {c.tipos.slice(0, 3).map((t) => (
                <i key={t} style={{ background: `var(--c-${TIPOS[t].color})` }} title={TIPOS[t].n} />
              ))}
            </span>
          </span>
        ))}
      </div>

      <div className={`prox${abierto ? ' on' : ''}`}>
        <button
          type="button"
          className="prox-cab"
          aria-expanded={abierto}
          onClick={() => setAbierto((v) => !v)}
        >
          <span>Próximos eventos</span>
          <span className="prox-n">{proximos.length}</span>
          <svg className="prox-flecha" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {/* La altura se anima con `grid-template-rows` de 0fr a 1fr: es la única forma
            de ir a "lo que mida el contenido" sin animar `height`, que provoca reflujo
            en cada fotograma y no sabe cuánto mide el destino. */}
        <div className="prox-caja">
          <div className="prox-lista">
            {proximos.length === 0 ? (
              <p className="prox-vacio">Nada en el horizonte este mes.</p>
            ) : (
              proximos.map((e) => (
                <span className="prox-fila" key={e.id} style={{ ['--tc' as string]: `var(--c-${TIPOS[e.tipo].color})` }}>
                  <i className="prox-pt" />
                  <span className="prox-tit">{e.titulo}</span>
                  <span className="prox-fecha">{diaCorto(e.fecha)}</span>
                  <span className="prox-faltan">{faltan(e.fecha, hoyD)}</span>
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/** `2026-09-24` → `24 sep`. */
function diaCorto(f: string): string {
  const d = deFecha(f);
  return `${d.getDate()} ${d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')}`;
}

/** Cuánto falta, dicho como lo diría una persona. */
function faltan(f: string, desde: Date): string {
  const a = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
  const b = deFecha(f);
  const dias = Math.round((b.getTime() - a.getTime()) / 86400000);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'mañana';
  return `${dias} días`;
}

/* ───────────────────────── pendientes ───────────────────────── */

export function Pendientes() {
  /* el widget tiene su propio día: por eso no usa `useTareasDeHoy`, que va fijo a hoy */
  const [dia, setDia] = useState(() => new Date());
  const clave = aFecha(dia);
  const tareas = useTareas({ desde: clave, hasta: clave });
  const { almacen } = useArchicel();

  const ordenadas = useMemo(() => [...tareas].sort((a, b) => a.ini - b.ini), [tareas]);
  const hechas = ordenadas.filter((t) => progresoDe(t) === 'hecha').length;
  const quedan = ordenadas.length - hechas;

  const marcar = (t: Tarea) => {
    const hecha = progresoDe(t) !== 'hecha';
    almacen.tareas.guardar({ ...t, hecha, progreso: hecha ? 'hecha' : 'sin-empezar' }).catch(() => {});
  };

  const mover = (d: number) => {
    const x = new Date(dia);
    x.setDate(dia.getDate() + d);
    setDia(x);
  };

  /* "Hoy" y "Mañana" se leen mejor que una fecha; a partir de ahí, la fecha */
  const hoyClave = aFecha(new Date());
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  const titulo =
    clave === hoyClave
      ? 'Hoy'
      : clave === aFecha(manana)
        ? 'Mañana'
        : clave === aFecha(ayer)
          ? 'Ayer'
          : dia.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' });

  return (
    <>
      <div className="head">
        <h2>{titulo.charAt(0).toUpperCase() + titulo.slice(1)}</h2>
        <span className="dia-paso">
          <button type="button" aria-label="Día anterior" onClick={() => mover(-1)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m14 6-6 6 6 6" />
            </svg>
          </button>
          <span className="side-note">
            {hechas} / {ordenadas.length}
          </span>
          <button type="button" aria-label="Día siguiente" onClick={() => mover(1)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m10 6 6 6-6 6" />
            </svg>
          </button>
        </span>
      </div>
      <div className="todo">
        {ordenadas.length === 0 && (
          <p className="side-note" style={{ padding: '6px 4px' }}>
            Nada apuntado {clave === hoyClave ? 'para hoy' : 'este día'}.
          </p>
        )}
        {ordenadas.map((t) => {
          const g = progresoDe(t);
          return (
            <button
              className={`task prog-${g}`}
              type="button"
              key={t.id}
              aria-pressed={g === 'hecha'}
              title={`${t.titulo} · ${NOMBRE_PROGRESO[g]}`}
              onClick={() => marcar(t)}
            >
              <span className="box">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m5 12.5 4.5 4.5L19 7" />
                </svg>
              </span>
              <span className="t">
                {t.titulo}
                <span className="m">
                  {hhmm(t.ini)} – {hhmm(t.fin)}
                </span>
              </span>
              <Nivel prio={t.prio} tam={12} />
            </button>
          );
        })}
      </div>
      <div className="todo-foot">
        <span>{clave}</span>
        <span>{quedan === 0 ? 'todo hecho' : quedan === 1 ? '1 sin hacer' : `${quedan} sin hacer`}</span>
      </div>
    </>
  );
}

/* ───────────────────────── asignaturas y horas (ejemplo) ───────────────────────── */

const CURSOS_EJEMPLO = [
  { n: 'Proyectos IV', m: 'taller', p: 72 },
  { n: 'Estructuras III', m: 'problemas 4–6', p: 45 },
  { n: 'Urbanismo II', m: 'memoria entregada', p: 85 },
];

export function Cuatrimestre() {
  return (
    <>
      <div className="head">
        <h2>Este cuatrimestre</h2>
        <span className="side-note">{CURSOS_EJEMPLO.length} asignaturas</span>
      </div>
      <div className="courses">
        {CURSOS_EJEMPLO.map((c) => (
          <div className="course" key={c.n}>
            <svg className="ring" viewBox="0 0 44 44" aria-hidden="true">
              <circle className="track" cx="22" cy="22" r="19" />
              <circle className="val" cx="22" cy="22" r="19" style={{ ['--off' as string]: Math.round(120 - (120 * c.p) / 100) }} />
            </svg>
            <span>
              <span className="name">{c.n}</span>
              <span className="meta">{c.m}</span>
            </span>
            <span className="pct">{c.p}%</span>
          </div>
        ))}
      </div>
    </>
  );
}

export function HorasTaller() {
  const semana = [34, 52, 26, 100, 64, 18, 44];
  return (
    <>
      <div className="head">
        <h2>Horas de taller</h2>
        <span className="side-note">27 h esta semana</span>
      </div>
      <div className="bars">
        {semana.map((h, i) => (
          <div key={i} className={h === 100 ? 'peak' : ''} style={{ ['--h' as string]: `${h}%` }} />
        ))}
      </div>
      <div className="scale">
        <span>lun</span>
        <span>mié</span>
        <span>vie</span>
        <span>dom</span>
      </div>
    </>
  );
}

/* ───────────────────────── reloj ───────────────────────── */

export function Reloj() {
  /* se refresca sola cada segundo, y antes de montar no hay hora que enseñar */
  const ahora = useAhora(1000);

  const hh = ahora ? ahora.getHours() : -1;
  const franja =
    !ahora ? '' : hh < 6 ? 'madrugada' : hh < 13 ? 'mañana' : hh < 21 ? 'tarde' : 'noche';

  /* Los dígitos no se montan hasta que hay hora. Con un valor de relleno, el primer
     cambio los haría voltear nada más entrar —un giro que no corresponde a ningún paso
     de minuto— y además el dígito saliente se quedaría en el DOM. El hueco mantiene su
     alto mientras tanto, así que no hay salto. */
  return (
    <div className="reloj">
      <div className="marcador">
        {ahora ? (
          <>
            <Digito valor={pad(ahora.getHours())[0]} />
            <Digito valor={pad(ahora.getHours())[1]} />
            <span className="dos-puntos">:</span>
            <Digito valor={pad(ahora.getMinutes())[0]} />
            <Digito valor={pad(ahora.getMinutes())[1]} />
          </>
        ) : (
          <span className="dg" aria-hidden="true">
            <b className="num"> </b>
          </span>
        )}
      </div>
      <span className="sufijo">{franja}</span>
    </div>
  );
}

/** Cada dígito vive en su ventana: el viejo sale por arriba y el nuevo entra por abajo. */
function Digito({ valor }: { valor: string }) {
  const [pila, setPila] = useState<string[]>([valor]);
  useEffect(() => {
    setPila((p) => (p[p.length - 1] === valor ? p : [...p.slice(-1), valor]));
  }, [valor]);

  return (
    <span className="dg">
      {pila.map((v, i) => (
        <b key={`${v}-${i}`} className={`num${pila.length > 1 ? (i === 0 ? ' fuera' : ' dentro') : ''}`}>
          {v}
        </b>
      ))}
    </span>
  );
}

/**
 * El catálogo de contenidos disponibles.
 *
 * Quién se monta lo decide `WIDGETS` en el registro, no este mapa: aquí puede haber más
 * de lo que hay en pantalla. `entrega`, `horario`, `cuatrimestre` y `horas` están
 * escritos y probados pero fuera del escritorio; devolverlos es añadir su línea al
 * registro, sin tocar nada más.
 */
export const CONTENIDOS: Record<string, () => React.JSX.Element> = {
  bienvenida: Bienvenida,
  entrega: Entrega,
  horario: Horario,
  calendario: MiniCalendario,
  pendientes: Pendientes,
  cuatrimestre: Cuatrimestre,
  horas: HorasTaller,
  reloj: Reloj,
};
