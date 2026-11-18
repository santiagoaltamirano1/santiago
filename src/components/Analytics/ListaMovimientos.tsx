import React, { useMemo, useState } from 'react';
import { useFinanceStore } from '../../store/useFinanceStore';
import { FilaMovimiento } from './Dashboard';
import type { Transaccion } from '../../types';

// Lista completa de movimientos, agrupada por día (hora de Bogotá).
// Iteración 2 · Fase 1 (pedido de la dueña): "Todos" y "Metas, deudas y más" se sentían iguales.
// Ahora: filtros por GRUPO, que no se solapan y se pueden combinar. Ninguno marcado = se ve todo.
type Grupo = 'gastos' | 'ingresos' | 'entre_cuentas' | 'metas' | 'deudas' | 'ajustes';

const GRUPOS: { id: Grupo; texto: string; icono: string; tipos: Transaccion['tipo'][] }[] = [
  { id: 'gastos', texto: 'Gastos', icono: 'arrow_downward', tipos: ['gasto'] },
  { id: 'ingresos', texto: 'Ingresos', icono: 'arrow_upward', tipos: ['ingreso'] },
  { id: 'entre_cuentas', texto: 'Entre cuentas', icono: 'swap_horiz', tipos: ['transferencia'] },
  { id: 'metas', texto: 'Metas', icono: 'savings', tipos: ['aporte_meta', 'retiro_meta'] },
  { id: 'deudas', texto: 'Deudas', icono: 'handshake', tipos: ['prestamo_capital', 'abono_capital'] },
  { id: 'ajustes', texto: 'Ajustes', icono: 'tune', tipos: ['ajuste'] },
];
const grupoDe = (t: Transaccion): Grupo | undefined => GRUPOS.find((g) => g.tipos.includes(t.tipo))?.id;

export const ListaMovimientos: React.FC = () => {
  const { transacciones, categorias, privacyHidden } = useFinanceStore();
  const [marcados, setMarcados] = useState<Grupo[]>([]);
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  const ayer = new Date(Date.now() - 864e5).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

  // Cantidad por grupo (sobre todo lo cargado), para que cada filtro diga cuántos hay
  const conteo = useMemo(() => {
    const c: Partial<Record<Grupo, number>> = {};
    transacciones.forEach((t) => { const g = grupoDe(t); if (g) c[g] = (c[g] || 0) + 1; });
    return c;
  }, [transacciones]);

  const visibles = useMemo(
    () => (marcados.length === 0 ? transacciones : transacciones.filter((t) => { const g = grupoDe(t); return !!g && marcados.includes(g); })),
    [transacciones, marcados],
  );

  const grupos = useMemo(() => {
    const m = new Map<string, Transaccion[]>();
    visibles.forEach((t) => {
      const dia = t.fecha_local_str || new Date(t.fecha).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
      m.set(dia, [...(m.get(dia) || []), t]);
    });
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [visibles]);

  const nombreDia = (d: string) => {
    if (d === hoy) return 'Hoy';
    if (d === ayer) return 'Ayer';
    const t = new Date(d + 'T12:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
    return t.charAt(0).toUpperCase() + t.slice(1); // [U20] "Domingo, 15 de noviembre"
  };

  const alternar = (g: Grupo) => setMarcados((m) => (m.includes(g) ? m.filter((x) => x !== g) : [...m, g]));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por tipo de movimiento">
        {GRUPOS.filter((g) => conteo[g.id]).map((g) => {
          const activo = marcados.includes(g.id);
          return (
            <button key={g.id} type="button" aria-pressed={activo} onClick={() => alternar(g.id)}
              className={`min-h-[44px] px-3.5 rounded-full text-sm font-medium border whitespace-nowrap flex items-center gap-1.5 ${activo ? 'bg-[#0a0a0a] text-[#fafafa] border-[#0a0a0a]' : 'bg-white text-[#0a0a0a] border-field'}`}>
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">{activo ? 'check' : g.icono}</span>
              {g.texto}
              <span className={`text-xs tabular-nums ${activo ? 'text-[#fafafa]/80' : 'text-[#737373]'}`}>{conteo[g.id]}</span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-2 min-h-[44px]" role="status">
        <p className="text-sm text-[#737373]">
          {marcados.length === 0
            ? `Mostrando todo (${visibles.length})`
            : `Mostrando ${GRUPOS.filter((g) => marcados.includes(g.id)).map((g) => g.texto.toLowerCase()).join(' y ')} (${visibles.length})`}
        </p>
        {marcados.length > 0 && (
          <button type="button" onClick={() => setMarcados([])} className="min-h-[44px] px-3 text-sm font-medium text-[#0a0a0a] underline-offset-2 hover:underline">
            Quitar filtros
          </button>
        )}
      </div>
      {grupos.length === 0 && <p className="text-sm text-[#737373]">No hay movimientos de este tipo.</p>}
      {grupos.map(([dia, lista]) => (
        <section key={dia} className="bg-white rounded-[24px] border border-[#e5e5e5] px-5 py-2">
          <h2 className="text-xs font-medium text-[#737373] pt-2">{nombreDia(dia)}</h2>
          <ul className="divide-y divide-[#e5e5e5]">
            {lista.map((t) => <FilaMovimiento key={t.id} t={t} oculto={privacyHidden} categoria={categorias.find((c) => c.id === t.categoria_id)?.nombre} />)}
          </ul>
        </section>
      ))}
      <p className="text-xs text-[#737373] text-center">Se muestran los últimos 200 movimientos. Los totales del Resumen usan todos.</p>
    </div>
  );
};
