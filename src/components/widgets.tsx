'use client';

/**
 * El contenido de cada widget.
 *
 * Los que ya tienen modelo (bienvenida, entrega, calendario) leen datos vivos del almacén.
 * Los que aún no lo tienen (clases, asignaturas, horas de taller) muestran datos de
 * ejemplo marcados como tales: entran en el modelo cuando les toque su colección.
 */

import { useEffect, useMemo, useState } from 'react';

import { useEventos, useProximaEntrega, useTareas, useTareasDeHoy } from '@/hooks/useDatos';
import { useArchicel } from '@/lib/firebase/sesion';
import { aFecha, hhmm, type Tarea } from '@/lib/data';

const USUARIA = 'Celeste';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/* ───────────────────────── bienvenida ───────────────────────── */

export function Bienvenida() {
  const tareas = useTareasDeHoy();
  const entrega = useProximaEntrega();
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setListo(true), 1700);
    return () => clearTimeout(t);
  }, []);

  const f = new Date();
  const h = f.getHours();
  const saludo =
    h < 5 ? 'Aún despierta,' : h < 8 ? 'Muy buenos días,' : h < 13 ? 'Buenos días,' : h < 15 ? 'Buenas,' : h < 21 ? 'Buenas tardes,' : 'Buenas noches,';

  const mensaje = useMemo(() => {
    const fecha = f.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    const pend = tareas.filter((t) => !t.hecha);
    const ahora = h * 60 + f.getMinutes();
    const prox = pend.find((t) => t.fin > ahora);
    const trozos = [`Hoy es <b>${fecha}</b>.`];

    if (!tareas.length) trozos.push('No hay nada en la agenda todavía: buen momento para plantear el día.');
    else if (!pend.length) trozos.push(`Has cerrado <b>las ${tareas.length} tareas</b> del día.`);
    else if (prox && prox.ini - ahora > 0 && prox.ini - ahora <= 45)
      trozos.push(`<b>${prox.titulo.toLowerCase()}</b> empieza en <b>${prox.ini - ahora} min</b>.`);
    else if (prox)
      trozos.push(
        `Te quedan <b>${pend.length} ${pend.length === 1 ? 'tarea' : 'tareas'}</b> y la siguiente es <b>${prox.titulo.toLowerCase()}</b> a las ${hhmm(prox.ini)}.`,
      );
    else trozos.push(`Se te ha hecho tarde: <b>${pend.length} sin marcar</b>.`);

    if (entrega) {
      if (entrega.dias === 0) trozos.push(`<b>${entrega.evento.titulo} es hoy</b>.`);
      else if (entrega.dias === 1) trozos.push(`<b>${entrega.evento.titulo}</b> es <b>mañana</b>.`);
      else trozos.push(`${entrega.evento.titulo} es en <b>${entrega.dias} días</b>.`);
    }
    return trozos.join(' ');
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
      <p className="mensaje" dangerouslySetInnerHTML={{ __html: mensaje }} />
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
        <span>{entrega.evento.nota ? entrega.evento.nota.slice(0, 22) : ''}</span>
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

/* ───────────────────────── calendario ───────────────────────── */

export function MiniCalendario() {
  const hoyD = new Date();
  const mes = hoyD.getMonth();
  const anio = hoyD.getFullYear();
  const primero = `${anio}-${pad(mes + 1)}-01`;
  const ultimo = `${anio}-${pad(mes + 1)}-${pad(new Date(anio, mes + 1, 0).getDate())}`;
  const eventos = useEventos({ desde: primero, hasta: ultimo });
  const tareas = useTareas({ desde: primero, hasta: ultimo });

  const marcas = useMemo(() => {
    const m: Record<number, string[]> = {};
    const anota = (fecha: string, tipo: string) => {
      const d = Number(fecha.slice(8, 10));
      m[d] = m[d] ?? [];
      if (!m[d].includes(tipo)) m[d].push(tipo);
    };
    eventos.forEach((e) => anota(e.fecha, e.tipo === 'entrega' ? 'entrega' : 'correccion'));
    tareas.forEach((t) => anota(t.fecha, 'clase'));
    return m;
  }, [eventos, tareas]);

  const offset = (new Date(anio, mes, 1).getDay() + 6) % 7;
  const total = new Date(anio, mes + 1, 0).getDate();
  const previo = new Date(anio, mes, 0).getDate();
  const celdas: Array<{ n: number; fuera: boolean; hoy: boolean; tipos: string[] }> = [];
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
        <span className="side-note">{eventos.length} eventos</span>
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
            className={`cell${c.fuera ? ' out' : ''}${c.hoy ? ' today' : ''}${c.tipos.includes('entrega') ? ' has-entrega' : ''}`}
            style={{ animationDelay: `${i * 11}ms` }}
          >
            <span>{c.n}</span>
            <span className="dots">
              {c.tipos.map((t) => (
                <i className={`dot-${t}`} key={t} />
              ))}
            </span>
          </span>
        ))}
      </div>
    </>
  );
}

/* ───────────────────────── pendientes ───────────────────────── */

export function Pendientes() {
  const tareas = useTareasDeHoy();
  const { almacen } = useArchicel();

  const marcar = (t: Tarea) => {
    almacen.tareas.guardar({ ...t, hecha: !t.hecha }).catch(() => {});
  };

  const hechas = tareas.filter((t) => t.hecha).length;
  const quedan = tareas.length - hechas;

  return (
    <>
      <div className="head">
        <h2>Hoy</h2>
        <span className="side-note">
          {hechas} / {tareas.length}
        </span>
      </div>
      <div className="todo">
        {tareas.length === 0 && (
          <p className="side-note" style={{ padding: '6px 4px' }}>
            Nada apuntado para hoy.
          </p>
        )}
        {tareas.map((t) => (
          <button
            className="task"
            type="button"
            key={t.id}
            aria-pressed={t.hecha}
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
          </button>
        ))}
      </div>
      <div className="todo-foot">
        <span>{aFecha(new Date())}</span>
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
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const h = pad(ahora.getHours());
  const m = pad(ahora.getMinutes());
  const franja =
    ahora.getHours() < 6 ? 'madrugada' : ahora.getHours() < 13 ? 'mañana' : ahora.getHours() < 21 ? 'tarde' : 'noche';

  return (
    <div className="reloj">
      <div className="marcador">
        <Digito valor={h[0]} />
        <Digito valor={h[1]} />
        <span className="dos-puntos">:</span>
        <Digito valor={m[0]} />
        <Digito valor={m[1]} />
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
