import React, { useState } from 'react';
import { useFinanceStore } from '../../store/useFinanceStore';
import { formatMonto } from '../../utils/money';
import { CapturaVoz } from '../Voz/CapturaVoz';

export const ExpressCalculator: React.FC = () => {
  const {
    calculator,
    inputDigit,
    performOperation,
    clearCalculator,
    backspaceCalculator,
    inputPercent,
    cuentas,
    categorias,
    setCalculatorAccount,
    setCalculatorCategory,
    setActiveTab,
    privacyHidden,
  } = useFinanceStore();
  // Fase 5: captura por voz (arriba a la izquierda)
  const [vozAbierta, setVozAbierta] = useState(false);

  const handleButtonClick = (action: () => void) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(8);
    }
    action();
  };

  // [E29] Si hay una operación sin resolver (5000 + 3000 sin "="), se resuelve antes de anotar.
  const hayOperacionPendiente = !!calculator.operation && calculator.previousValue != null && !calculator.waitingForNewOperand;
  const handleOpenRegisterWithAmount = () => {
    if ('vibrate' in navigator) navigator.vibrate(15);
    if (hayOperacionPendiente) performOperation('=');
    setActiveTab('register');
  };
  const resultadoPendiente = (() => {
    if (!hayOperacionPendiente) return Number(calculator.displayValue) || 0;
    const a = parseFloat(calculator.previousValue!), b = parseFloat(calculator.displayValue);
    switch (calculator.operation) {
      case '+': return a + b;
      case '-': return a - b;
      case '×': case '*': return a * b;
      case '÷': case '/': return b !== 0 ? a / b : a;
      default: return b;
    }
  })();

  // Botón con el signo visible: lo que llega a Registro ("−" = gasto, sin signo = ingreso)
  const cuentaCalc = cuentas.find((c) => c.id === calculator.selectedAccountId);
  const valorCalc = resultadoPendiente;
  const textoAnotar = privacyHidden || valorCalc === 0
    ? 'Anotar movimiento'
    : `Anotar ${formatMonto(valorCalc, cuentaCalc?.moneda || 'COP', valorCalc < 0 ? 'gasto' : 'ingreso')}`;

  const formatMathDisplay = (valStr: string) => {
    if (privacyHidden) return '••••••••';
    const num = parseFloat(valStr);
    if (isNaN(num)) return '0';
    // Formato es-CO: punto de miles y coma decimal
    if (valStr.includes('.')) {
      const [ent, dec] = valStr.replace('-', '').split('.');
      return (num < 0 ? '\u2212' : '') + Number(ent || '0').toLocaleString('es-CO') + ',' + dec;
    }
    return (num < 0 ? '\u2212' : '') + Math.abs(num).toLocaleString('es-CO');
  };

  return (
    <div className="flex flex-col max-w-md mx-auto gap-3 px-4 pb-4 pt-1 select-none">
      {/* Display Section */}
      <section className="flex flex-col justify-end items-end px-3 py-2 flex-1">
        {/* Micrófono (Fase 5) a la izquierda · selectores de contexto a la derecha */}
        <div className="flex gap-2 mb-3 w-full items-start justify-between">
          <button
            type="button"
            onClick={() => { if ('vibrate' in navigator) navigator.vibrate(10); setVozAbierta(true); }}
            aria-label="Anotar hablando"
            title="Anotar hablando"
            className="w-12 h-12 shrink-0 rounded-full bg-[#0a0a0a] text-[#fafafa] flex items-center justify-center shadow-sm active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-[24px]" aria-hidden="true">mic</span>
          </button>
          <div className="flex gap-2 flex-wrap justify-end">
          <select
            aria-label="Cuenta"
            value={calculator.selectedAccountId}
            onChange={(e) => setCalculatorAccount(e.target.value)}
            className="min-h-[44px] bg-[#f5f5f5] text-[#0a0a0a] text-xs px-3 py-1.5 rounded-[18px] border border-[#e5e5e5] outline-none cursor-pointer font-medium hover:bg-[#e5e5e5]/50 transition-colors"
          >
            {cuentas.map((c) => (
              <option key={c.id} value={c.id} className="bg-white text-[#0a0a0a]">
                {c.nombre}
              </option>
            ))}
          </select>

          <select
            aria-label="Categoría"
            value={calculator.selectedCategoryId}
            onChange={(e) => setCalculatorCategory(e.target.value)}
            className="min-h-[44px] bg-[#f5f5f5] text-[#0a0a0a] text-xs px-3 py-1.5 rounded-[18px] border border-[#e5e5e5] outline-none cursor-pointer font-medium hover:bg-[#e5e5e5]/50 transition-colors"
          >
            {categorias.map((cat) => (
              <option key={cat.id} value={cat.id} className="bg-white text-[#0a0a0a]">
                {cat.nombre}
              </option>
            ))}
          </select>
          </div>
        </div>

        {/* Display Amount */}
        <div className="w-full text-right overflow-hidden">
          {calculator.aviso && <div role="alert" className="text-sm text-alert mb-1 font-medium">{calculator.aviso}</div>}
          {calculator.operation && (
            <div className="text-sm text-[#737373] tabular-nums mb-1 font-medium tracking-tight">
              {formatMathDisplay(calculator.previousValue || '0')} {calculator.operation}
            </div>
          )}
          <div className="text-4xl sm:text-5xl font-semibold text-[#0a0a0a] tracking-[-0.04em] font-sans truncate tabular-nums">
            {formatMathDisplay(calculator.displayValue)}
          </div>
        </div>
      </section>

      {/* Main Action Button */}
      <div className="mb-3">
        <button
          onClick={handleOpenRegisterWithAmount}
          className="w-full bg-[#0a0a0a] text-[#fafafa] font-medium py-3 px-4 rounded-[18px] active:scale-[0.99] transition-all text-sm flex items-center justify-between hover:opacity-90"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">edit_note</span>
            <span className="tracking-normal font-medium">{textoAnotar}</span>
          </div>
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">arrow_forward</span>
        </button>
      </div>

      {/* Keypad Grid */}
      <section className="w-full grid grid-cols-4 gap-2 aspect-square max-h-[56vh]">
        {/* Row 1 */}
        <button
          onClick={() => handleButtonClick(clearCalculator)}
          className="rounded-[18px] bg-[#f5f5f5] text-[#0a0a0a] font-semibold text-base flex items-center justify-center border border-[#e5e5e5] hover:bg-[#e5e5e5]/60 active:scale-95 transition-all aspect-square"
          title="Limpiar todo"
        >
          AC
        </button>
        <button
          onClick={() => handleButtonClick(backspaceCalculator)}
          className="rounded-[18px] bg-[#f5f5f5] text-[#0a0a0a] font-medium text-base flex items-center justify-center border border-[#e5e5e5] hover:bg-[#e5e5e5]/60 active:scale-95 transition-all aspect-square"
          title="Borrar dígito"
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">backspace</span>
        </button>
        <button
          onClick={() => handleButtonClick(inputPercent)}
          className="rounded-[18px] bg-[#f5f5f5] text-[#0a0a0a] font-medium text-base flex items-center justify-center border border-[#e5e5e5] hover:bg-[#e5e5e5]/60 active:scale-95 transition-all aspect-square"
        >
          %
        </button>
        <button
          onClick={() => handleButtonClick(() => performOperation('÷'))}
          className={`rounded-[18px] ${
            calculator.operation === '÷'
              ? 'bg-[#0a0a0a] text-[#fafafa]'
              : 'bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5]'
          } font-medium text-xl flex items-center justify-center hover:bg-[#e5e5e5] active:scale-95 transition-all aspect-square`}
        >
          ÷
        </button>

        {/* Row 2 */}
        <button
          onClick={() => handleButtonClick(() => inputDigit('7'))}
          className="rounded-[18px] bg-white text-[#0a0a0a] font-medium text-xl flex items-center justify-center border border-[#e5e5e5] hover:bg-[#f5f5f5] active:scale-95 transition-all aspect-square shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
        >
          7
        </button>
        <button
          onClick={() => handleButtonClick(() => inputDigit('8'))}
          className="rounded-[18px] bg-white text-[#0a0a0a] font-medium text-xl flex items-center justify-center border border-[#e5e5e5] hover:bg-[#f5f5f5] active:scale-95 transition-all aspect-square shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
        >
          8
        </button>
        <button
          onClick={() => handleButtonClick(() => inputDigit('9'))}
          className="rounded-[18px] bg-white text-[#0a0a0a] font-medium text-xl flex items-center justify-center border border-[#e5e5e5] hover:bg-[#f5f5f5] active:scale-95 transition-all aspect-square shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
        >
          9
        </button>
        <button
          onClick={() => handleButtonClick(() => performOperation('×'))}
          className={`rounded-[18px] ${
            calculator.operation === '×'
              ? 'bg-[#0a0a0a] text-[#fafafa]'
              : 'bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5]'
          } font-medium text-xl flex items-center justify-center hover:bg-[#e5e5e5] active:scale-95 transition-all aspect-square`}
        >
          ×
        </button>

        {/* Row 3 */}
        <button
          onClick={() => handleButtonClick(() => inputDigit('4'))}
          className="rounded-[18px] bg-white text-[#0a0a0a] font-medium text-xl flex items-center justify-center border border-[#e5e5e5] hover:bg-[#f5f5f5] active:scale-95 transition-all aspect-square shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
        >
          4
        </button>
        <button
          onClick={() => handleButtonClick(() => inputDigit('5'))}
          className="rounded-[18px] bg-white text-[#0a0a0a] font-medium text-xl flex items-center justify-center border border-[#e5e5e5] hover:bg-[#f5f5f5] active:scale-95 transition-all aspect-square shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
        >
          5
        </button>
        <button
          onClick={() => handleButtonClick(() => inputDigit('6'))}
          className="rounded-[18px] bg-white text-[#0a0a0a] font-medium text-xl flex items-center justify-center border border-[#e5e5e5] hover:bg-[#f5f5f5] active:scale-95 transition-all aspect-square shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
        >
          6
        </button>
        <button
          onClick={() => handleButtonClick(() => performOperation('-'))}
          className={`rounded-[18px] ${
            calculator.operation === '-'
              ? 'bg-[#0a0a0a] text-[#fafafa]'
              : 'bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5]'
          } font-medium text-xl flex items-center justify-center hover:bg-[#e5e5e5] active:scale-95 transition-all aspect-square`}
        >
          −
        </button>

        {/* Row 4 */}
        <button
          onClick={() => handleButtonClick(() => inputDigit('1'))}
          className="rounded-[18px] bg-white text-[#0a0a0a] font-medium text-xl flex items-center justify-center border border-[#e5e5e5] hover:bg-[#f5f5f5] active:scale-95 transition-all aspect-square shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
        >
          1
        </button>
        <button
          onClick={() => handleButtonClick(() => inputDigit('2'))}
          className="rounded-[18px] bg-white text-[#0a0a0a] font-medium text-xl flex items-center justify-center border border-[#e5e5e5] hover:bg-[#f5f5f5] active:scale-95 transition-all aspect-square shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
        >
          2
        </button>
        <button
          onClick={() => handleButtonClick(() => inputDigit('3'))}
          className="rounded-[18px] bg-white text-[#0a0a0a] font-medium text-xl flex items-center justify-center border border-[#e5e5e5] hover:bg-[#f5f5f5] active:scale-95 transition-all aspect-square shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
        >
          3
        </button>
        <button
          onClick={() => handleButtonClick(() => performOperation('+'))}
          className={`rounded-[18px] ${
            calculator.operation === '+'
              ? 'bg-[#0a0a0a] text-[#fafafa]'
              : 'bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5]'
          } font-medium text-xl flex items-center justify-center hover:bg-[#e5e5e5] active:scale-95 transition-all aspect-square`}
        >
          +
        </button>

        {/* Row 5 */}
        <button
          onClick={() => handleButtonClick(() => inputDigit('0'))}
          className="rounded-[18px] bg-white text-[#0a0a0a] font-medium text-xl flex items-center justify-center col-span-2 aspect-[2/1] border border-[#e5e5e5] hover:bg-[#f5f5f5] active:scale-95 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
        >
          0
        </button>
        <button
          onClick={() => handleButtonClick(() => inputDigit('.'))}
          className="rounded-[18px] bg-white text-[#0a0a0a] font-medium text-xl flex items-center justify-center border border-[#e5e5e5] hover:bg-[#f5f5f5] active:scale-95 transition-all aspect-square shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
        >
          .
        </button>
        <button
          onClick={() => handleButtonClick(() => performOperation('='))}
          className="rounded-[18px] bg-[#0a0a0a] text-[#fafafa] font-medium text-xl flex items-center justify-center hover:opacity-90 active:scale-95 transition-all aspect-square shadow-sm"
        >
          =
        </button>
      </section>
      {vozAbierta && <CapturaVoz onCerrar={() => setVozAbierta(false)} />}
    </div>
  );
};
