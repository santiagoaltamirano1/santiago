import React, { useEffect, useMemo, useState } from 'react';
import { useFinanceStore } from '../../store/useFinanceStore';
import { fetchResumen, type Resumen } from '../../services/financeService';
import { formatMonto } from '../../utils/money';
import { toCOP, describirTrm, describirConsulta } from '../../utils/fx';
import { disponibleCOP, pendienteDeuda } from '../../utils/reglas';
import { BarrasHorizontales, ColumnasPareadas, LineaTiempo } from './Graficos';
import type { Transaccion } from '../../types';

// Dashboard (Fase 6). Orden por prioridad para la persona (mesa UX, Fase 1):
// 1 Disponible · 2 Mes: ingresos y gastos · 3 Deudas · 4 Metas · 5 ¿En qué se fue? · 6 Tendencia · 7 Patrimonio
// · 8 Cuentas · 9 Últimos movimientos · pie: tasa usada.
// Fórmulas en el mapa §7.2. Lo "del mes" viene del servidor (/api/resumen (motor/reportes.ts), todos los movimientos) + lo que aún está
// en sus 5 s para deshacer; lo "de ahora" (disponible, deudas, metas, cuentas) viene del estado en vivo.

const NOMBRE_MES = (iso: string, largo = false) => {
  const t = new Date(iso.slice(0, 7) + '-15T12:00').toLocaleDateString('es-CO', largo ? { month: 'long', year: 'numeric' } : { month: 'short' }).replace('.', '');
  return largo ? t.charAt(0).toUpperCase() + t.slice(1) : t; // "Noviembre de 2026" (solo la primera letra)
};
const mesActual = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }).slice(0, 7) + '-01';
const moverMes = (iso: string, n: number) => { const d = new Date(iso + 'T12:00'); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 7) + '-01'; };
const pesos = (v: number) => formatMonto(Math.round(v), 'COP', 'neutro');

const tarjeta = 'bg-white rounded-[24px] border border-[#e5e5e5] p-5';
const tituloSeccion = 'text-sm font-semibold text-[#0a0a0a]';
const enlace = 'min-h-[44px] text-sm font-medium text-[#0a0a0a] flex items-center gap-1 hover:underline';

const ICONO: Record<Transaccion['tipo'], string> = {
  gasto: 'arrow_downward', ingreso: 'arrow_upward', transferencia: 'swap_horiz', ajuste: 'tune',
  aporte_meta: 'savings', retiro_meta: 'undo', prestamo_capital: 'handshake', abono_capital: 'payments',
};
export const NOMBRE_TIPO: Record<Transaccion['tipo'], string> = {
  gasto: 'Gasto', ingreso: 'Ingreso', transferencia: 'Transferencia', ajuste: 'Ajuste de saldo',
  aporte_meta: 'Apartado en meta', retiro_meta: 'Sacado de meta', prestamo_capital: 'Préstamo', abono_capital: 'Abono a deuda',
};

/** Fila de movimiento reutilizable (dashboard y lista completa). */
export const FilaMovimiento: React.FC<{ t: Transaccion; oculto: boolean; categoria?: string }> = ({ t, oculto, categoria }) => {
  const signo = t.tipo === 'gasto' ? 'gasto' : t.tipo === 'ingreso' ? 'ingreso' : t.tipo === 'ajuste' ? 'auto' : 'neutro';
  const valor = t.tipo === 'ajuste' ? t.monto_aplicado ?? t.monto : t.monto;
  const color = t.tipo === 'gasto' ? 'text-expense' : t.tipo === 'ingreso' ? 'text-income' : 'text-transfer';
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className={`w-9 h-9 rounded-full bg-[#f5f5f5] flex items-center justify-center shrink-0 ${color}`} aria-hidden="true">
        <span className="material-symbols-outlined text-[18px]">{ICONO[t.tipo]}</span>
      </span>
      <div className="flex-1 min-w-0">
        {/* [U23] "[detalle] nota" se muestra como "detalle · nota" */}
        <p className="text-sm font-medium text-[#0a0a0a] truncate">{(t.notas || '').replace(/^\[([^\]]+)\]\s*/, (_, d) => d + ' · ').replace(/ · $/, '') || categoria || NOMBRE_TIPO[t.tipo]}</p>
        <p className="text-xs text-[#737373] truncate">
          {NOMBRE_TIPO[t.tipo]}{categoria ? ` · ${categoria}` : ''}{t.cuenta_nombre && t.cuenta_id ? ` · ${t.cuenta_nombre}` : ''}
          {t.origen === 'ia_voz' ? ' · por voz' : ''}{t.is_pending_undo ? ' · guardando…' : ''}
        </p>
      </div>
      <span className={`text-sm font-semibold tabular-nums shrink-0 ${color}`}>{oculto ? '••••' : formatMonto(valor, t.moneda || 'COP', signo as any)}</span>
    </li>
  );
};

export const Dashboard: React.FC<{ irA: (pestana: 'movimientos' | 'ajustes' | 'exportar') => void }> = ({ irA }) => {
  const { cuentas, metas, deudas, categorias, transacciones, pendingUndoList, fx, privacyHidden, setActiveTab } = useFinanceStore();
  const [mes, setMes] = useState(mesActual());
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const o = (v: string) => (privacyHidden ? '••••' : v);

  // Se recarga al cambiar de mes y cuando se guarda algo (sin pendientes en curso)
  // [U26] Se recarga por cualquier cambio guardado (no solo por cantidad: con 200 cargados la cantidad no cambia)
  const guardados = transacciones.filter((t) => !t.is_pending_undo).map((t) => t.id).join(',');
  // [U13] Al cambiar de mes se borra el resumen anterior (no se muestran cifras de otro mes)
  useEffect(() => { setResumen(null); }, [mes]);
  useEffect(() => {
    let vivo = true;
    setCargando(true);
    const id = setTimeout(() => {
      fetchResumen(mes, 6)
        .then((r) => { if (vivo) { setResumen(r); setErrorCarga(false); } })
        .catch(() => { if (vivo) setErrorCarga(true); })
        .finally(() => { if (vivo) setCargando(false); });
    }, 300);
    return () => { vivo = false; clearTimeout(id); };
  }, [mes, guardados]);

  // ---------- Ahora (estado en vivo) ----------
  const disponible = disponibleCOP(cuentas, metas, fx);
  const enCuentas = cuentas.filter((c) => c.tipo !== 'tarjeta').reduce((s, c) => s + toCOP(c.saldo_actual, c.moneda, fx), 0);
  const tarjetas = cuentas.filter((c) => c.tipo === 'tarjeta').reduce((s, c) => s + toCOP(c.saldo_actual, c.moneda, fx), 0);
  const apartado = metas.reduce((s, m) => s + m.monto_actual, 0);
  const activas = deudas.filter((d) => d.estado === 'activa');
  const debes = activas.filter((d) => d.tipo === 'por_pagar').reduce((s, d) => s + toCOP(pendienteDeuda(d), d.moneda, fx), 0);
  const teDeben = activas.filter((d) => d.tipo === 'por_cobrar').reduce((s, d) => s + toCOP(pendienteDeuda(d), d.moneda, fx), 0);
  const proxima = activas.filter((d) => d.fecha_vencimiento).sort((a, b) => a.fecha_vencimiento!.localeCompare(b.fecha_vencimiento!))[0];
  const objetivoTotal = metas.reduce((s, m) => s + m.monto_objetivo, 0);
  const pctMetas = objetivoTotal > 0 ? Math.min(100, Math.round((apartado / objetivoTotal) * 100)) : 0;

  // ---------- Del mes (servidor + pendientes de este mes) ----------
  const esMesActual = mes === mesActual();
  // Solo pendientes cuya fecha cae en el mes mostrado (un gasto fechado el mes pasado no suma a este)
  const pendientesMes = pendingUndoList.map((p) => p.transaccion)
    .filter((t) => (t.tipo === 'ingreso' || t.tipo === 'gasto') && (t.fecha_local_str || '').slice(0, 7) === mes.slice(0, 7));
  const delMes = resumen?.meses.find((m) => m.mes.slice(0, 7) === mes.slice(0, 7));
  const ingresosMes = (delMes?.ingresos ?? 0) + pendientesMes.filter((t) => t.tipo === 'ingreso').reduce((s, t) => s + toCOP(t.monto, t.moneda, fx), 0);
  const gastosMes = (delMes?.gastos ?? 0) + pendientesMes.filter((t) => t.tipo === 'gasto').reduce((s, t) => s + toCOP(t.monto, t.moneda, fx), 0);
  const balanceMes = ingresosMes - gastosMes;
  const mesAnterior = resumen?.meses.find((m) => m.mes.slice(0, 7) === moverMes(mes, -1).slice(0, 7));
  // Solo meses cerrados: comparar un mes a medias contra uno completo engaña.
  const variacion = !esMesActual && mesAnterior && mesAnterior.gastos > 0 ? Math.round(((gastosMes - mesAnterior.gastos) / mesAnterior.gastos) * 100) : null;

  const categoriasMes = useMemo(() => {
    const mapa = new Map<string, { nombre: string; valor: number }>();
    (resumen?.categorias || []).forEach((c) => mapa.set(c.id, { nombre: c.nombre, valor: c.total }));
    pendientesMes.filter((t) => t.tipo === 'gasto').forEach((t) => {
      const c = categorias.find((x) => x.id === t.categoria_id);
      const prev = mapa.get(t.categoria_id) || { nombre: c?.nombre || 'Sin categoría', valor: 0 };
      mapa.set(t.categoria_id, { ...prev, valor: prev.valor + toCOP(t.monto, t.moneda, fx) });
    });
    const orden = [...mapa.values()].sort((a, b) => b.valor - a.valor);
    if (orden.length <= 6) return orden;
    return [...orden.slice(0, 5), { nombre: 'Otras', valor: orden.slice(5).reduce((s, c) => s + c.valor, 0) }];
  }, [resumen, pendientesMes, categorias, fx]);

  const tendencia = (resumen?.meses || []).map((m) => ({ etiqueta: NOMBRE_MES(m.mes), ingresos: m.ingresos, gastos: m.gastos }));
  const patrimonio = (resumen?.patrimonio || []).map((p) => ({ etiqueta: NOMBRE_MES(p.mes), valor: p.valor }));
  const cuentasTop = [...cuentas].sort((a, b) => toCOP(b.saldo_actual, b.moneda, fx) - toCOP(a.saldo_actual, a.moneda, fx)).slice(0, 3);
  const ultimos = transacciones.slice(0, 5);
  const nombreCat = (id: string) => categorias.find((c) => c.id === id)?.nombre;

  return (
    <div className="space-y-4">
      {/* 1 · Disponible */}
      <section className={`${tarjeta} space-y-2`} aria-labelledby="disp-titulo">
        <h2 id="disp-titulo" className="text-sm font-medium text-[#737373]">Disponible para gastar</h2>
        <p className={`text-4xl sm:text-5xl font-semibold tracking-[-0.03em] tabular-nums ${disponible < 0 ? 'text-expense' : 'text-[#0a0a0a]'}`}>{o(formatMonto(Math.round(disponible), 'COP', 'auto'))}</p>
        <p className="text-sm text-[#737373] tabular-nums">
          En tus cuentas {o(pesos(enCuentas))} · Apartado en metas {o(pesos(apartado))}
          {tarjetas !== 0 && <> · Tarjetas {o(formatMonto(Math.round(tarjetas), 'COP', 'auto'))}</>}
        </p>
        {disponible < 0 && (
          <p className="text-sm text-alert flex items-start gap-1" role="status">
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">info</span>
            Tienes apartado en metas más de lo que hay en tus cuentas. Saca plata de alguna meta o revisa tus saldos.
          </p>
        )}
      </section>

      {/* 2 · Mes */}
      <section className={`${tarjeta} space-y-4`} aria-labelledby="mes-titulo">
        <div className="flex items-center justify-between gap-2">
          <h2 id="mes-titulo" className={tituloSeccion}>{NOMBRE_MES(mes, true)}</h2>
          <div className="flex items-center">
            <button type="button" onClick={() => setMes(moverMes(mes, -1))} className="w-11 h-11 rounded-[14px] flex items-center justify-center hover:bg-[#f5f5f5]" aria-label="Mes anterior">
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">chevron_left</span>
            </button>
            <button type="button" onClick={() => setMes(moverMes(mes, 1))} disabled={esMesActual} className="w-11 h-11 rounded-[14px] flex items-center justify-center hover:bg-[#f5f5f5] disabled:opacity-30" aria-label="Mes siguiente">
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">chevron_right</span>
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[18px] bg-[#fafafa] border border-[#e5e5e5] p-3">
            <p className="text-xs font-medium text-[#737373] flex items-center gap-1"><span className="material-symbols-outlined text-[16px] text-income" aria-hidden="true">arrow_upward</span>Entró</p>
            <p className="text-xl font-semibold text-income tabular-nums mt-1">{o(formatMonto(Math.round(ingresosMes), 'COP', 'ingreso'))}</p>
          </div>
          <div className="rounded-[18px] bg-[#fafafa] border border-[#e5e5e5] p-3">
            <p className="text-xs font-medium text-[#737373] flex items-center gap-1"><span className="material-symbols-outlined text-[16px] text-expense" aria-hidden="true">arrow_downward</span>Salió</p>
            <p className="text-xl font-semibold text-expense tabular-nums mt-1">{o(formatMonto(Math.round(gastosMes), 'COP', 'gasto'))}</p>
          </div>
        </div>
        <p className="text-sm text-[#0a0a0a]" role="status">
          {cargando && !resumen ? 'Calculando…' : errorCarga ? 'No pudimos traer el resumen del mes. Revisa tu conexión.' : (
            <>
              {balanceMes >= 0 ? 'Te quedaron ' : 'Gastaste '}<strong className="tabular-nums">{o(pesos(Math.abs(balanceMes)))}</strong>{balanceMes >= 0 ? ' este mes.' : ' más de lo que entró.'}
              {variacion !== null && !privacyHidden && <span className="text-[#737373]"> Gastos {variacion >= 0 ? '▲' : '▼'} {Math.abs(variacion)} % frente a {NOMBRE_MES(moverMes(mes, -1), true).split(' ')[0].toLowerCase()}.</span>}
              {esMesActual && <span className="text-[#737373]"> Mes en curso.</span>}
            </>
          )}
        </p>
        <p className="text-xs text-[#737373]">No cuentan aquí: transferencias, ajustes de saldo, apartar en metas ni préstamos y abonos de deudas.</p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 3 · Deudas */}
        <section className={`${tarjeta} space-y-3`} aria-labelledby="deu-titulo">
          <h2 id="deu-titulo" className={tituloSeccion}>Deudas</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><p className="text-xs text-[#737373]">Debes</p><p className="text-lg font-semibold text-[#0a0a0a] tabular-nums">{o(pesos(debes))}</p></div>
            <div><p className="text-xs text-[#737373]">Te deben</p><p className="text-lg font-semibold text-[#0a0a0a] tabular-nums">{o(pesos(teDeben))}</p></div>
          </div>
          {proxima && (
            <p className="text-sm text-[#737373]">
              Próximo vencimiento: <span className="text-[#0a0a0a] font-medium">{proxima.contraparte}</span>, {new Date(proxima.fecha_vencimiento + 'T12:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
              {proxima.fecha_vencimiento! < new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }) && <span className="text-alert font-medium"> · vencida</span>}
            </p>
          )}
          <button type="button" className={enlace} onClick={() => setActiveTab('debts_goals')}>Ver deudas <span className="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_forward</span></button>
        </section>

        {/* 4 · Metas */}
        <section className={`${tarjeta} space-y-3`} aria-labelledby="met-titulo">
          <div className="flex items-baseline justify-between">
            <h2 id="met-titulo" className={tituloSeccion}>Metas</h2>
            <span className="text-sm font-semibold text-[#0a0a0a] tabular-nums">{pctMetas} %</span>
          </div>
          <ul className="space-y-3">
            {[...metas].sort((a, b) => b.monto_actual / b.monto_objetivo - a.monto_actual / a.monto_objetivo).slice(0, 3).map((m) => {
              const pct = Math.min(100, Math.round((m.monto_actual / m.monto_objetivo) * 100));
              const falta = Math.max(0, m.monto_objetivo - m.monto_actual);
              const msRest = m.fecha_limite ? new Date(m.fecha_limite + 'T23:59').getTime() - Date.now() : null;
              const vencida = msRest !== null && msRest < 0; // [U14]
              const mesesRest = msRest !== null && !vencida ? Math.max(1, Math.ceil(msRest / (30.44 * 864e5))) : null;
              return (
                <li key={m.id}>
                  <div className="flex justify-between text-sm gap-2"><span className="text-[#0a0a0a] truncate">{m.nombre}</span><span className="tabular-nums text-[#737373] shrink-0">{pct} %</span></div>
                  <div className="h-2 bg-[#f5f5f5] rounded-full overflow-hidden mt-1" aria-hidden="true"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--transfer)' }} /></div>
                  <p className="text-xs text-[#737373] mt-1 tabular-nums">
                    {falta === 0 ? '¡Cumplida!' : `Faltan ${o(pesos(falta))}${vencida ? ` · la fecha (${new Date(m.fecha_limite + 'T12:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}) ya pasó` : mesesRest ? ` · ${o(pesos(falta / mesesRest))} al mes para llegar a tiempo` : ''}`}
                  </p>
                </li>
              );
            })}
            {metas.length === 0 && <li className="text-sm text-[#737373]">Aún no tienes metas.</li>}
          </ul>
          <button type="button" className={enlace} onClick={() => setActiveTab('debts_goals')}>Ver metas <span className="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_forward</span></button>
        </section>
      </div>

      {/* 5 · ¿En qué se fue? */}
      <section className={`${tarjeta} space-y-3`} aria-labelledby="cat-titulo">
        <h2 id="cat-titulo" className={tituloSeccion}>¿En qué se fue la plata? <span className="font-normal text-[#737373]">· {NOMBRE_MES(mes, true)}</span></h2>
        {categoriasMes.length > 0 ? <BarrasHorizontales filas={categoriasMes} oculto={privacyHidden} /> : <p className="text-sm text-[#737373]">Sin gastos este mes.</p>}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 6 · Tendencia */}
        <section className={`${tarjeta} space-y-2`} aria-labelledby="ten-titulo">
          <h2 id="ten-titulo" className={tituloSeccion}>Entradas y salidas · 6 meses</h2>
          {tendencia.length > 0 ? <ColumnasPareadas datos={tendencia} oculto={privacyHidden} /> : <p className="text-sm text-[#737373]">{cargando ? 'Calculando…' : 'Sin datos.'}</p>}
        </section>

        {/* 7 · Patrimonio */}
        <section className={`${tarjeta} space-y-2`} aria-labelledby="pat-titulo">
          <h2 id="pat-titulo" className={tituloSeccion}>Patrimonio · 6 meses</h2>
          <p className="text-xs text-[#737373]">Cuentas + lo que te deben − lo que debes.</p>
          {patrimonio.length > 0 ? <LineaTiempo datos={patrimonio} oculto={privacyHidden} nombre="Patrimonio" /> : <p className="text-sm text-[#737373]">{cargando ? 'Calculando…' : 'Sin datos.'}</p>}
        </section>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 8 · Cuentas */}
        <section className={`${tarjeta}`} aria-labelledby="cue-titulo">
          <h2 id="cue-titulo" className={tituloSeccion}>Cuentas</h2>
          <ul className="divide-y divide-[#e5e5e5] mt-1">
            {cuentasTop.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2.5 gap-2">
                <span className="text-sm text-[#0a0a0a] truncate">{c.nombre}</span>
                <span className={`text-sm font-semibold tabular-nums ${c.saldo_actual < 0 ? 'text-expense' : 'text-[#0a0a0a]'}`}>{o(formatMonto(c.saldo_actual, c.moneda, 'auto'))}</span>
              </li>
            ))}
          </ul>
          <button type="button" className={enlace} onClick={() => irA('ajustes')}>Ver y ajustar todas ({cuentas.length}) <span className="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_forward</span></button>
        </section>

        {/* 9 · Últimos movimientos */}
        <section className={`${tarjeta}`} aria-labelledby="ult-titulo">
          <h2 id="ult-titulo" className={tituloSeccion}>Últimos movimientos</h2>
          <ul className="divide-y divide-[#e5e5e5] mt-1">
            {ultimos.map((t) => <FilaMovimiento key={t.id} t={t} oculto={privacyHidden} categoria={nombreCat(t.categoria_id)} />)}
            {ultimos.length === 0 && <li className="text-sm text-[#737373] py-2">Aún no hay movimientos.</li>}
          </ul>
          <button type="button" className={enlace} onClick={() => irA('movimientos')}>Ver todos <span className="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_forward</span></button>
        </section>
      </div>

      {/* Iteración 2 · F5: enlace a Exportar (vive en Ajustes) */}
      <button type="button" onClick={() => irA('exportar')}
        className="w-full min-h-[52px] rounded-[18px] border border-field bg-white text-sm font-semibold text-[#0a0a0a] flex items-center justify-center gap-2">
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">ios_share</span> Exportar mis datos o pedirle un informe a tu IA
        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_forward</span>
      </button>

      <p className="text-xs text-[#737373] text-center px-2">Cifras en pesos con {describirTrm(fx)} · {describirConsulta(fx)}</p>
    </div>
  );
};
