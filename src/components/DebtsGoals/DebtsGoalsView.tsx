import React, { useState } from 'react';
import { useFinanceStore } from '../../store/useFinanceStore';
import { formatMonto } from '../../utils/money';
import { disponibleCOP, pendienteDeuda } from '../../utils/reglas';
import { HistorialMovimientos } from '../Shared/HistorialMovimientos';
import type { Deuda, Meta, Transaccion } from '../../types';

// Metas y Deudas (Fase 3). Esta vista MUESTRA y abre Registro para anotar (D-037: un solo canal).
// Ya no tiene formularios propios: así aportes, retiros, abonos y deudas nuevas siguen las mismas
// reglas, categorías y validaciones que Registro (corrige E6, E9, E19, E49).

const segBtn = (activo: boolean) =>
  `flex-1 min-h-[44px] px-4 rounded-[14px] text-sm font-medium transition-all ${
    activo ? 'bg-[#0a0a0a] text-[#fafafa] shadow-sm' : 'text-[#737373] hover:text-[#0a0a0a]'
  }`;
const accionBtn =
  'flex-1 min-h-[44px] rounded-[14px] text-sm font-semibold border border-field bg-white text-[#0a0a0a] active:scale-95 transition-all flex items-center justify-center gap-1 disabled:opacity-40';
const tarjeta = 'bg-white p-5 rounded-[24px] border border-[#e5e5e5] shadow-sm flex flex-col gap-3';
const fechaCorta = (f: string, conAno = true) =>
  new Date(f + 'T12:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', ...(conAno ? { year: 'numeric' } : {}) });

const Historial: React.FC<{
  abierto: boolean; onToggle: () => void; movimientos: Transaccion[]; contexto: 'meta' | 'deuda'; deuda?: Deuda; oculto: boolean;
}> = ({ abierto, onToggle, movimientos, contexto, deuda, oculto }) => (
  <div className="border-t border-[#e5e5e5] pt-1">
    <button type="button" onClick={onToggle} aria-expanded={abierto} className="w-full min-h-[44px] text-sm text-[#737373] hover:text-[#0a0a0a] flex items-center justify-center gap-1">
      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">history</span>
      Historial ({movimientos.length})
    </button>
    {abierto && <HistorialMovimientos movimientos={movimientos} contexto={contexto} deuda={deuda} oculto={oculto} />}
  </div>
);

let ultimaPestana: 'deudas' | 'metas' = 'metas';

export const DebtsGoalsView: React.FC = () => {
  const { deudas, metas, cuentas, transacciones, privacyHidden, abrirRegistro, fx } = useFinanceStore();
  // [U24] Recuerda la última pestaña (Metas o Deudas) mientras la app está abierta
  const [activeSubTab, setActiveSubTabEstado] = useState<'deudas' | 'metas'>(ultimaPestana);
  const setActiveSubTab = (p: 'deudas' | 'metas') => { ultimaPestana = p; setActiveSubTabEstado(p); };
  const [historialAbierto, setHistorialAbierto] = useState<string | null>(null);
  const [verSaldadas, setVerSaldadas] = useState(false);

  const oculto = (v: string) => (privacyHidden ? '••••' : v);
  const toggle = (id: string) => setHistorialAbierto(historialAbierto === id ? null : id);
  const activas = deudas.filter((d) => d.estado !== 'saldada');
  const saldadas = deudas.filter((d) => d.estado === 'saldada');
  const apartado = metas.reduce((s, m) => s + m.monto_actual, 0);
  const libre = disponibleCOP(cuentas, metas, fx);
  const aCOP = (v: number, moneda?: string) => v * (moneda === 'USD' ? fx.usdCop : moneda === 'EUR' ? fx.eurCop : 1);
  const totalPor = (tipo: Deuda['tipo']) => activas.filter((d) => d.tipo === tipo).reduce((s, d) => s + aCOP(pendienteDeuda(d), d.moneda), 0);

  const tarjetaMeta = (m: Meta) => {
    const pct = m.monto_objetivo > 0 ? Math.min(100, Math.round((m.monto_actual / m.monto_objetivo) * 100)) : 0;
    const sobrante = m.monto_actual - m.monto_objetivo;
    const movimientos = transacciones.filter((t) => t.meta_id === m.id);
    return (
      <div key={m.id} className={tarjeta}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[#0a0a0a] tracking-tight truncate">{m.nombre}</h3>
            {m.fecha_limite && <p className="text-xs text-[#737373]">Para el {fechaCorta(m.fecha_limite)}</p>}
          </div>
          <span className="text-sm font-semibold text-[#0a0a0a] tabular-nums shrink-0">{sobrante >= 0 ? '¡Cumplida!' : `${pct}%`}</span>
        </div>
        <div>
          <div className="flex justify-between text-sm tabular-nums">
            <span className="font-semibold text-[#0a0a0a]">{oculto(formatMonto(m.monto_actual, 'COP', 'neutro'))}</span>
            <span className="text-[#737373]">de {oculto(formatMonto(m.monto_objetivo, 'COP', 'neutro'))}</span>
          </div>
          <div className="h-2 w-full bg-[#f5f5f5] rounded-full overflow-hidden mt-1.5" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Avance de ${m.nombre}`}>
            <div className="h-full rounded-full transition-all duration-500 bg-[color:var(--transfer)]" style={{ width: `${pct}%` }} />
          </div>
          {sobrante > 0 && <p className="text-xs text-income mt-1">Te sobran {oculto(formatMonto(sobrante, 'COP', 'neutro'))}</p>}
        </div>
        <div className="flex gap-2">
          <button type="button" className={accionBtn} onClick={() => abrirRegistro({ segment: 'metas', metaId: m.id, operacionMeta: 'apartar' })}>
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">south</span> Apartar
          </button>
          <button type="button" className={accionBtn} disabled={m.monto_actual <= 0} onClick={() => abrirRegistro({ segment: 'metas', metaId: m.id, operacionMeta: 'sacar' })}>
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">north</span> Sacar
          </button>
        </div>
        <Historial abierto={historialAbierto === m.id} onToggle={() => toggle(m.id)} movimientos={movimientos} contexto="meta" oculto={privacyHidden} />
      </div>
    );
  };

  const tarjetaDeuda = (d: Deuda) => {
    const moneda = d.moneda || 'COP';
    const pend = pendienteDeuda(d);
    const pct = d.monto_total > 0 ? Math.min(100, Math.round((d.monto_pagado / d.monto_total) * 100)) : 0;
    const cobrar = d.tipo === 'por_cobrar';
    const movimientos = transacciones.filter((t) => t.deuda_id === d.id);
    return (
      <div key={d.id} className={tarjeta}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="text-xs font-medium text-[#737373]">{cobrar ? 'Te debe' : 'Le debes'} · {d.concepto}</span>
            <h3 className="text-base font-semibold text-[#0a0a0a] tracking-tight truncate">{d.contraparte}</h3>
            {d.fecha_vencimiento && d.estado === 'activa' && <p className="text-xs text-[#737373]">Vence el {fechaCorta(d.fecha_vencimiento, false)}</p>}
          </div>
          <div className="text-right shrink-0">
            <div className="text-base font-semibold text-[#0a0a0a] tabular-nums">{oculto(formatMonto(pend, moneda, 'neutro'))}</div>
            <div className="text-xs text-[#737373] tabular-nums">de {oculto(formatMonto(d.monto_total, moneda, 'neutro'))}</div>
          </div>
        </div>
        <div>
          <div className="h-2 w-full bg-[#f5f5f5] rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Pagado de ${d.contraparte}`}>
            <div className="h-full rounded-full transition-all duration-500 bg-[#0a0a0a]" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-[#737373] mt-1 tabular-nums">
            {d.estado === 'saldada' ? 'Saldada' : `Pagado ${oculto(formatMonto(d.monto_pagado, moneda, 'neutro'))} (${pct}%)`}
          </p>
        </div>
        {d.estado === 'activa' && (
          <div className="flex gap-2">
            <button type="button" className={accionBtn} onClick={() => abrirRegistro({ segment: 'deudores', deudaId: d.id, operacionDeuda: 'abono' })}>
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">payments</span> {cobrar ? 'Me pagó' : 'Pagué'}
            </button>
            <button type="button" className={accionBtn} onClick={() => abrirRegistro({ segment: 'deudores', deudaId: d.id, operacionDeuda: 'incremento' })}>
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span> {cobrar ? 'Le presté más' : 'Me prestaron más'}
            </button>
          </div>
        )}
        <Historial abierto={historialAbierto === d.id} onToggle={() => toggle(d.id)} movimientos={movimientos} contexto="deuda" deuda={d} oculto={privacyHidden} />
      </div>
    );
  };

  const botonNuevo = (texto: string, onClick: () => void) => (
    <button type="button" onClick={onClick} className="min-h-[44px] px-4 rounded-[14px] text-sm font-semibold bg-[#0a0a0a] text-[#fafafa] flex items-center gap-1 shrink-0">
      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span> {texto}
    </button>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 pb-28 pt-2 space-y-5">
      <div className="bg-[#f5f5f5] p-1 rounded-[18px] flex gap-1 border border-[#e5e5e5]" role="tablist" aria-label="Metas o deudas">
        <button role="tab" aria-selected={activeSubTab === 'metas'} onClick={() => setActiveSubTab('metas')} className={segBtn(activeSubTab === 'metas')}>Metas</button>
        <button role="tab" aria-selected={activeSubTab === 'deudas'} onClick={() => setActiveSubTab('deudas')} className={segBtn(activeSubTab === 'deudas')}>Deudas</button>
      </div>

      {activeSubTab === 'metas' ? (
        <div className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-[#0a0a0a] tracking-tight">Tus metas</h2>
              <p className="text-sm text-[#737373] tabular-nums">
                Apartado {oculto(formatMonto(apartado, 'COP', 'neutro'))} · Libre {oculto(formatMonto(Math.max(0, libre), 'COP', 'neutro'))}
              </p>
            </div>
            {botonNuevo('Nueva meta', () => abrirRegistro({ segment: 'metas', nuevaMeta: true }))}
          </div>
          <p className="text-xs text-[#737373]">Lo que apartas sigue en tus cuentas; solo deja de contar como libre.</p>
          {metas.length === 0 ? (
            <p className="text-sm text-[#737373]">Aún no tienes metas.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{metas.map(tarjetaMeta)}</div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-[#0a0a0a] tracking-tight">Tus deudas</h2>
              <p className="text-sm text-[#737373] tabular-nums">
                Te deben {oculto(formatMonto(totalPor('por_cobrar'), 'COP', 'neutro'))} · Debes {oculto(formatMonto(totalPor('por_pagar'), 'COP', 'neutro'))}
              </p>
            </div>
            {botonNuevo('Nueva deuda', () => abrirRegistro({ segment: 'deudores', nuevaDeuda: true }))}
          </div>
          {activas.length === 0 ? (
            <p className="text-sm text-[#737373]">No tienes deudas activas.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{activas.map(tarjetaDeuda)}</div>
          )}
          {saldadas.length > 0 && (
            <div>
              <button type="button" onClick={() => setVerSaldadas(!verSaldadas)} aria-expanded={verSaldadas} className="min-h-[44px] text-sm text-[#737373] hover:text-[#0a0a0a] flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">{verSaldadas ? 'expand_less' : 'expand_more'}</span>
                Saldadas ({saldadas.length})
              </button>
              {verSaldadas && <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">{saldadas.map(tarjetaDeuda)}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
