import React, { Suspense, lazy, useState } from 'react';
import { useFinanceStore } from '../../store/useFinanceStore';
import { APP_THEMES } from '../../types';
import { Dashboard } from './Dashboard';
import { ListaMovimientos } from './ListaMovimientos';
import { toCOP, convertir } from '../../services/currency';
import { describirTrm, describirConsulta } from '../../utils/fx';
import { formatMonto, limpiarEntrada, formatEntrada } from '../../utils/money';

// Iteración 2 · F5: Exportar se carga aparte (solo cuando se abre Ajustes)
const Exportar = lazy(() => import('./Exportar'));
const MedirVoz = lazy(() => import('./MedirVoz').then((m) => ({ default: m.MedirVoz })));

export const AnalyticsView: React.FC = () => {
  const {
    transacciones,
    cuentas,
    categorias,
    metas,
    deudas,
    addCuenta,
    ajustarSaldoCuenta,
    addTransaccion,
    cerrarSesion,
    privacyHidden,
    togglePrivacy,
    appTheme,
    setAppTheme,
    fx,
  } = useFinanceStore();

  // Fase 6: Resumen (dashboard) · Movimientos (lista completa) · Ajustes (cuentas, divisas, tema, sesión).
  // Se quitaron la pestaña BigQuery/Looker (E28) y el muestrario técnico de estilos.
  const [activeTab, setActiveTab] = useState<'resumen' | 'movimientos' | 'ajustes'>('resumen');

  // Conversor de divisas (solo cálculo, no mueve dinero)
  const [convMonto, setConvMonto] = useState<string>('100000');
  const [convDesde, setConvDesde] = useState<'COP' | 'USD' | 'EUR'>('COP');
  const [convHacia, setConvHacia] = useState<'COP' | 'USD' | 'EUR'>('USD');


  // Modal / Form state for Account creation
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<'ahorro' | 'corriente' | 'tarjeta' | 'efectivo' | 'bolsillo' | 'broker'>('ahorro');
  const [accountCurrency, setAccountCurrency] = useState('COP');
  const [accountInitialBalance, setAccountInitialBalance] = useState('');

  // Account editing state
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingBalance, setEditingBalance] = useState<string>('');
  const [negativoEditando, setNegativoEditando] = useState(false);
  const [ajusteMsg, setAjusteMsg] = useState<{ cuentaId: string; texto: string; error?: boolean } | null>(null);
  const [guardandoAjuste, setGuardandoAjuste] = useState(false);

  // Tenencias por moneda extranjera (para la sección de divisas)
  const tenenciasUSD = cuentas.filter((c) => c.moneda === 'USD').reduce((s, c) => s + c.saldo_actual, 0);
  const tenenciasEUR = cuentas.filter((c) => c.moneda === 'EUR').reduce((s, c) => s + c.saldo_actual, 0);
  const convResultado = convertir(parseFloat(convMonto) || 0, convDesde, convHacia, fx);

  const formatCOP = (val: number) => {
    if (privacyHidden) return '••••••••';
    return formatMonto(val, 'COP', 'auto');
  };

  // Formatea un saldo en la moneda propia de la cuenta (USD/EUR muestran su código)
  const formatMoneda = (val: number, moneda?: string) => {
    if (privacyHidden) return '••••••••';
    return formatMonto(val, moneda || 'COP', 'auto');
  };

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName.trim()) return;
    addCuenta({
      nombre: accountName.trim(),
      tipo: accountType,
      moneda: accountCurrency,
      saldo_actual: parseFloat(accountInitialBalance) || 0,
      mascara: `**** ${Math.floor(1000 + Math.random() * 9000)}`,
      color_badge: '#0a0a0a',
    });
    setAccountName('');
    setAccountInitialBalance('');
    setShowAddAccountModal(false);
  };

  // [E37] Ajustar saldo = movimiento 'ajuste' calculado en el servidor (no cuenta como gasto ni ingreso).
  // D-038: si baja, se ofrece anotarlo como gasto (entonces sí cuenta en tus gastos).
  const saldoEditado = (cuentaId: string) => {
    const c = cuentas.find((x) => x.id === cuentaId);
    const v = parseFloat(editingBalance);
    if (!c || isNaN(v)) return null;
    const objetivo = negativoEditando ? -v : v;
    return { cuenta: c, objetivo, diferencia: Math.round((objetivo - c.saldo_actual) * 100) / 100 };
  };

  const cerrarEdicion = () => { setEditingAccountId(null); setEditingBalance(''); setNegativoEditando(false); };

  const handleSaveBalanceEdit = async (id: string) => {
    const e = saldoEditado(id);
    if (!e) return;
    if (e.diferencia === 0) { cerrarEdicion(); return; }
    setGuardandoAjuste(true);
    const r = await ajustarSaldoCuenta(id, e.objetivo);
    setGuardandoAjuste(false);
    if ('error' in r) { setAjusteMsg({ cuentaId: id, texto: r.error, error: true }); return; }
    setAjusteMsg({ cuentaId: id, texto: `Ajustamos ${formatMonto(r.diferencia, e.cuenta.moneda, 'auto')}. No cuenta como gasto ni ingreso.` });
    cerrarEdicion();
  };

  const handleAnotarComoGasto = (id: string) => {
    const e = saldoEditado(id);
    if (!e || e.diferencia >= 0) return;
    const cat = categorias.find((c) => c.tipo === 'gasto');
    if (!cat) { setAjusteMsg({ cuentaId: id, texto: 'Crea una categoría de gastos primero.', error: true }); return; }
    const r = addTransaccion({
      cuenta_id: id, categoria_id: cat.id, monto: Math.abs(e.diferencia), tipo: 'gasto',
      fecha: new Date().toISOString(), notas: 'Gasto sin anotar (desde ajuste de saldo)',
    });
    if (r.error) { setAjusteMsg({ cuentaId: id, texto: r.error.mensaje, error: true }); return; }
    setAjusteMsg({ cuentaId: id, texto: `Anotado como gasto en ${cat.nombre}. Puedes cambiar la categoría después.` });
    cerrarEdicion();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 pb-28 pt-2 space-y-6">
      {/* Encabezado (Fase 6): título, ojo de privacidad y 3 pestañas */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-[#0a0a0a] tracking-tight">Tu plata</h1>
        <button
          type="button"
          onClick={togglePrivacy}
          aria-pressed={privacyHidden}
          aria-label={privacyHidden ? 'Mostrar montos' : 'Ocultar montos'}
          className="w-11 h-11 rounded-[14px] flex items-center justify-center text-[#737373] hover:text-[#0a0a0a] hover:bg-[#f5f5f5]"
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{privacyHidden ? 'visibility_off' : 'visibility'}</span>
        </button>
      </div>
      <div className="bg-[#f5f5f5] p-1 rounded-[18px] flex gap-1 border border-[#e5e5e5]" role="tablist" aria-label="Secciones de Analítica">
        {([['resumen', 'Resumen'], ['movimientos', 'Movimientos'], ['ajustes', 'Ajustes']] as const).map(([id, txt]) => (
          <button key={id} type="button" role="tab" aria-selected={activeTab === id} onClick={() => setActiveTab(id)}
            className={`flex-1 min-h-[44px] rounded-[14px] text-sm font-medium transition-all ${activeTab === id ? 'bg-[#0a0a0a] text-[#fafafa] shadow-sm' : 'text-[#737373] hover:text-[#0a0a0a]'}`}>
            {txt}
          </button>
        ))}
      </div>

      {activeTab === 'resumen' && <Dashboard irA={(p) => {
        if (p !== 'exportar') { setActiveTab(p); return; }
        setActiveTab('ajustes');
        setTimeout(() => document.getElementById('exportar')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
      }} />}
      {activeTab === 'movimientos' && <ListaMovimientos />}

      {/* Ajustes: cuentas, divisas, tema y sesión (Fase 6) */}
      {activeTab === 'ajustes' && (
        <div className="space-y-6">
          <Suspense fallback={<div className="bg-white p-5 rounded-[24px] border border-[#e5e5e5] text-sm text-[#737373]" role="status">Cargando Exportar…</div>}>
            <Exportar />
          </Suspense>
          <Suspense fallback={null}><MedirVoz /></Suspense>

          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-[#0a0a0a] tracking-tight">Tus cuentas</h2>
              <p className="text-xs text-[#737373]">Toca "Ajustar saldo" si un saldo no cuadra; queda registrado como ajuste.</p>
            </div>

            <button
              onClick={() => setShowAddAccountModal(true)}
              className="bg-[#0a0a0a] text-[#fafafa] font-medium text-xs px-3.5 py-2 rounded-[18px] hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">add_card</span>
              <span>Nueva Cuenta</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cuentas.map((cuenta) => (
              <div key={cuenta.id} className="bg-white p-5 rounded-[24px] border border-[#e5e5e5] shadow-[0_0_0_1px_rgba(23,23,23,0.05),0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)] space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-[18px] bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5]">
                      {({ ahorro: 'Ahorro', bolsillo: 'Bolsillo', broker: 'Inversión', efectivo: 'Efectivo', corriente: 'Corriente', tarjeta: 'Tarjeta de crédito' } as Record<string, string>)[cuenta.tipo] || cuenta.tipo} · {cuenta.moneda}
                    </span>
                    <h3 className="text-base font-semibold text-[#0a0a0a] mt-2">{cuenta.nombre}</h3>
                    <p className="text-xs text-[#737373]">{cuenta.mascara}</p>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-[#737373] block">Saldo Actual</span>
                    <span className="text-base font-semibold text-[#0a0a0a] tabular-nums">{formatMoneda(cuenta.saldo_actual, cuenta.moneda)}</span>
                  </div>
                </div>

                {/* Edit balance section */}
                <div className="pt-3 border-t border-[#e5e5e5] flex items-center justify-between">
                  {editingAccountId === cuenta.id ? (() => {
                    const e = saldoEditado(cuenta.id);
                    const dif = e?.diferencia ?? 0;
                    return (
                    <div className="w-full space-y-2">
                      <label htmlFor={`saldo-${cuenta.id}`} className="text-xs font-medium text-[#737373] block">¿Cuánto tienes de verdad en {cuenta.nombre}?</label>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setNegativoEditando(!negativoEditando)} aria-pressed={negativoEditando} aria-label="Cambiar signo" className="w-11 h-11 shrink-0 rounded-[14px] border border-field bg-white text-lg font-semibold">
                          {negativoEditando ? '−' : '+'}
                        </button>
                        <input
                          id={`saldo-${cuenta.id}`}
                          type="text"
                          inputMode={cuenta.moneda === 'COP' ? 'numeric' : 'decimal'}
                          value={formatEntrada(editingBalance)}
                          onChange={(ev) => {
                            if (/[-−]/.test(ev.target.value)) setNegativoEditando(true);
                            setEditingBalance(limpiarEntrada(ev.target.value, cuenta.moneda !== 'COP'));
                          }}
                          className="bg-[#f5f5f5] text-[#0a0a0a] text-base px-3 min-h-[44px] rounded-[14px] border border-field w-full tabular-nums focus:bg-white"
                        />
                      </div>
                      {dif !== 0 && (
                        <p className="text-xs text-[#737373] tabular-nums" role="status">
                          Diferencia: <span className={dif < 0 ? 'text-expense' : 'text-income'}>{formatMonto(dif, cuenta.moneda, 'auto')}</span> · se guarda como ajuste de saldo
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => handleSaveBalanceEdit(cuenta.id)} disabled={guardandoAjuste} className="flex-1 min-h-[44px] bg-[#0a0a0a] text-[#fafafa] text-sm font-semibold px-3 rounded-[14px] disabled:opacity-60">
                          {guardandoAjuste ? 'Guardando…' : dif === 0 ? 'Listo' : 'Guardar ajuste'}
                        </button>
                        {dif < 0 && (
                          <button onClick={() => handleAnotarComoGasto(cuenta.id)} className="flex-1 min-h-[44px] text-sm font-semibold px-3 rounded-[14px] border border-field bg-white text-[#0a0a0a]">
                            Fue un gasto
                          </button>
                        )}
                        <button onClick={cerrarEdicion} className="min-h-[44px] text-sm text-[#737373] hover:text-[#0a0a0a] px-3">Cancelar</button>
                      </div>
                    </div>
                    );
                  })() : (
                    <div className="w-full space-y-1">
                    <button
                      onClick={() => {
                        setEditingAccountId(cuenta.id);
                        setNegativoEditando(cuenta.saldo_actual < 0);
                        setEditingBalance(String(Math.abs(cuenta.saldo_actual)));
                        setAjusteMsg(null);
                      }}
                      className="min-h-[44px] text-sm text-[#0a0a0a] font-medium hover:underline flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">edit</span>
                      <span>Ajustar saldo</span>
                    </button>
                    {ajusteMsg?.cuentaId === cuenta.id && (
                      <p role={ajusteMsg.error ? 'alert' : 'status'} className={`text-xs ${ajusteMsg.error ? 'text-ember' : 'text-[#737373]'}`}>{ajusteMsg.texto}</p>
                    )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Modal to add Account */}
          {showAddAccountModal && (
            <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] flex items-center justify-center p-4">
              <div className="bg-white border border-[#e5e5e5] p-6 rounded-[24px] w-full max-w-sm space-y-4 shadow-xl">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-[#0a0a0a] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-[#0a0a0a]">add_card</span>
                    Nueva Cuenta Financiera
                  </h3>
                  <button onClick={() => setShowAddAccountModal(false)} className="text-[#737373] hover:text-[#0a0a0a] text-sm">
                    ✕
                  </button>
                </div>

                <form onSubmit={handleCreateAccount} className="space-y-3">
                  <div>
                    <label className="text-xs text-[#737373] block mb-1 font-medium">Nombre de la Cuenta</label>
                    <input
                      type="text"
                      placeholder="Ej: Bancolombia, Nu, Nequi..."
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      className="w-full bg-[#f5f5f5] text-[#0a0a0a] text-xs p-3 rounded-[18px] border border-[#e5e5e5] outline-none focus:bg-white"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-[#737373] block mb-1 font-medium">Tipo</label>
                      <select
                        value={accountType}
                        onChange={(e) => setAccountType(e.target.value as any)}
                        className="w-full bg-[#f5f5f5] text-[#0a0a0a] text-xs p-3 rounded-[18px] border border-[#e5e5e5] outline-none"
                      >
                        <option value="ahorro">Ahorro</option>
                        <option value="corriente">Corriente</option>
                        <option value="bolsillo">Bolsillo</option>
                        <option value="efectivo">Efectivo</option>
                        <option value="tarjeta">Tarjeta Crédito</option>
                        <option value="broker">Inversión / Broker</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-[#737373] block mb-1 font-medium">Moneda</label>
                      <select
                        value={accountCurrency}
                        onChange={(e) => setAccountCurrency(e.target.value)}
                        className="w-full bg-[#f5f5f5] text-[#0a0a0a] text-xs p-3 rounded-[18px] border border-[#e5e5e5] outline-none"
                      >
                        <option value="COP">COP</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="saldo-inicial" className="text-xs text-[#737373] block mb-1 font-medium">Saldo inicial</label>
                    <input
                      id="saldo-inicial"
                      type="text"
                      inputMode={accountCurrency === 'COP' ? 'numeric' : 'decimal'}
                      placeholder="Ej.: 1.500.000"
                      value={formatEntrada(accountInitialBalance)}
                      onChange={(e) => setAccountInitialBalance(limpiarEntrada(e.target.value, accountCurrency !== 'COP'))}
                      className="w-full bg-[#f5f5f5] text-[#0a0a0a] text-sm min-h-[44px] px-3 rounded-[14px] border border-field outline-none focus:bg-white tabular-nums"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddAccountModal(false)}
                      className="px-4 py-2 text-xs text-[#737373] hover:text-[#0a0a0a] rounded-[18px]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="bg-[#0a0a0a] text-[#fafafa] px-4 py-2 rounded-[18px] text-xs font-medium hover:opacity-90"
                    >
                      Crear Cuenta
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
          {/* Sección de Divisas */}
          <div className="bg-white p-5 rounded-[24px] border border-[#e5e5e5] shadow-[0_0_0_1px_rgba(23,23,23,0.05),0_1px_3px_rgba(0,0,0,0.1)] space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-[#0a0a0a] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">currency_exchange</span>
                Divisas
              </h3>
            </div>

            {/* Fase 4: TRM oficial con vigencia y hora de actualización (la consulta el servidor cada hora) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" aria-live="polite">
              <div className={`p-3 rounded-[18px] border ${fx.respaldo ? 'border-[color:var(--alert)] bg-white' : 'border-[#e5e5e5] bg-[#fafafa]'}`}>
                <span className="text-xs text-[#737373] font-medium block">Dólar · TRM oficial</span>
                <div className="text-lg font-semibold text-[#0a0a0a] tabular-nums">{'$' + fx.usdCop.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}<span className="text-xs font-normal text-[#737373]">por US$1</span></div>
                <p className="text-xs text-[#737373]">{describirTrm(fx).replace(/^TRM [^·]+· /, '')}</p>
                {fx.proximaTrm && (
                  <p className="text-xs text-[#737373]">
                    Desde el {new Date(fx.proximaTrm.desde + 'T12:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}: ${fx.proximaTrm.valor.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                )}
              </div>
              <div className="p-3 rounded-[18px] border border-[#e5e5e5] bg-[#fafafa]">
                <span className="text-xs text-[#737373] font-medium block">Euro · BCE × TRM</span>
                <div className="text-lg font-semibold text-[#0a0a0a] tabular-nums">{'$' + fx.eurCop.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}<span className="text-xs font-normal text-[#737373]">por €1</span></div>
                <p className="text-xs text-[#737373]">{fx.eurDesde ? `Referencia del BCE del ${new Date(fx.eurDesde + 'T12:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}` : 'Sin referencia del BCE'}</p>
              </div>
            </div>
            <p className={`text-xs ${fx.respaldo ? 'text-alert' : 'text-[#737373]'}`} role="status">
              {describirConsulta(fx)} · Fuente: {fx.fuente}
              {fx.respaldo && ' · No pudimos consultar la tasa de hoy; usamos la última que guardaste.'}
            </p>

            {/* Tenencias en moneda extranjera */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#fafafa] border border-[#e5e5e5] p-3 rounded-[18px]">
                <span className="text-[11px] text-[#737373] uppercase font-medium block">Tenencias USD</span>
                <div className="text-base font-semibold text-[#0a0a0a] tabular-nums">
                  {privacyHidden ? '••••' : formatMonto(tenenciasUSD, 'USD', 'neutro')}
                </div>
                <span className="text-[11px] text-[#737373]">≈ {formatCOP(Math.round(toCOP(tenenciasUSD, 'USD', fx)))}</span>
              </div>
              <div className="bg-[#fafafa] border border-[#e5e5e5] p-3 rounded-[18px]">
                <span className="text-[11px] text-[#737373] uppercase font-medium block">Tenencias EUR</span>
                <div className="text-base font-semibold text-[#0a0a0a] tabular-nums">
                  {privacyHidden ? '••••' : formatMonto(tenenciasEUR, 'EUR', 'neutro')}
                </div>
                <span className="text-[11px] text-[#737373]">≈ {formatCOP(Math.round(toCOP(tenenciasEUR, 'EUR', fx)))}</span>
              </div>
            </div>

            {/* Conversor (solo cálculo) */}
            <div className="border-t border-[#e5e5e5] pt-3">
              <span className="text-[11px] text-[#737373] uppercase font-medium block mb-2">Conversor rápido</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label="Monto a convertir"
                  value={formatEntrada(convMonto)}
                  onChange={(e) => setConvMonto(limpiarEntrada(e.target.value, true))}
                  className="flex-1 min-w-0 bg-[#f5f5f5] text-[#0a0a0a] text-sm p-2.5 rounded-[14px] border border-[#e5e5e5] outline-none"
                  placeholder="Monto"
                />
                <select
                  value={convDesde}
                  onChange={(e) => setConvDesde(e.target.value as 'COP' | 'USD' | 'EUR')}
                  className="bg-[#f5f5f5] text-[#0a0a0a] text-xs p-2.5 rounded-[14px] border border-[#e5e5e5] outline-none font-medium"
                >
                  <option value="COP">COP</option><option value="USD">USD</option><option value="EUR">EUR</option>
                </select>
                <span className="material-symbols-outlined text-[18px] text-[#737373]">arrow_forward</span>
                <select
                  value={convHacia}
                  onChange={(e) => setConvHacia(e.target.value as 'COP' | 'USD' | 'EUR')}
                  className="bg-[#f5f5f5] text-[#0a0a0a] text-xs p-2.5 rounded-[14px] border border-[#e5e5e5] outline-none font-medium"
                >
                  <option value="COP">COP</option><option value="USD">USD</option><option value="EUR">EUR</option>
                </select>
              </div>
              <div className="mt-3 text-center">
                <span className="text-xl font-semibold text-[#0a0a0a] tabular-nums">
                  {convResultado.toLocaleString('es-CO', { maximumFractionDigits: convHacia === 'COP' ? 0 : 2 })} {convHacia}
                </span>
              </div>
              <p className="text-[10px] text-[#a3a3a3] mt-2 text-center">
                Para mover dinero entre monedas, haz una <b>Transferencia</b> entre una cuenta COP y una USD: la app convierte sola.
              </p>
            </div>
          </div>


          {/* Temas (antes "Estilos de Color"): solo elegir; el muestrario técnico se quitó (Fase 6) */}
          <div className="bg-white p-5 rounded-[24px] border border-[#e5e5e5] space-y-3">
            <h3 className="text-sm font-semibold text-[#0a0a0a] flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">palette</span> Tema de la app
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Tema">
              {APP_THEMES.map((theme) => {
                const activo = appTheme === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    role="radio"
                    aria-checked={activo}
                    onClick={() => { if ('vibrate' in navigator) navigator.vibrate(10); setAppTheme(theme.id); }}
                    className={`min-h-[64px] rounded-[18px] border p-3 text-left flex items-center gap-3 ${activo ? 'border-[#0a0a0a] ring-2 ring-[#0a0a0a]/15' : 'border-[#e5e5e5]'}`}
                  >
                    <span className="flex -space-x-1.5 shrink-0" aria-hidden="true">
                      {[theme.colors.canvas, theme.colors.ink, theme.colors.primary].map((c, i) => (
                        <span key={i} className="w-5 h-5 rounded-full border border-[#e5e5e5]" style={{ background: c }} />
                      ))}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-[#0a0a0a] truncate">{theme.name}</span>
                      <span className="block text-xs text-[#737373]">{theme.isDark ? 'Oscuro' : 'Claro'}{activo ? ' · en uso' : ''}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <button type="button" onClick={() => cerrarSesion()} className="w-full min-h-[52px] rounded-[18px] border border-field bg-white text-sm font-semibold text-[#0a0a0a] flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">logout</span> Cerrar sesión
          </button>
        </div>
      )}

    </div>
  );
};
