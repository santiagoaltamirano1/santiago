import React, { useState } from 'react';
import { useFinanceStore } from '../../store/useFinanceStore';
import { obtenerDocumento, registrarExportacion } from '../../services/exportService';
import { aMarkdown, estimarTokens } from '../../ia/markdown';
import { armarPaquete, clavesLumi, htmlGraficas, Paquete, TOKENS_META } from '../../ia/paquete';
import { FOCOS, Foco, PLANTILLA_HTML } from '../../ia/agenteAnalista';
import { DocumentoImprimible } from './DocumentoImprimible';

// Iteración 2 · F5 · Sección "Exportar mis datos" (Analítica › Ajustes). Se carga aparte (React.lazy).
// Flujo: elegir formato y rango → Preparar (espera los movimientos pendientes; sin conexión no exporta)
// → vista previa → Copiar / Descargar / PDF. Lumi arma todo en el teléfono y no lo envía a nadie.
// Decisiones provisionales (recomendación de la mesa, a confirmar por la dueña): sección dentro de Ajustes,
// terceros anonimizados por defecto en "Para mi IA" e incluidos en "Solo mis datos", PDF por impresión,
// registro de exportaciones sin contenido.

type Formato = 'ia' | 'md' | 'pdf';
type Rango = 'todo' | 'anio' | 'mes' | 'mes_anterior';

const FORMATOS: { id: Formato; titulo: string; detalle: string; icono: string }[] = [
  { id: 'ia', titulo: 'Para mi IA', detalle: 'Tus datos + un analista financiero. Lo pegas en ChatGPT, Claude o Gemini y te devuelve un informe con gráficas y un plan.', icono: 'auto_awesome' },
  { id: 'md', titulo: 'Solo mis datos', detalle: 'Un documento (.md) con todo: cuentas, metas, deudas y movimientos.', icono: 'description' },
  { id: 'pdf', titulo: 'PDF', detalle: 'Para guardar o imprimir. Usa la opción "Guardar como PDF" de tu teléfono o computador.', icono: 'picture_as_pdf' },
];
const RANGOS: { id: Rango; texto: string }[] = [
  { id: 'todo', texto: 'Todo' }, { id: 'anio', texto: 'Último año' }, { id: 'mes', texto: 'Este mes' }, { id: 'mes_anterior', texto: 'Mes anterior' },
];

const hoyBogota = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
function fechasDe(r: Rango): { desde: string | null; hasta: string | null } {
  const hoy = hoyBogota();
  const [a, m] = [+hoy.slice(0, 4), +hoy.slice(5, 7)];
  const iso = (y: number, mm: number, d: number) => new Date(Date.UTC(y, mm - 1, d)).toISOString().slice(0, 10);
  if (r === 'anio') return { desde: iso(a - 1, m, +hoy.slice(8, 10) + 1), hasta: hoy };
  if (r === 'mes') return { desde: iso(a, m, 1), hasta: hoy };
  if (r === 'mes_anterior') return { desde: iso(a, m - 1, 1), hasta: iso(a, m, 0) };
  return { desde: null, hasta: null };
}

function descargar(texto: string, nombre: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
  const a = document.createElement('a');
  a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copiar(texto: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(texto); return true; } catch { /* sigue con el método antiguo */ }
  const t = document.createElement('textarea');
  t.value = texto; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
  document.body.appendChild(t); t.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  t.remove();
  return ok;
}

interface Resultado { formato: Formato; texto: string; filas: number; tokens: number; kb: number; paquete?: Paquete; md?: string; desde: string; hasta: string }

// min-w-0 + texto que puede partirse: a 360 px dos botones lado a lado no deben empujar la página
const boton = 'min-h-[48px] min-w-0 px-3 rounded-[16px] text-sm font-semibold leading-tight text-center flex items-center justify-center gap-1.5 disabled:opacity-50';

const Exportar: React.FC = () => {
  const privacyHidden = useFinanceStore((s) => s.privacyHidden);
  const [formato, setFormato] = useState<Formato>('ia');
  const [rango, setRango] = useState<Rango>('todo');
  const [foco, setFoco] = useState<Foco>('todo');
  const [anonimizarIA, setAnonimizarIA] = useState(true);
  const [anonimizarDatos, setAnonimizarDatos] = useState(false);
  const [estado, setEstado] = useState<'elegir' | 'preparando' | 'listo' | 'error'>('elegir');
  const [progreso, setProgreso] = useState('');
  const [error, setError] = useState('');
  const [res, setRes] = useState<Resultado | null>(null);
  const [aviso, setAviso] = useState('');
  const [confirmaMontos, setConfirmaMontos] = useState(false);

  const anonimizar = formato === 'ia' ? anonimizarIA : anonimizarDatos;
  const cambiar = (f: () => void) => { f(); if (estado !== 'preparando') { setEstado('elegir'); setRes(null); setAviso(''); } };

  const preparar = async () => {
    setEstado('preparando'); setError(''); setAviso(''); setRes(null); setConfirmaMontos(false);
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('Sin conexión. Conéctate para exportar: Lumi no entrega documentos a medias.');
      // Los movimientos que siguen en sus 5 segundos de "Deshacer" se guardan primero
      setProgreso('Guardando tus últimos movimientos…');
      const st = useFinanceStore.getState();
      for (const p of [...st.pendingUndoList]) await st.commitPendingTransaccion(p.id);
      if (useFinanceStore.getState().pendingUndoList.length > 0) throw new Error('Tienes movimientos sin guardar. Conéctate y vuelve a intentarlo.');

      const { desde, hasta } = fechasDe(rango);
      setProgreso('Leyendo tus datos…');
      const doc = await obtenerDocumento({ desde, hasta, onProgreso: (n) => setProgreso(`Leyendo tus movimientos… ${n}`) });
      setProgreso('Armando el documento…');
      let r: Resultado;
      if (formato === 'ia') {
        const paquete = armarPaquete(doc, { foco, anonimizar: anonimizarIA });
        r = { formato, texto: paquete.texto, filas: doc.movimientos.length, tokens: paquete.tokens, kb: paquete.texto.length / 1024, paquete, desde: doc.resumen.desde, hasta: doc.resumen.hasta };
      } else {
        const md = aMarkdown(doc, { modo: 'datos', anonimizar: anonimizarDatos });
        r = { formato, texto: md, md, filas: doc.movimientos.length, tokens: estimarTokens(md), kb: md.length / 1024, desde: doc.resumen.desde, hasta: doc.resumen.hasta };
      }
      setRes(r);
      setEstado('listo');
      registrarExportacion(formato, r.desde, r.hasta, formato === 'ia' ? ['paquete-ia', `foco:${foco}`] : ['todas'], r.filas);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo exportar. Intenta de nuevo.');
      setEstado('error');
    }
  };

  const bloqueado = privacyHidden && !confirmaMontos;
  const nombreBase = `lumi-${res?.hasta || hoyBogota()}`;

  const accionCopiar = async () => {
    if (!res) return;
    setAviso((await copiar(res.texto)) ? (res.formato === 'ia' ? 'Copiado. Pégalo en un chat nuevo de tu IA.' : 'Copiado.') : 'No se pudo copiar. Usa "Descargar".');
  };
  const accionPdf = () => { setAviso(''); setTimeout(() => window.print(), 50); };

  const preVista = res ? res.texto.slice(res.formato === 'ia' ? res.texto.lastIndexOf('<perfil origen=') : 0).split('\n').slice(0, 14).join('\n') : '';

  return (
    <section id="exportar" aria-labelledby="exportar-titulo" className="bg-white p-5 rounded-[24px] border border-[#e5e5e5] space-y-4">
      <div>
        <h2 id="exportar-titulo" className="text-xl font-semibold text-[#0a0a0a] tracking-tight flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">ios_share</span> Exportar mis datos
        </h2>
        <p className="text-xs text-[#737373]">Lumi lo arma en tu teléfono y no lo envía a nadie.</p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-[#0a0a0a] mb-1">¿Para qué lo quieres?</legend>
        {FORMATOS.map((f) => (
          <label key={f.id} className={`flex gap-3 items-start p-3 rounded-[16px] border cursor-pointer min-h-[56px] ${formato === f.id ? 'border-[#0a0a0a] ring-2 ring-[#0a0a0a]/10' : 'border-[#e5e5e5]'}`}>
            <input type="radio" name="exp-formato" value={f.id} checked={formato === f.id} onChange={() => cambiar(() => setFormato(f.id))} className="mt-1 w-4 h-4 accent-[#0a0a0a]" />
            <span className="material-symbols-outlined text-[20px] text-[#0a0a0a] mt-0.5" aria-hidden="true">{f.icono}</span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[#0a0a0a]">{f.titulo}{f.id === 'ia' && <span className="ml-2 text-[11px] font-medium text-[#737373]">Recomendado</span>}</span>
              <span className="block text-xs text-[#737373]">{f.detalle}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium text-[#0a0a0a] mb-2">¿De qué fechas?</legend>
        <div className="flex flex-wrap gap-2">
          {RANGOS.map((r) => (
            <label key={r.id} className={`min-h-[44px] px-3.5 rounded-full border text-sm font-medium flex items-center gap-1.5 cursor-pointer ${rango === r.id ? 'bg-[#0a0a0a] text-[#fafafa] border-[#0a0a0a]' : 'bg-white text-[#0a0a0a] border-field'}`}>
              <input type="radio" name="exp-rango" value={r.id} checked={rango === r.id} onChange={() => cambiar(() => setRango(r.id))} className="sr-only" />
              {r.texto}
            </label>
          ))}
        </div>
      </fieldset>

      {formato === 'ia' && (
        <div>
          <label htmlFor="exp-foco" className="text-sm font-medium text-[#0a0a0a] block mb-1">¿En qué quieres que se enfoque?</label>
          <select id="exp-foco" value={foco} onChange={(e) => cambiar(() => setFoco(e.target.value as Foco))}
            className="w-full bg-[#f5f5f5] text-[#0a0a0a] text-sm min-h-[44px] px-3 rounded-[14px] border border-field">
            {FOCOS.map((f) => <option key={f.id} value={f.id}>{f.texto}</option>)}
          </select>
        </div>
      )}

      <label className="flex items-start gap-3 min-h-[44px] text-sm text-[#0a0a0a] cursor-pointer">
        <input type="checkbox" checked={anonimizar} onChange={(e) => cambiar(() => (formato === 'ia' ? setAnonimizarIA : setAnonimizarDatos)(e.target.checked))} className="mt-0.5 w-5 h-5 accent-[#0a0a0a]" />
        <span>Cambiar los nombres de otras personas por "Persona A, B…"{formato === 'ia' && <span className="block text-xs text-[#737373]">Recomendado si lo vas a pegar en una IA.</span>}</span>
      </label>

      <button type="button" onClick={preparar} disabled={estado === 'preparando'} className={`${boton} w-full bg-[#0a0a0a] text-[#fafafa]`}>
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{estado === 'preparando' ? 'hourglass_top' : 'inventory_2'}</span>
        {estado === 'preparando' ? 'Preparando…' : estado === 'listo' ? 'Preparar de nuevo' : 'Preparar'}
      </button>

      <div role="status" aria-live="polite" className="text-sm">
        {estado === 'preparando' && <p className="text-[#737373]">{progreso}</p>}
        {estado === 'error' && <p className="text-[#b42318]">{error}</p>}
      </div>

      {estado === 'listo' && res && (
        <div className="space-y-3">
          <p className="text-sm text-[#0a0a0a]">
            <b>Listo:</b> {res.filas} movimientos · {res.kb.toFixed(0)} KB · unos {res.tokens.toLocaleString('es-CO')} tokens
            {res.paquete?.compacto && ' · versión compacta (sin la lista de movimientos)'}
          </p>
          {res.tokens > TOKENS_META && <p className="text-xs text-[#a15c07]">Es un documento grande: algunas IA gratuitas lo cortan. Si pasa, elige un rango más corto.</p>}

          <div>
            <p className="text-xs font-medium text-[#737373] mb-1">Vista previa</p>
            {privacyHidden ? (
              <div className="bg-[#f5f5f5] rounded-[14px] p-3 text-xs text-[#737373] space-y-2">
                <p>La vista previa está oculta porque tienes el ojo cerrado. <b>El archivo sí lleva tus montos reales.</b></p>
                <label className="flex items-start gap-2 min-h-[44px] text-sm text-[#0a0a0a] cursor-pointer">
                  <input type="checkbox" checked={confirmaMontos} onChange={(e) => setConfirmaMontos(e.target.checked)} className="mt-0.5 w-5 h-5 accent-[#0a0a0a]" />
                  Entiendo, quiero copiarlo o descargarlo
                </label>
              </div>
            ) : (
              <pre className="bg-[#f5f5f5] rounded-[14px] p-3 text-[11px] leading-snug text-[#0a0a0a] max-h-56 overflow-auto whitespace-pre-wrap break-words">{preVista}{'\n…'}</pre>
            )}
          </div>

          {res.formato === 'ia' && (
            <>
              <button type="button" onClick={accionCopiar} disabled={bloqueado} className={`${boton} w-full bg-[#0a0a0a] text-[#fafafa]`}>
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">content_copy</span> Copiar para mi IA
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={bloqueado} onClick={() => descargar(res.texto, `${nombreBase}-para-ia.txt`, 'text/plain;charset=utf-8')} className={`${boton} border border-field bg-white text-[#0a0a0a]`}>
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">download</span> Descargar
                </button>
                <button type="button" disabled={bloqueado} onClick={() => res.paquete && descargar(htmlGraficas(res.paquete, clavesLumi(res.paquete), PLANTILLA_HTML), `${nombreBase}-graficas.html`, 'text/html;charset=utf-8')} className={`${boton} border border-field bg-white text-[#0a0a0a]`}>
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">bar_chart</span> Mis gráficas
                </button>
              </div>
              <div className="bg-[#f5f5f5] rounded-[14px] p-3 text-xs text-[#525252] space-y-1.5">
                <p><b>Cómo usarlo:</b> abre un chat nuevo en tu IA, pega y envía. Si no ves las gráficas, guarda el bloque de código como <i>informe.html</i>, o usa "Mis gráficas", que arma Lumi sin IA.</p>
                <p><b>Ojo con las cifras:</b> las que llevan un código como [I04] salen de Lumi. Si la IA escribe una cifra sin código, la calculó ella: compárala con Lumi antes de decidir.</p>
              </div>
            </>
          )}
          {res.formato === 'md' && (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={accionCopiar} disabled={bloqueado} className={`${boton} bg-[#0a0a0a] text-[#fafafa]`}>
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">content_copy</span> Copiar todo
              </button>
              <button type="button" disabled={bloqueado} onClick={() => descargar(res.texto, `${nombreBase}.md`, 'text/markdown;charset=utf-8')} className={`${boton} border border-field bg-white text-[#0a0a0a]`}>
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">download</span> Descargar .md
              </button>
            </div>
          )}
          {res.formato === 'pdf' && res.md && (
            <>
              <button type="button" onClick={accionPdf} disabled={bloqueado} className={`${boton} w-full bg-[#0a0a0a] text-[#fafafa]`}>
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">print</span> Guardar como PDF
              </button>
              <DocumentoImprimible markdown={res.md} />
            </>
          )}
          {aviso && <p role="status" className="text-sm text-[#0f766e]">{aviso}</p>}
        </div>
      )}

      <p className="text-xs text-[#737373]">
        <b>Privacidad:</b> si lo pegas en ChatGPT, Claude u otra herramienta, esa empresa lo recibe bajo sus propias reglas. Usa un chat temporal o desactiva que entrenen con tus datos. Nunca incluye tu correo ni tus contraseñas.
      </p>
    </section>
  );
};

export default Exportar;
