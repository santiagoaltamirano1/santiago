import React, { useEffect, useState } from 'react';
import { useFinanceStore } from '../../store/useFinanceStore';
import type { Transaccion } from '../../types';
import { formatMonto } from '../../utils/money';

// Aviso del resultado de guardar (iteración Registro 2026-11-17).
// Estados: pendiente (5 s, Deshacer) · guardado (1,5 s) · deshecho (2 s) · error y sin conexión (se quedan).
// Cada estado lleva icono y texto, no solo color. El rojo queda solo para gasto y error.

const NOMBRE_TIPO: Record<Transaccion['tipo'], string> = {
  ingreso: 'Ingreso', gasto: 'Gasto', transferencia: 'Transferencia', ajuste: 'Ajuste de saldo',
  aporte_meta: 'Apartado', retiro_meta: 'Sacado de la meta', prestamo_capital: 'Préstamo', abono_capital: 'Abono',
};

const tituloMovimiento = (t: Transaccion) => {
  if (t.tipo === 'ajuste') return `Ajuste de saldo · ${formatMonto(t.monto_aplicado ?? t.monto, t.moneda, 'auto')}`;
  const signo = t.tipo === 'gasto' ? 'gasto' : t.tipo === 'ingreso' ? 'ingreso' : 'neutro';
  return `${NOMBRE_TIPO[t.tipo] || 'Movimiento'} · ${formatMonto(t.monto, t.moneda, signo)}`;
};

const colorTipo = (t: Transaccion) =>
  t.tipo === 'gasto' ? 'text-expense' : t.tipo === 'ingreso' ? 'text-income' : 'text-transfer';

export const UndoToast: React.FC = () => {
  const pendingUndoList = useFinanceStore((s) => s.pendingUndoList);
  const undoPendingTransaccion = useFinanceStore((s) => s.undoPendingTransaccion);
  const avisos = useFinanceStore((s) => s.avisos);
  const cerrarAviso = useFinanceStore((s) => s.cerrarAviso);
  const cuentas = useFinanceStore((s) => s.cuentas);
  // En Registro el botón Guardar está fijo abajo: el aviso sube para no taparlo (Fase 7).
  const enRegistro = useFinanceStore((s) => s.activeTab === 'register');

  if (pendingUndoList.length === 0 && avisos.length === 0) return null;

  const detalle = (t: Transaccion) => {
    if (t.tipo === 'transferencia') {
      const destino = cuentas.find((c) => c.id === t.destino_cuenta_id)?.nombre || 'otra cuenta';
      return `${t.cuenta_nombre || 'Cuenta'} → ${destino}`;
    }
    if (t.meta_id) return t.notas || 'Meta';
    if (t.deuda_id) return `${t.cuenta_nombre || 'Cuenta'} · no es gasto ni ingreso`;
    return `${t.cuenta_nombre || 'Cuenta'}${t.categoria_nombre ? ' · ' + t.categoria_nombre : ''}`;
  };

  return (
    <div
      className={`fixed left-0 right-0 z-[70] px-4 flex flex-col items-center gap-2 pointer-events-none ${enRegistro ? '' : 'bottom-[calc(84px+env(safe-area-inset-bottom))]'}`}
      // [U19] En Registro va arriba pero debajo de la zona segura y del encabezado "← Calculadora"
      style={enRegistro ? { top: 'calc(env(safe-area-inset-top) + 64px)' } : undefined}
    >
      {pendingUndoList.map((item) => (
        <Pendiente
          key={item.id}
          titulo={tituloMovimiento(item.transaccion)}
          color={colorTipo(item.transaccion)}
          detalle={detalle(item.transaccion)}
          onUndo={item.enviando ? undefined : () => undoPendingTransaccion(item.id)}
        />
      ))}

      {avisos.map((a) => {
        const t = a.transaccion;
        if (a.tipo === 'guardado') {
          return (
            <Tarjeta key={a.id} role="status" icono="check_circle" iconoCls="text-[#0a0a0a]" titulo="Guardado" detalle={t ? tituloMovimiento(t) : undefined} />
          );
        }
        if (a.tipo === 'deshecho') {
          return <Tarjeta key={a.id} role="status" icono="undo" iconoCls="text-[#737373]" titulo="Listo, no se guardó." />;
        }
        if (a.tipo === 'error') {
          return (
            <Tarjeta
              key={a.id}
              role="alert"
              icono="error"
              iconoCls="text-ember"
              bordeCls="border-l-4 border-l-[color:var(--ember)]"
              titulo={a.mensaje || 'No se pudo guardar.'}
              detalle={t ? `${tituloMovimiento(t)} · no se guardó` : undefined}
              onClose={() => cerrarAviso(a.id)}
            />
          );
        }
        return (
          <Tarjeta
            key={a.id}
            role="status"
            icono="cloud_off"
            iconoCls="text-alert"
            titulo="Sin conexión."
            detalle={a.mensaje || 'Se guarda cuando vuelvas a entrar.'}
            onClose={() => cerrarAviso(a.id)}
          />
        );
      })}
    </div>
  );
};

const Tarjeta: React.FC<{
  role: 'status' | 'alert';
  icono: string;
  iconoCls: string;
  titulo: string;
  detalle?: string;
  bordeCls?: string;
  onClose?: () => void;
}> = ({ role, icono, iconoCls, titulo, detalle, bordeCls = '', onClose }) => (
  <div role={role} className={`pointer-events-auto w-full max-w-md bg-white border border-[#e5e5e5] ${bordeCls} rounded-[18px] p-3 shadow-lg flex items-center gap-3`}>
    <span className={`material-symbols-outlined text-[22px] ${iconoCls}`} aria-hidden="true">{icono}</span>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-[#0a0a0a]">{titulo}</p>
      {detalle && <p className="text-xs text-[#737373] truncate">{detalle}</p>}
    </div>
    {onClose && (
      <button onClick={onClose} className="min-h-[44px] px-3 rounded-[14px] text-sm font-medium text-[#0a0a0a] border border-field">
        Cerrar
      </button>
    )}
  </div>
);

const Pendiente: React.FC<{ titulo: string; color: string; detalle: string; onUndo?: () => void }> = ({ titulo, color, detalle, onUndo }) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const start = Date.now();
    const duration = 5000;
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.max(0, 100 - (elapsed / duration) * 100));
      if (elapsed >= duration) clearInterval(interval);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <div role="status" className="pointer-events-auto w-full max-w-md bg-white border border-[#e5e5e5] rounded-[18px] shadow-lg overflow-hidden">
      <div className="p-3 flex items-center gap-3">
        <span className="material-symbols-outlined text-[22px] text-[#737373]" aria-hidden="true">schedule</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold tabular-nums ${color}`}>{titulo}</p>
          <p className="text-xs text-[#737373] truncate">{onUndo ? 'Se guarda en 5 s' : 'Guardando…'} · {detalle}</p>
        </div>
        {/* [N1] Mientras se envía ya no se puede deshacer: el botón desaparece */}
        {onUndo && (
          <button
            onClick={onUndo}
            className="min-h-[44px] px-4 rounded-[14px] text-sm font-semibold text-[#0a0a0a] border border-field active:scale-95 transition-all"
          >
            Deshacer
          </button>
        )}
      </div>
      <div className="h-1 bg-[#f5f5f5]">
        <div className="h-full bg-[#0a0a0a] transition-[width] duration-75" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
};
