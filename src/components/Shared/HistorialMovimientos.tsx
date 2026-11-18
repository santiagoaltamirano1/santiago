import React from 'react';
import type { Deuda, Moneda, Transaccion } from '../../types';
import { formatMonto } from '../../utils/money';

// Historial único para metas y deudas (Fase 3, N6/E34). Nunca borra filas: cada aporte, retiro,
// abono o aumento queda como su propio movimiento. Muestra lo APLICADO en la moneda de la meta (COP)
// o de la deuda; si es un movimiento viejo sin monto_aplicado, muestra el monto en su propia moneda.

interface Props {
  movimientos: Transaccion[];
  contexto: 'meta' | 'deuda';
  deuda?: Deuda;
  oculto?: boolean;
}

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' });

function describir(t: Transaccion, contexto: Props['contexto'], deuda?: Deuda): { texto: string; icono: string; signo: 'ingreso' | 'gasto' | 'neutro' } {
  if (contexto === 'meta') {
    const saca = t.tipo === 'retiro_meta';
    return { texto: saca ? 'Sacado' : 'Apartado', icono: saca ? 'north' : 'south', signo: saca ? 'gasto' : 'ingreso' };
  }
  // Deuda: "aumento" sube lo que se debe; "abono" lo baja.
  const aumento = t.tipo === 'prestamo_capital' || t.operacion_deuda === 'incremento';
  // [U10] Capital de deudas: ni ingreso ni gasto (D-030) → sin signo; el texto dice qué pasó
  if (aumento) return { texto: deuda?.tipo === 'por_cobrar' ? 'Le prestaste' : 'Te prestaron', icono: 'add', signo: 'neutro' };
  return { texto: deuda?.tipo === 'por_cobrar' ? 'Te pagó' : 'Pagaste', icono: 'check', signo: 'neutro' };
}

export const HistorialMovimientos: React.FC<Props> = ({ movimientos, contexto, deuda, oculto }) => {
  if (movimientos.length === 0) {
    return <p className="text-sm text-[#737373] py-2">{contexto === 'meta' ? 'Aún no has apartado plata aquí.' : 'Aún no hay abonos.'}</p>;
  }
  const monedaDestino: Moneda = contexto === 'meta' ? 'COP' : deuda?.moneda || 'COP';
  return (
    <ul className="divide-y divide-[#e5e5e5]">
      {movimientos.map((t) => {
        const d = describir(t, contexto, deuda);
        const usaAplicado = t.monto_aplicado !== undefined && t.monto_aplicado !== null;
        const monto = usaAplicado ? Math.abs(t.monto_aplicado!) : t.monto;
        const moneda = usaAplicado ? monedaDestino : t.moneda || 'COP';
        return (
          <li key={t.id} className="flex items-center gap-3 py-2 text-sm">
            <span className="material-symbols-outlined text-[18px] text-[#737373]" aria-hidden="true">{d.icono}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-[#0a0a0a]">
                {d.texto}
                {t.is_pending_undo && <span className="ml-1 text-xs text-[#737373]">· guardando…</span>}
              </p>
              <p className="text-xs text-[#737373] truncate">
                {fecha(t.fecha)}
                {t.cuenta_nombre && t.cuenta_id ? ` · ${t.cuenta_nombre}` : ''}
                {t.origen === 'ia_voz' ? ' · por voz' : ''}
              </p>
            </div>
            <span className="font-semibold tabular-nums text-[#0a0a0a]">
              {oculto ? '••••' : formatMonto(monto, moneda, d.signo)}
            </span>
          </li>
        );
      })}
    </ul>
  );
};
