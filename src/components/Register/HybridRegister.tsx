import React, { useState, useEffect, useRef } from 'react';
import { useFinanceStore, type ResultadoAnotar } from '../../store/useFinanceStore';
import { disponibleCOP, pendienteDeuda, type ErrorDinero } from '../../utils/reglas';
import { convertir } from '../../services/currency';
import { describirTrm } from '../../utils/fx';
import { formatMonto, formatEntrada, limpiarEntrada, simboloMoneda } from '../../utils/money';

// Iteración Registro + diseño (2026-11-17), definida por la mesa diseñadora UI + creador digital.
// Regla de la dueña: el signo decide el tipo → "-5000" = gasto, "5000" = ingreso.

type Modo = 'movimiento' | 'transferencia';

const recortar = (t: string, n = 16) => (t.length > n ? t.slice(0, n - 1) + '…' : t);

/** Valor inicial a partir de la Calculadora (formato JS: "-1234.5"). */
function desdeCalculadora(displayValue: string, moneda: string) {
  const n = Number(displayValue);
  if (!Number.isFinite(n) || n === 0) return { signo: 1 as 1 | -1, entrada: '', redondeado: false };
  const signo: 1 | -1 = n < 0 ? -1 : 1;
  const abs = Math.abs(n);
  if (moneda === 'COP') {
    const r = Math.round(abs);
    return { signo, entrada: String(r), redondeado: r !== abs };
  }
  return { signo, entrada: String(Math.round(abs * 100) / 100), redondeado: false };
}

export const HybridRegister: React.FC = () => {
  const {
    cuentas,
    categorias,
    categoriasRapidas,
    transacciones,
    calculator,
    clearCalculator,
    addTransaccion,
    addCuenta,
    addCategoria,
    addCategoriaRapida,
    addDeuda,
    addMeta,
    deudas,
    metas,
    setActiveTab,
    privacyHidden,
    fx,
  } = useFinanceStore();
  // Si se llegó desde Metas y Deudas, la meta o deuda ya viene elegida (se lee una sola vez).
  const [prefill] = useState(() => useFinanceStore.getState().consumirPrefill());

  const montoRef = useRef<HTMLInputElement>(null);
  const nombreMetaRef = useRef<HTMLInputElement>(null);
  const personaRef = useRef<HTMLInputElement>(null);

  const [modo, setModo] = useState<Modo>('movimiento');

  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    (cuentas.some((c) => c.id === calculator.selectedAccountId) ? calculator.selectedAccountId : cuentas[0]?.id) || ''
  );
  const cuentaOrigen = cuentas.find((c) => c.id === selectedAccountId);
  // Fase 3: la moneda del monto depende de qué se anota (metas en COP; deuda "ya existía" en su propia moneda).
  const [segment, setSegment] = useState<'general' | 'metas' | 'deudores'>(prefill?.segment || 'general');
  const [isNewMeta, setIsNewMeta] = useState<boolean>(!!prefill?.nuevaMeta);
  const [isNewDeuda, setIsNewDeuda] = useState<boolean>(!!prefill?.nuevaDeuda);
  const [movioPlata, setMovioPlata] = useState<boolean>(true);
  const [monedaDeuda, setMonedaDeuda] = useState<'COP' | 'USD' | 'EUR'>('COP');
  const moneda: 'COP' | 'USD' | 'EUR' =
    segment === 'metas' ? 'COP'
    : segment === 'deudores' && isNewDeuda && !movioPlata ? monedaDeuda
    : cuentaOrigen?.moneda || 'COP';
  const conDecimales = moneda !== 'COP';

  // Monto: número canónico ("5000", "12.5") separado del texto con máscara. Nunca parseFloat del texto visible.
  const inicial = useState(() => desdeCalculadora(calculator.displayValue, moneda))[0];
  const [signo, setSigno] = useState<1 | -1>(inicial.signo);
  const [entrada, setEntrada] = useState<string>(inicial.entrada);
  const [avisoRedondeo, setAvisoRedondeo] = useState<boolean>(inicial.redondeado);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Propuesta para corregir un rechazo (p. ej. sobrepago: "Abonar $X")
  const [propuesta, setPropuesta] = useState<{ texto: string; accion: () => void } | null>(null);

  const [destinoAccountId, setDestinoAccountId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(calculator.selectedCategoryId || '');
  const [subcategoria, setSubcategoria] = useState<string>('');
  const [notas, setNotas] = useState<string>('');
  const ahoraLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [fecha, setFechaEstado] = useState<string>(ahoraLocal);
  // [U9] Si la persona no cambió la fecha a mano, cada guardado vuelve a "ahora".
  const fechaManual = useRef(false);
  const setFecha = (v: string) => { fechaManual.current = true; setFechaEstado(v); };
  // Fecha que se guarda: la elegida a mano, o el momento exacto de guardar (no el de abrir la pantalla)
  const fechaISO = () => (fechaManual.current ? new Date(fecha).toISOString() : new Date().toISOString());

  // Metas
  const [selectedMetaId, setSelectedMetaId] = useState<string>(prefill?.metaId || metas[0]?.id || '');
  const [operacionMeta, setOperacionMeta] = useState<'apartar' | 'sacar'>(prefill?.operacionMeta || 'apartar');
  const [nombreMeta, setNombreMeta] = useState<string>('');
  // [U2] Sin valores fijos: la persona escribe su objetivo y su fecha
  const [montoObjetivoMeta, setMontoObjetivoMeta] = useState<string>('');
  const [fechaLimiteMeta, setFechaLimiteMeta] = useState<string>('');

  // Deudas
  // Solo deudas activas: a una saldada no se le abona (DEUDA_SALDADA)
  const deudasActivas = deudas.filter((d) => d.estado !== 'saldada');
  const [selectedDeudaId, setSelectedDeudaId] = useState<string>(prefill?.deudaId || deudasActivas[0]?.id || '');
  const [operacionDeuda, setOperacionDeuda] = useState<'abono' | 'incremento'>(prefill?.operacionDeuda || 'abono');
  const [personaDeuda, setPersonaDeuda] = useState<string>('');
  const [conceptoDeuda, setConceptoDeuda] = useState<string>('Préstamo');
  const [relacionDeuda, setRelacionDeuda] = useState<'por_cobrar' | 'por_pagar'>('por_cobrar');
  const [fechaVencimientoDeuda, setFechaVencimientoDeuda] = useState<string>('');

  // Modales
  const [showAddAccountModal, setShowAddAccountModal] = useState<boolean>(false);
  const [accName, setAccName] = useState<string>('');
  const [accType, setAccType] = useState<'ahorro' | 'corriente' | 'tarjeta' | 'efectivo' | 'bolsillo' | 'broker'>('ahorro');
  const [accCurrency, setAccCurrency] = useState<string>('COP');
  const [accBalance, setAccBalance] = useState<string>('');

  const [showAddCatModal, setShowAddCatModal] = useState<boolean>(false);
  const [newCatName, setNewCatName] = useState<string>('');
  const [newCatSuper, setNewCatSuper] = useState<string>('Gastos Diarios');
  // [U23] El grupo por defecto sigue al tipo (una categoría de ingreso no queda en "Gastos Diarios")
  useEffect(() => { if (showAddCatModal) setNewCatSuper(signo < 0 ? 'Gastos Diarios' : 'Ingresos'); }, [showAddCatModal]); // eslint-disable-line react-hooks/exhaustive-deps

  const [showAddQuickModal, setShowAddQuickModal] = useState<boolean>(false);
  const [quickNombre, setQuickNombre] = useState<string>('');
  const [quickSubcat, setQuickSubcat] = useState<string>('');
  const [quickNota, setQuickNota] = useState<string>('');
  const [quickCatId, setQuickCatId] = useState<string>(categorias[0]?.id || '');

  // ---------- Derivados ----------
  const valor = parseFloat(entrada) || 0;
  const puedeTransferir = cuentas.length >= 2;
  const enMovimiento = segment === 'general' && modo === 'movimiento';
  const enTransferencia = segment === 'general' && modo === 'transferencia';
  const tipoCategoria: 'gasto' | 'ingreso' = signo < 0 ? 'gasto' : 'ingreso';
  const categoriasDelTipo = categorias.filter((c) => c.tipo === tipoCategoria);

  const deudaSel = deudasActivas.find((d) => d.id === selectedDeudaId);
  const metaSel = metas.find((m) => m.id === selectedMetaId);
  const tipoTxDeuda: 'ingreso' | 'gasto' =
    operacionDeuda === 'incremento'
      ? deudaSel?.tipo === 'por_cobrar' ? 'gasto' : 'ingreso'
      : deudaSel?.tipo === 'por_cobrar' ? 'ingreso' : 'gasto';

  const cuentaDestino = cuentas.find((c) => c.id === destinoAccountId);
  const monedaDestino = cuentaDestino?.moneda || 'COP';
  // Metas virtuales (D-029): apartar o sacar no usa cuenta. Deuda nueva "ya existía": tampoco.
  const usaCuenta = segment === 'general' || (segment === 'deudores' && (!isNewDeuda || movioPlata));

  // Solo hay transferencia con 2 o más cuentas (patrón Cashew)
  useEffect(() => {
    if (!puedeTransferir && modo === 'transferencia') setModo('movimiento');
  }, [puedeTransferir, modo]);

  // [U3] La meta elegida siempre existe (p. ej. justo después de crear la primera)
  useEffect(() => {
    if (!metas.some((m) => m.id === selectedMetaId)) setSelectedMetaId(metas[0]?.id || '');
  }, [metas, selectedMetaId]);

  // La deuda elegida siempre es una activa
  useEffect(() => {
    if (!deudasActivas.some((d) => d.id === selectedDeudaId)) setSelectedDeudaId(deudasActivas[0]?.id || '');
  }, [deudasActivas, selectedDeudaId]);

  // Cualquier cambio en el formulario borra el aviso y la propuesta anteriores
  // [U1] Incluye operación de deuda, deuda/meta nueva, modo y destino: la propuesta nunca queda de otro contexto.
  useEffect(() => { setPropuesta(null); setErrorMsg(null); },
    [segment, selectedDeudaId, selectedMetaId, operacionMeta, operacionDeuda, isNewDeuda, isNewMeta, modo, selectedAccountId, destinoAccountId, movioPlata, relacionDeuda]);

  // Destino siempre distinto del origen
  useEffect(() => {
    if (!destinoAccountId || destinoAccountId === selectedAccountId || !cuentas.some((c) => c.id === destinoAccountId)) {
      setDestinoAccountId(cuentas.find((c) => c.id !== selectedAccountId)?.id || '');
    }
  }, [selectedAccountId, destinoAccountId, cuentas]);

  // [E15] La categoría corresponde al tipo derivado del signo
  useEffect(() => {
    if (categoriasDelTipo.some((c) => c.id === selectedCategoryId)) return;
    const deCalc = categoriasDelTipo.find((c) => c.id === calculator.selectedCategoryId)?.id;
    const ultima = transacciones.find((t) => categoriasDelTipo.some((c) => c.id === t.categoria_id))?.categoria_id;
    setSelectedCategoryId(deCalc || ultima || categoriasDelTipo[0]?.id || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoCategoria, categorias]);

  // Cuentas COP no usan centavos
  useEffect(() => {
    if (!conDecimales && entrada.includes('.')) {
      setEntrada(String(Math.round(parseFloat(entrada) || 0)));
      setAvisoRedondeo(true);
    }
  }, [conDecimales, entrada]);

  // ---------- Campo de monto ----------
  const permiteSigno = enMovimiento;

  const onBeforeInput = (e: React.FormEvent<HTMLInputElement>) => {
    const data = (e.nativeEvent as InputEvent).data;
    if (!data) return;
    if (data === '-' || data === '−') {
      e.preventDefault();
      if (permiteSigno) setSigno(-1);
      return;
    }
    if (data === '+') {
      e.preventDefault();
      if (permiteSigno) setSigno(1);
      return;
    }
    if (data === '.' || data === ',') {
      e.preventDefault();
      if (conDecimales && !entrada.includes('.')) setEntrada((entrada || '0') + '.');
    }
  };

  const onChangeMonto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (permiteSigno && /[-−]/.test(raw)) setSigno(-1);
    else if (permiteSigno && raw.includes('+')) setSigno(1);
    setEntrada(limpiarEntrada(raw, conDecimales));
    setErrorMsg(null);
    setPropuesta(null);
    setAvisoRedondeo(false);
  };

  const alternarSigno = () => {
    setSigno((s) => (s < 0 ? 1 : -1));
    if ('vibrate' in navigator) navigator.vibrate(10);
  };

  // Presentación según el tipo (color + signo + texto, nunca solo color)
  let colorMonto = 'text-[#0a0a0a]';
  let signoVisible = '';
  let etiqueta: { icono: string; texto: string; clase: string } = { icono: '', texto: '¿Cuánto fue?', clase: 'text-[#737373] border-[#e5e5e5]' };
  if (enMovimiento) {
    if (valor > 0) {
      if (signo < 0) {
        colorMonto = 'text-expense'; signoVisible = '−';
        etiqueta = { icono: 'arrow_downward', texto: 'Gasto', clase: 'text-expense border-expense' };
      } else {
        colorMonto = 'text-income'; signoVisible = '+';
        etiqueta = { icono: 'arrow_upward', texto: 'Ingreso', clase: 'text-income border-income' };
      }
    } else if (signo < 0) {
      colorMonto = 'text-expense'; signoVisible = '−';
    }
  } else if (enTransferencia) {
    colorMonto = 'text-transfer';
    etiqueta = { icono: 'swap_horiz', texto: 'Transferencia · no es gasto ni ingreso', clase: 'text-transfer border-transfer' };
  } else if (segment === 'metas') {
    colorMonto = isNewMeta ? colorMonto : 'text-transfer';
    etiqueta = isNewMeta
      ? { icono: '', texto: 'Monto', clase: 'text-[#737373] border-[#e5e5e5]' }
      : operacionMeta === 'apartar'
        ? { icono: 'savings', texto: 'Apartar · sigue siendo tu plata', clase: 'text-transfer border-transfer' }
        : { icono: 'undo', texto: 'Sacar de la meta · vuelve a tu disponible', clase: 'text-transfer border-transfer' };
  } else {
    etiqueta = {
      icono: '',
      texto: isNewDeuda
        ? (movioPlata ? (relacionDeuda === 'por_cobrar' ? 'Le prestaste · sale de tu cuenta' : 'Te prestaron · entra a tu cuenta') : 'Monto que ya debían')
        : tipoTxDeuda === 'ingreso' ? 'Entra a la cuenta · no es ingreso' : 'Sale de la cuenta · no es gasto',
      clase: 'text-[#737373] border-[#e5e5e5]',
    };
  }

  const textoMonto = formatEntrada(entrada);
  const tamanoMonto = textoMonto.length > 12 ? 'text-2xl' : textoMonto.length > 9 ? 'text-3xl' : 'text-4xl sm:text-5xl';

  // ---------- Botón final dinámico ----------
  const montoTxt = formatMonto(valor, moneda, 'neutro');
  let textoBoton = 'Guardar';
  if (valor <= 0 && !(segment === 'metas' && isNewMeta)) textoBoton = 'Escribe un monto';
  else if (enMovimiento) textoBoton = `Guardar ${signo < 0 ? 'gasto' : 'ingreso'} de ${montoTxt}`;
  else if (enTransferencia) textoBoton = `Mover ${montoTxt} a ${recortar(cuentaDestino?.nombre || 'otra cuenta')}`;
  else if (segment === 'metas') {
    textoBoton = isNewMeta
      ? 'Crear meta'
      : operacionMeta === 'apartar'
        ? `Apartar ${montoTxt} para ${recortar(metaSel?.nombre || 'tu meta')}`
        : `Sacar ${montoTxt} de ${recortar(metaSel?.nombre || 'tu meta')}`;
  } else {
    textoBoton = isNewDeuda ? 'Anotar deuda' : `Guardar ${operacionDeuda === 'abono' ? 'abono' : 'aumento'} de ${montoTxt}`;
  }

  // Agenda: solo contrapartes reales (sin nombres de ejemplo)
  const contrapartesAgenda = Array.from(new Set(deudas.map((d) => d.contraparte)));

  const etiquetaOp = (op: 'abono' | 'incremento') => {
    if (deudaSel?.tipo === 'por_pagar') return op === 'abono' ? 'Pagué' : 'Me prestaron más';
    return op === 'abono' ? 'Me pagó' : 'Le presté más';
  };

  // ---------- Acciones ----------
  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) return;
    addCuenta({
      nombre: accName.trim(),
      tipo: accType,
      moneda: accCurrency as 'COP' | 'USD' | 'EUR',
      saldo_actual: parseFloat(limpiarEntrada(accBalance, accCurrency !== 'COP')) || 0,
      mascara: `**** ${Math.floor(1000 + Math.random() * 9000)}`,
      color_badge: '#0a0a0a',
    });
    setAccName('');
    setAccBalance('');
    setShowAddAccountModal(false);
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    addCategoria({
      nombre: newCatName.trim(),
      supercategoria: newCatSuper,
      tipo: tipoCategoria,
      icono: 'label',
    });
    setNewCatName('');
    setShowAddCatModal(false);
  };

  const handleCreateQuickCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickNombre.trim()) return;
    addCategoriaRapida({
      nombre: quickNombre.trim(),
      categoria_id: quickCatId || categorias[0]?.id || '',
      subcategoria: quickSubcat || 'General',
      nota_predeterminada: quickNota || quickNombre.trim(),
      icono: 'bolt',
    });
    setQuickNombre('');
    setQuickSubcat('');
    setQuickNota('');
    setShowAddQuickModal(false);
  };

  const handleSelectQuickCategory = (rap: typeof categoriasRapidas[0]) => {
    const cat = categorias.find((c) => c.id === rap.categoria_id);
    if (cat) setSigno(cat.tipo === 'gasto' ? -1 : 1); // el atajo también define el signo
    setSelectedCategoryId(rap.categoria_id);
    setSubcategoria(rap.subcategoria);
    setNotas(rap.nota_predeterminada);
    if ('vibrate' in navigator) navigator.vibrate(10);
  };

  // La categoría siempre coincide con el tipo de la transacción (evita un gasto con categoría de ingresos)
  const categoriaPara = (tipo: 'gasto' | 'ingreso') => {
    const vale = (id: string) => categorias.some((c) => c.id === id && c.tipo === tipo);
    if (vale(selectedCategoryId)) return selectedCategoryId;
    if (vale(calculator.selectedCategoryId)) return calculator.selectedCategoryId;
    return categorias.find((c) => c.tipo === tipo)?.id || categorias[0]?.id || '';
  };

  const fallar = (msg: string, ref: React.RefObject<HTMLInputElement | null> = montoRef) => {
    setErrorMsg(msg);
    ref.current?.focus();
  };

  const limpiarTrasGuardar = () => {
    // [E20] La calculadora y el campo quedan limpios para no duplicar el monto.
    // D-036: después de guardar te quedas en Registro para anotar el siguiente.
    clearCalculator();
    setEntrada('');
    setSigno(1);
    setErrorMsg(null);
    setPropuesta(null);
    setNotas('');
    setSubcategoria('');
    // [U4] Campos de meta y deuda nuevas también se limpian (evita crear duplicados con un segundo toque)
    setNombreMeta(''); setMontoObjetivoMeta(''); setFechaLimiteMeta('');
    setPersonaDeuda(''); setFechaVencimientoDeuda('');
    if (!fechaManual.current) setFechaEstado(ahoraLocal());
    if ('vibrate' in navigator) navigator.vibrate([20, 50, 20]);
  };

  /** Muestra el rechazo y, si se puede, una propuesta para corregirlo con un toque. */
  const mostrarRechazo = (err: ErrorDinero) => {
    fallar(err.mensaje);
    if (err.codigo === 'SOBREPAGO' && deudaSel && err.maximo !== undefined && cuentaOrigen) {
      // Pendiente (en moneda de la deuda) expresado en la moneda de la cuenta
      const pendCuenta = convertir(err.maximo, deudaSel.moneda || 'COP', cuentaOrigen.moneda || 'COP', fx);
      const pendRed = cuentaOrigen.moneda === 'COP' ? Math.floor(pendCuenta) : Math.floor(pendCuenta * 100) / 100;
      const exceso = Math.round((valor - pendRed) * 100) / 100;
      const notaBase = `Abono a deuda: ${deudaSel.contraparte}`;
      const abonar = () => addTransaccion({ cuenta_id: selectedAccountId, categoria_id: '', monto: pendRed, tipo: 'abono_capital', deuda_id: deudaSel.id, fecha: fechaISO(), notas: notaBase });
      if (deudaSel.tipo === 'por_cobrar' && exceso > 0) {
        // D-031: te pagaron de más → el excedente se ofrece como ingreso
        setPropuesta({
          texto: `Abonar ${formatMonto(pendRed, moneda, 'neutro')} y anotar ${formatMonto(exceso, moneda, 'neutro')} como ingreso`,
          accion: () => {
            const r = abonar();
            if (r.error) return fallar(r.error.mensaje);
            addTransaccion({ cuenta_id: selectedAccountId, categoria_id: categoriaPara('ingreso'), monto: exceso, tipo: 'ingreso', fecha: fechaISO(), notas: `Excedente de ${deudaSel.contraparte}` });
            limpiarTrasGuardar();
          },
        });
      } else {
        setPropuesta({
          texto: `Abonar ${formatMonto(pendRed, moneda, 'neutro')} y saldar`,
          accion: () => { const r = abonar(); if (r.error) return fallar(r.error.mensaje); limpiarTrasGuardar(); },
        });
      }
    } else if (err.codigo === 'RETIRO_MAYOR' && err.maximo && err.maximo > 0) {
      setPropuesta({ texto: `Sacar todo (${formatMonto(err.maximo, 'COP', 'neutro')})`, accion: () => { setEntrada(String(Math.floor(err.maximo!))); setPropuesta(null); } });
    } else if (err.codigo === 'DISPONIBLE_INSUFICIENTE' && err.maximo && err.maximo > 0) {
      setPropuesta({ texto: `Apartar ${formatMonto(err.maximo, 'COP', 'neutro')}`, accion: () => { setEntrada(String(Math.floor(err.maximo!))); setPropuesta(null); } });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    // [E27] Crear una meta no usa el monto principal: no se exige.
    const creandoMeta = segment === 'metas' && isNewMeta;
    if (valor <= 0 && !creandoMeta) return fallar('Escribe cuánto fue.');
    if (usaCuenta && !selectedAccountId) return fallar('Elige una cuenta.');
    let r: ResultadoAnotar = {};

    if (segment === 'general') {
      if (enTransferencia) {
        if (!destinoAccountId || destinoAccountId === selectedAccountId) return fallar('Elige otra cuenta para recibir.');
        const fullNotas = [subcategoria ? `[${subcategoria}]` : '', notas].filter(Boolean).join(' ');
        r = addTransaccion({
          cuenta_id: selectedAccountId,
          destino_cuenta_id: destinoAccountId,
          categoria_id: '', // una transferencia no tiene categoría
          monto: valor,
          tipo: 'transferencia',
          fecha: fechaISO(),
          notas: fullNotas || `Transferencia ${cuentaOrigen?.nombre || ''} → ${cuentaDestino?.nombre || ''}`,
        });
      } else {
        if (!selectedCategoryId) return fallar(`Crea una categoría de ${tipoCategoria}s para continuar.`);
        const catObj = categorias.find((c) => c.id === selectedCategoryId);
        const fullNotas = [subcategoria ? `[${subcategoria}]` : '', notas].filter(Boolean).join(' ');
        r = addTransaccion({
          cuenta_id: selectedAccountId,
          categoria_id: selectedCategoryId,
          monto: valor, // siempre positivo; el tipo lo define el signo
          tipo: tipoCategoria,
          fecha: fechaISO(),
          notas: fullNotas || `${tipoCategoria === 'gasto' ? 'Gasto' : 'Ingreso'} ${catObj?.nombre || ''}`.trim(),
        });
      }
    } else if (segment === 'metas') {
      if (isNewMeta) {
        if (!nombreMeta.trim()) return fallar('Ponle nombre a tu meta.', nombreMetaRef);
        if (!(parseFloat(montoObjetivoMeta) > 0) && !(valor > 0)) return fallar('¿Cuánto necesitas para esta meta?');
        const nuevaId = addMeta({
          nombre: nombreMeta.trim(),
          monto_objetivo: parseFloat(montoObjetivoMeta) || valor * 5 || 0,
          color: '#0a0a0a',
          fecha_limite: fechaLimiteMeta || undefined,
        });
        setIsNewMeta(false); setOperacionMeta('apartar'); setSelectedMetaId(nuevaId);
      } else {
        if (!selectedMetaId) return fallar('Elige una meta.');
        // Metas virtuales (D-029): no mueven ninguna cuenta; el monto va en COP.
        r = addTransaccion({
          cuenta_id: '',
          categoria_id: '',
          monto: valor,
          tipo: operacionMeta === 'apartar' ? 'aporte_meta' : 'retiro_meta',
          fecha: fechaISO(),
          notas: `${operacionMeta === 'apartar' ? 'Apartado para' : 'Sacado de'} ${metaSel?.nombre || 'la meta'}`,
          meta_id: selectedMetaId,
        });
      }
    } else {
      if (isNewDeuda) {
        if (!personaDeuda.trim()) return fallar('¿Con quién es la deuda?', personaRef);
        r = await addDeuda(
          {
            contraparte: personaDeuda.trim(),
            concepto: conceptoDeuda,
            tipo: relacionDeuda,
            moneda: movioPlata ? cuentaOrigen?.moneda || 'COP' : monedaDeuda,
            monto_total: valor,
            monto_pagado: 0,
            estado: 'activa',
            fecha_vencimiento: fechaVencimientoDeuda || undefined,
          },
          movioPlata ? { cuenta_id: selectedAccountId, monto: valor } : undefined,
        );
      } else {
        if (!selectedDeudaId) return fallar('Elige una deuda.');
        // Capital de deudas (D-030): mueve la cuenta, no es ingreso ni gasto.
        r = addTransaccion({
          cuenta_id: selectedAccountId,
          categoria_id: '',
          monto: valor,
          tipo: operacionDeuda === 'incremento' ? 'prestamo_capital' : 'abono_capital',
          fecha: fechaISO(),
          notas: `${operacionDeuda === 'incremento' ? 'Aumento de deuda' : 'Abono a deuda'}: ${deudaSel?.contraparte || ''} (${deudaSel?.concepto || ''})`,
          deuda_id: selectedDeudaId,
        });
      }
    }

    if (r.error) return mostrarRechazo(r.error);
    limpiarTrasGuardar();
  };

  // ---------- Estilos comunes ----------
  const fila = 'flex items-center justify-between gap-3 p-2';
  const selectCls =
    'bg-[#f5f5f5] text-[#0a0a0a] text-sm px-3 min-h-[44px] rounded-[14px] border border-[#e5e5e5] font-medium cursor-pointer max-w-[200px] truncate';
  const inputCls = 'w-full bg-[#f5f5f5] text-[#0a0a0a] text-sm px-3 min-h-[44px] rounded-[14px] border border-[#e5e5e5] focus:bg-white';
  const labelCls = 'text-xs font-medium text-[#737373] block mb-1';
  const segBtn = (activo: boolean) =>
    `flex-1 min-h-[44px] rounded-[14px] text-sm font-medium transition-all ${
      activo ? 'bg-[#0a0a0a] text-[#fafafa] shadow-sm' : 'text-[#737373] hover:text-[#0a0a0a]'
    }`;
  const chipBtn = (activo: boolean) =>
    `flex-1 min-h-[44px] rounded-[14px] text-sm font-medium border transition-all ${
      activo ? 'bg-[#0a0a0a] text-[#fafafa] border-[#0a0a0a]' : 'bg-[#f5f5f5] text-[#737373] border-[#e5e5e5]'
    }`;
  const iconBtn =
    'w-11 h-11 rounded-[14px] bg-[#f5f5f5] text-[#0a0a0a] hover:bg-[#e5e5e5] border border-[#e5e5e5] flex items-center justify-center active:scale-95 transition-all shrink-0';
  const etiquetaCuenta = (c: (typeof cuentas)[0]) =>
    `${c.nombre} · ${privacyHidden ? '••••' : formatMonto(c.saldo_actual, c.moneda)}`;

  // Tasa visible si la transferencia cambia de moneda
  const monedaExtranjera = moneda !== 'COP' ? moneda : monedaDestino;
  const tasaExtranjera = monedaExtranjera === 'EUR' ? fx.eurCop : fx.usdCop;
  const llegaAprox = convertir(valor, moneda, monedaDestino, fx);

  return (
    <div className="max-w-2xl mx-auto px-4 pb-28 pt-2 space-y-4">
      {/* Encabezado */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('calculator')}
          className="text-[#737373] hover:text-[#0a0a0a] flex items-center gap-1 text-sm font-medium px-2 min-h-[44px] rounded-[14px] hover:bg-[#f5f5f5]"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>Calculadora</span>
        </button>
        <h1 className="flex-1 text-right text-base font-semibold text-[#0a0a0a] tracking-tight pr-1">Anotar movimiento</h1>
      </div>

      {/* Segmentos */}
      <div className="bg-[#f5f5f5] p-1 rounded-[18px] flex border border-[#e5e5e5]" role="tablist" aria-label="Tipo de registro">
        <button type="button" role="tab" aria-selected={segment === 'general'} onClick={() => { setSegment('general'); setErrorMsg(null); }} className={segBtn(segment === 'general')}>
          Movimiento
        </button>
        <button type="button" role="tab" aria-selected={segment === 'metas'} onClick={() => { setSegment('metas'); setErrorMsg(null); }} className={segBtn(segment === 'metas')}>
          Metas
        </button>
        <button type="button" role="tab" aria-selected={segment === 'deudores'} onClick={() => { setSegment('deudores'); setErrorMsg(null); }} className={segBtn(segment === 'deudores')}>
          Deudas
        </button>
      </div>

      {/* Modo: Gasto o ingreso | Entre mis cuentas */}
      {segment === 'general' && puedeTransferir && (
        <div className="bg-[#f5f5f5] p-1 rounded-[18px] flex border border-[#e5e5e5]" role="tablist" aria-label="Modo">
          <button type="button" role="tab" aria-selected={modo === 'movimiento'} onClick={() => { setModo('movimiento'); setErrorMsg(null); }} className={segBtn(modo === 'movimiento')}>
            Gasto o ingreso
          </button>
          <button type="button" role="tab" aria-selected={modo === 'transferencia'} onClick={() => { setModo('transferencia'); setErrorMsg(null); }} className={segBtn(modo === 'transferencia')}>
            Entre mis cuentas
          </button>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4" noValidate>
        {/* Monto */}
        <div className="bg-white rounded-[24px] p-5 border border-[#e5e5e5] shadow-[0_0_0_1px_rgba(23,23,23,0.05),0_1px_3px_rgba(0,0,0,0.1)] flex flex-col items-center">
          <span role="status" aria-live="polite" className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors duration-150 ${etiqueta.clase}`}>
            {etiqueta.icono && <span className="material-symbols-outlined text-[16px]" aria-hidden="true">{etiqueta.icono}</span>}
            {etiqueta.texto}
          </span>

          <div className="flex items-center justify-center gap-3 w-full mt-3">
            {enMovimiento && (
              <button
                type="button"
                onClick={alternarSigno}
                aria-label={signo < 0 ? 'Cambiar a ingreso' : 'Cambiar a gasto'}
                className={`w-12 h-12 shrink-0 rounded-[14px] border border-field bg-white text-lg font-semibold active:scale-95 transition-all ${signo < 0 ? 'text-expense' : 'text-[#0a0a0a]'}`}
              >
                −/+
              </button>
            )}
            <label htmlFor="monto" className="sr-only">Monto</label>
            <div className={`monto-wrap flex items-baseline justify-center min-w-0 flex-1 font-semibold tabular-nums tracking-[-0.04em] ${tamanoMonto} ${colorMonto}`}>
              <span aria-hidden="true" className="shrink-0">{signoVisible}{simboloMoneda(moneda)}</span>
              <input
                id="monto"
                ref={montoRef}
                type="text"
                inputMode={conDecimales ? 'decimal' : 'numeric'}
                autoComplete="off"
                enterKeyHint="done"
                value={textoMonto}
                onBeforeInput={onBeforeInput}
                onChange={onChangeMonto}
                placeholder="0"
                aria-invalid={!!errorMsg}
                aria-describedby="monto-ayuda"
                className={`bg-transparent outline-none min-w-0 w-full text-left placeholder:text-[#737373] ${colorMonto}`}
              />
            </div>
          </div>

          <div id="monto-ayuda" className="mt-2 text-center space-y-1">
            {errorMsg && (
              <p role="alert" className="text-sm font-medium text-ember flex items-center justify-center gap-1">
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">error</span>
                {errorMsg}
              </p>
            )}
            {propuesta && (
              <button
                type="button"
                onClick={propuesta.accion}
                className="mx-auto mt-1 min-h-[44px] px-4 rounded-[14px] text-sm font-semibold text-[#0a0a0a] border border-field bg-white active:scale-95 transition-all"
              >
                {propuesta.texto}
              </button>
            )}
            {enMovimiento && !errorMsg && <p className="text-xs text-[#737373]">Con − es gasto · Sin signo es ingreso</p>}
            {enTransferencia && !errorMsg && <p className="text-xs text-[#737373]">En una transferencia el signo no cuenta.</p>}
            {avisoRedondeo && <p className="text-xs text-alert">Redondeado a pesos: las cuentas en COP no usan centavos.</p>}
          </div>
        </div>

        {/* Campos */}
        <div className="bg-white rounded-[24px] p-4 space-y-2 border border-[#e5e5e5] shadow-[0_0_0_1px_rgba(23,23,23,0.05),0_1px_3px_rgba(0,0,0,0.1)]">
          {/* Transferencia: Desde → Hacia */}
          {enTransferencia ? (
            <div className="space-y-1">
              <div className={fila}>
                <label htmlFor="desde" className="text-sm font-medium text-[#0a0a0a]">Desde</label>
                <select id="desde" value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} className={`${selectCls} min-h-[56px]`}>
                  {cuentas.map((c) => (
                    <option key={c.id} value={c.id}>{etiquetaCuenta(c)}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-center">
                <button
                  type="button"
                  aria-label="Intercambiar cuentas"
                  onClick={() => { const o = selectedAccountId; setSelectedAccountId(destinoAccountId); setDestinoAccountId(o); }}
                  className="w-11 h-11 rounded-full bg-[#f5f5f5] border border-[#e5e5e5] text-[#0a0a0a] flex items-center justify-center active:scale-95"
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">swap_vert</span>
                </button>
              </div>
              <div className={fila}>
                <label htmlFor="hacia" className="text-sm font-medium text-[#0a0a0a]">Hacia</label>
                <select id="hacia" value={destinoAccountId} onChange={(e) => setDestinoAccountId(e.target.value)} className={`${selectCls} min-h-[56px]`}>
                  {cuentas.filter((c) => c.id !== selectedAccountId).map((c) => (
                    <option key={c.id} value={c.id}>{etiquetaCuenta(c)}</option>
                  ))}
                </select>
              </div>
              {moneda !== monedaDestino && (
                <p className="text-xs text-[#737373] px-2 pt-1">
                  1 {monedaExtranjera} = {formatMonto(tasaExtranjera, 'COP')} · {monedaExtranjera === 'USD' ? describirTrm(fx).replace(/^TRM [^·]+· /, 'TRM ') : 'BCE × TRM'}
                  {valor > 0 && <> · Llega aprox.: {formatMonto(llegaAprox, monedaDestino)}</>}
                </p>
              )}
            </div>
          ) : (
            usaCuenta && (
              <div className={fila}>
                <label htmlFor="cuenta" className="text-sm font-medium text-[#0a0a0a] whitespace-nowrap">
                  {segment === 'general'
                    ? valor > 0 ? (signo < 0 ? 'Sale de' : 'Entra a') : 'Cuenta'
                    : isNewDeuda ? (relacionDeuda === 'por_cobrar' ? 'Sale de' : 'Entra a') : tipoTxDeuda === 'ingreso' ? 'Entra a' : 'Sale de'}
                </label>
                <div className="flex items-center gap-2">
                  <select id="cuenta" value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} className={selectCls}>
                    {cuentas.map((c) => (
                      <option key={c.id} value={c.id}>{etiquetaCuenta(c)}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => setShowAddAccountModal(true)} className={iconBtn} aria-label="Nueva cuenta">
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
                  </button>
                </div>
              </div>
            )
          )}

          {/* Categoría filtrada por tipo (solo gasto o ingreso) */}
          {enMovimiento && (
            <div className={`${fila} border-t border-[#e5e5e5] pt-3`}>
              <label htmlFor="categoria" className="text-sm font-medium text-[#0a0a0a]">Categoría</label>
              <div className="flex items-center gap-2">
                {categoriasDelTipo.length > 0 ? (
                  <select id="categoria" value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value)} className={selectCls}>
                    {categoriasDelTipo.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-[#737373]">Sin categorías de {tipoCategoria}s</span>
                )}
                <button type="button" onClick={() => setShowAddCatModal(true)} className={iconBtn} aria-label="Nueva categoría">
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
                </button>
              </div>
            </div>
          )}

          {/* Metas */}
          {segment === 'metas' && (
            <div className="p-2 space-y-3 border-t border-[#e5e5e5] pt-3">
              <div className="flex gap-2">
                <button type="button" aria-pressed={!isNewMeta && operacionMeta === 'apartar'} onClick={() => { setIsNewMeta(false); setOperacionMeta('apartar'); }} className={chipBtn(!isNewMeta && operacionMeta === 'apartar')}>Apartar</button>
                <button type="button" aria-pressed={!isNewMeta && operacionMeta === 'sacar'} onClick={() => { setIsNewMeta(false); setOperacionMeta('sacar'); }} className={chipBtn(!isNewMeta && operacionMeta === 'sacar')}>Sacar</button>
                <button type="button" aria-pressed={isNewMeta} onClick={() => setIsNewMeta(true)} className={chipBtn(isNewMeta)}>Nueva meta</button>
              </div>
              {!isNewMeta ? (
                metas.length > 0 ? (
                  <>
                  <div className={fila}>
                    <label htmlFor="meta" className="text-sm font-medium text-[#0a0a0a]">¿Para cuál meta?</label>
                    <select id="meta" value={selectedMetaId} onChange={(e) => setSelectedMetaId(e.target.value)} className={selectCls}>
                      {metas.map((m) => (
                        <option key={m.id} value={m.id}>{m.nombre} ({m.porcentaje}%)</option>
                      ))}
                    </select>
                  </div>
                  {metaSel && (
                    <p className="text-xs text-[#737373] px-2 tabular-nums">
                      Llevas {privacyHidden ? '••••' : formatMonto(metaSel.monto_actual, 'COP', 'neutro')} de {privacyHidden ? '••••' : formatMonto(metaSel.monto_objetivo, 'COP', 'neutro')}
                      {' · '}Libre para apartar: {privacyHidden ? '••••' : formatMonto(Math.max(0, disponibleCOP(cuentas, metas, fx)), 'COP', 'neutro')}
                    </p>
                  )}
                  </>
                ) : (
                  <p className="text-sm text-[#737373] px-2">Aún no tienes metas. Crea la primera.</p>
                )
              ) : (
                <div className="space-y-3">
                  <div>
                    <label htmlFor="nombreMeta" className={labelCls}>Nombre</label>
                    <input id="nombreMeta" ref={nombreMetaRef} type="text" placeholder="Ej.: Colchón, Viaje a Santa Marta" value={nombreMeta} onChange={(e) => setNombreMeta(e.target.value)} className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="objetivo" className={labelCls}>¿Cuánto necesitas?</label>
                      <input
                        id="objetivo"
                        type="text"
                        inputMode="numeric"
                        value={formatEntrada(montoObjetivoMeta)}
                        onChange={(e) => setMontoObjetivoMeta(limpiarEntrada(e.target.value, false))}
                        className={`${inputCls} tabular-nums`}
                      />
                    </div>
                    <div>
                      <label htmlFor="fechaLimite" className={labelCls}>¿Para cuándo?</label>
                      <input id="fechaLimite" type="date" value={fechaLimiteMeta} onChange={(e) => setFechaLimiteMeta(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Deudas */}
          {segment === 'deudores' && (
            <div className="p-2 space-y-3 border-t border-[#e5e5e5] pt-3">
              <div className="flex gap-2">
                <button type="button" aria-pressed={!isNewDeuda} onClick={() => setIsNewDeuda(false)} className={chipBtn(!isNewDeuda)}>Abonar</button>
                <button type="button" aria-pressed={isNewDeuda} onClick={() => setIsNewDeuda(true)} className={chipBtn(isNewDeuda)}>Nueva</button>
              </div>

              {!isNewDeuda ? (
                deudasActivas.length > 0 ? (
                  <div className="space-y-3">
                    <div className={fila}>
                      <label htmlFor="deuda" className="text-sm font-medium text-[#0a0a0a]">¿Cuál deuda?</label>
                      <select id="deuda" value={selectedDeudaId} onChange={(e) => setSelectedDeudaId(e.target.value)} className={selectCls}>
                        {deudasActivas.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.contraparte} · {d.concepto} · {d.tipo === 'por_cobrar' ? 'Me debe' : 'Le debo'}
                          </option>
                        ))}
                      </select>
                    </div>
                    {deudaSel && (
                      <p className="text-xs text-[#737373] px-2 tabular-nums">
                        Pendiente: {privacyHidden ? '••••' : formatMonto(pendienteDeuda(deudaSel), deudaSel.moneda || 'COP', 'neutro')}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button type="button" aria-pressed={operacionDeuda === 'abono'} onClick={() => setOperacionDeuda('abono')} className={chipBtn(operacionDeuda === 'abono')}>{etiquetaOp('abono')}</button>
                      <button type="button" aria-pressed={operacionDeuda === 'incremento'} onClick={() => setOperacionDeuda('incremento')} className={chipBtn(operacionDeuda === 'incremento')}>{etiquetaOp('incremento')}</button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-[#737373] px-2">No tienes deudas activas. Anota una en "Nueva".</p>
                )
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button type="button" aria-pressed={relacionDeuda === 'por_cobrar'} onClick={() => setRelacionDeuda('por_cobrar')} className={chipBtn(relacionDeuda === 'por_cobrar')}>Me deben</button>
                    <button type="button" aria-pressed={relacionDeuda === 'por_pagar'} onClick={() => setRelacionDeuda('por_pagar')} className={chipBtn(relacionDeuda === 'por_pagar')}>Yo debo</button>
                  </div>
                  <div>
                    <span className={labelCls}>¿Movió plata?</span>
                    <div className="flex gap-2">
                      <button type="button" aria-pressed={movioPlata} onClick={() => setMovioPlata(true)} className={chipBtn(movioPlata)}>
                        {relacionDeuda === 'por_cobrar' ? 'Sí, le presté' : 'Sí, me prestaron'}
                      </button>
                      <button type="button" aria-pressed={!movioPlata} onClick={() => setMovioPlata(false)} className={chipBtn(!movioPlata)}>Ya existía</button>
                    </div>
                  </div>
                  <div>
                    {contrapartesAgenda.length > 0 && (
                      <>
                        <span className={labelCls}>Recientes</span>
                        <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-2">
                          {contrapartesAgenda.map((p) => (
                            <button key={p} type="button" onClick={() => setPersonaDeuda(p)} className="px-3 min-h-[44px] rounded-full bg-[#f5f5f5] hover:bg-[#e5e5e5] text-xs text-[#0a0a0a] font-medium whitespace-nowrap border border-[#e5e5e5]">
                              {p}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    <label htmlFor="persona" className={labelCls}>¿Quién?</label>
                    <input id="persona" ref={personaRef} type="text" placeholder="Ej.: Andrés, Bancolombia" value={personaDeuda} onChange={(e) => setPersonaDeuda(e.target.value)} className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="concepto" className={labelCls}>Concepto</label>
                      <select id="concepto" value={conceptoDeuda} onChange={(e) => setConceptoDeuda(e.target.value)} className={inputCls}>
                        <option value="Préstamo">Préstamo</option>
                        <option value="Cena">Cena o salida</option>
                        <option value="Boleta">Boleta o evento</option>
                        <option value="Factura">Factura o servicio</option>
                        <option value="Tarjeta">Tarjeta de crédito</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="vence" className={labelCls}>Vence</label>
                      <input id="vence" type="date" value={fechaVencimientoDeuda} onChange={(e) => setFechaVencimientoDeuda(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  {!movioPlata && <div>
                    <label htmlFor="monedaDeuda" className={labelCls}>Moneda</label>
                    <select id="monedaDeuda" value={monedaDeuda} onChange={(e) => setMonedaDeuda(e.target.value as 'COP' | 'USD' | 'EUR')} className={inputCls}>
                      <option value="COP">Pesos (COP)</option>
                      <option value="USD">Dólares (USD)</option>
                      <option value="EUR">Euros (EUR)</option>
                    </select>
                    <p className="text-xs text-[#737373] mt-1">Si abonas desde una cuenta en otra moneda, la conversión es automática.</p>
                  </div>}
                </div>
              )}
            </div>
          )}

          {/* Detalle y nota (solo movimientos y transferencias) */}
          {segment === 'general' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 border-t border-[#e5e5e5] pt-3">
              <div>
                <label htmlFor="detalle" className={labelCls}>Detalle</label>
                <input id="detalle" type="text" placeholder="Ej.: almuerzo, Uber" value={subcategoria} onChange={(e) => setSubcategoria(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="nota" className={labelCls}>Nota (opcional)</label>
                <input id="nota" type="text" value={notas} onChange={(e) => setNotas(e.target.value)} className={inputCls} />
              </div>
            </div>
          )}

          {/* Fecha y hora (no aplica al crear meta o deuda) */}
          {usaCuenta && (
            <div className={`${fila} border-t border-[#e5e5e5] pt-3`}>
              <label htmlFor="fecha" className="text-sm font-medium text-[#0a0a0a] whitespace-nowrap">Fecha y hora</label>
              <input id="fecha" type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} className={`${selectCls} max-w-none`} />
            </div>
          )}
        </div>

        {/* Atajos (solo gasto o ingreso) */}
        {enMovimiento && (
          <div className="space-y-2 pt-1">
            <div className="flex justify-between items-center px-1">
              <span className="text-xs text-[#737373] font-medium">Tus atajos</span>
              <button type="button" onClick={() => setShowAddQuickModal(true)} className="text-sm text-[#0a0a0a] font-medium min-h-[44px] px-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">add</span>
                Nuevo atajo
              </button>
            </div>
            {categoriasRapidas.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {categoriasRapidas.map((rap) => (
                  <button
                    key={rap.id}
                    type="button"
                    onClick={() => handleSelectQuickCategory(rap)}
                    className="flex items-center gap-2 px-3 min-h-[44px] rounded-[14px] bg-white border border-[#e5e5e5] hover:bg-[#fafafa] text-xs whitespace-nowrap active:scale-95 transition-all text-[#0a0a0a] shrink-0"
                  >
                    <span className="material-symbols-outlined text-[16px] text-[#737373]" aria-hidden="true">{rap.icono}</span>
                    <span className="text-left">
                      <span className="font-medium text-[12px] block">{rap.nombre}</span>
                      <span className="text-[11px] text-[#737373] block">{rap.subcategoria}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#737373] px-1">Guarda lo que anotas seguido: el bus a la U, el tinto.</p>
            )}
          </div>
        )}

        {/* Botón final fijo encima de la barra inferior */}
        <div className="sticky z-30" style={{ bottom: 'calc(68px + 8px + env(safe-area-inset-bottom))' }}>
          <button
            type="submit"
            className={`w-full min-h-[52px] rounded-[18px] font-semibold text-sm active:scale-[0.99] transition-all truncate px-4 ${
              valor > 0 ? 'bg-[#0a0a0a] text-[#fafafa] shadow-sm' : 'bg-[#fafafa] text-[#0a0a0a] border border-[#e5e5e5]'
            }`}
          >
            {textoBoton}
          </button>
        </div>
      </form>

      {/* Modal: nueva categoría (hereda el tipo del signo) */}
      {showAddCatModal && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-cat">
          <div className="bg-white border border-[#e5e5e5] p-6 rounded-[24px] w-full max-w-sm space-y-4 shadow-xl">
            <div className="flex justify-between items-center">
              <h3 id="titulo-cat" className="text-sm font-semibold text-[#0a0a0a]">Nueva categoría de {tipoCategoria}s</h3>
              <button onClick={() => setShowAddCatModal(false)} aria-label="Cerrar" className="w-11 h-11 flex items-center justify-center text-[#737373] hover:text-[#0a0a0a]">✕</button>
            </div>
            <form onSubmit={handleCreateCategory} className="space-y-3">
              <div>
                <label htmlFor="catNombre" className={labelCls}>Nombre</label>
                <input id="catNombre" type="text" placeholder="Ej.: Mascotas, Suscripciones" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} className={inputCls} required />
              </div>
              <div>
                <label htmlFor="catGrupo" className={labelCls}>Grupo</label>
                <select id="catGrupo" value={newCatSuper} onChange={(e) => setNewCatSuper(e.target.value)} className={inputCls}>
                  <option value="Gastos Diarios">Gastos diarios</option>
                  <option value="Servicios & Movilidad">Servicios y movilidad</option>
                  <option value="Estilo de Vida">Estilo de vida</option>
                  <option value="Gastos Fijos">Gastos fijos</option>
                  <option value="Ingresos">Ingresos</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddCatModal(false)} className="px-4 min-h-[44px] text-sm text-[#737373] hover:text-[#0a0a0a] rounded-[14px]">Cancelar</button>
                <button type="submit" className="bg-[#0a0a0a] text-[#fafafa] px-4 min-h-[44px] rounded-[14px] text-sm font-medium">Crear</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: nuevo atajo */}
      {showAddQuickModal && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-atajo">
          <div className="bg-white border border-[#e5e5e5] p-6 rounded-[24px] w-full max-w-sm space-y-4 shadow-xl">
            <div className="flex justify-between items-center">
              <h3 id="titulo-atajo" className="text-sm font-semibold text-[#0a0a0a]">Nuevo atajo</h3>
              <button onClick={() => setShowAddQuickModal(false)} aria-label="Cerrar" className="w-11 h-11 flex items-center justify-center text-[#737373] hover:text-[#0a0a0a]">✕</button>
            </div>
            <form onSubmit={handleCreateQuickCategory} className="space-y-3">
              <div>
                <label htmlFor="atajoNombre" className={labelCls}>Nombre</label>
                <input id="atajoNombre" type="text" placeholder="Ej.: Bus a la U" value={quickNombre} onChange={(e) => setQuickNombre(e.target.value)} className={inputCls} required />
              </div>
              <div>
                <label htmlFor="atajoCat" className={labelCls}>Categoría</label>
                <select id="atajoCat" value={quickCatId} onChange={(e) => setQuickCatId(e.target.value)} className={inputCls}>
                  {categorias.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.nombre} ({cat.tipo})</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="atajoDetalle" className={labelCls}>Detalle</label>
                <input id="atajoDetalle" type="text" placeholder="Ej.: transporte público" value={quickSubcat} onChange={(e) => setQuickSubcat(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="atajoNota" className={labelCls}>Nota</label>
                <input id="atajoNota" type="text" placeholder="Ej.: pasaje diario" value={quickNota} onChange={(e) => setQuickNota(e.target.value)} className={inputCls} />
              </div>
              <p className="text-xs text-[#737373]">Se guarda en este navegador.</p>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowAddQuickModal(false)} className="px-4 min-h-[44px] text-sm text-[#737373] hover:text-[#0a0a0a] rounded-[14px]">Cancelar</button>
                <button type="submit" className="bg-[#0a0a0a] text-[#fafafa] px-4 min-h-[44px] rounded-[14px] text-sm font-medium">Crear atajo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: nueva cuenta */}
      {showAddAccountModal && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-cuenta">
          <div className="bg-white border border-[#e5e5e5] p-6 rounded-[24px] w-full max-w-sm space-y-4 shadow-xl">
            <div className="flex justify-between items-center">
              <h3 id="titulo-cuenta" className="text-sm font-semibold text-[#0a0a0a]">Nueva cuenta</h3>
              <button onClick={() => setShowAddAccountModal(false)} aria-label="Cerrar" className="w-11 h-11 flex items-center justify-center text-[#737373] hover:text-[#0a0a0a]">✕</button>
            </div>
            <form onSubmit={handleCreateAccount} className="space-y-3">
              <div>
                <label htmlFor="cuentaNombre" className={labelCls}>Nombre</label>
                <input id="cuentaNombre" type="text" placeholder="Ej.: Bancolombia, Nu, Nequi" value={accName} onChange={(e) => setAccName(e.target.value)} className={inputCls} required />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="cuentaTipo" className={labelCls}>Tipo</label>
                  <select id="cuentaTipo" value={accType} onChange={(e) => setAccType(e.target.value as typeof accType)} className={inputCls}>
                    <option value="ahorro">Ahorro</option>
                    <option value="corriente">Corriente</option>
                    <option value="bolsillo">Bolsillo</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="tarjeta">Tarjeta de crédito</option>
                    <option value="broker">Inversión</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="cuentaMoneda" className={labelCls}>Moneda</label>
                  <select id="cuentaMoneda" value={accCurrency} onChange={(e) => setAccCurrency(e.target.value)} className={inputCls}>
                    <option value="COP">COP</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="cuentaSaldo" className={labelCls}>¿Cuánta plata tiene hoy?</label>
                <input
                  id="cuentaSaldo"
                  type="text"
                  inputMode={accCurrency === 'COP' ? 'numeric' : 'decimal'}
                  placeholder="Ej.: 150.000"
                  value={formatEntrada(accBalance)}
                  onChange={(e) => setAccBalance(limpiarEntrada(e.target.value, accCurrency !== 'COP'))}
                  className={`${inputCls} tabular-nums`}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddAccountModal(false)} className="px-4 min-h-[44px] text-sm text-[#737373] hover:text-[#0a0a0a] rounded-[14px]">Cancelar</button>
                <button type="submit" className="bg-[#0a0a0a] text-[#fafafa] px-4 min-h-[44px] rounded-[14px] text-sm font-medium">Crear cuenta</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
