import { create } from 'zustand';
import {
  Cuenta,
  Categoria,
  CategoriaRapida,
  Transaccion,
  Deuda,
  Meta,
  ActiveTab,
  UserProfile,
  PendingUndoItem,
  AppTheme,
} from '../types';
import {
  executeTransactionBatch,
  softDeleteEntity,
  persistToEmergencyQueue,
  removeFromEmergencyQueue,
  fetchAllData,
  insertAccount,
  insertCategory,
  insertGoal,
  insertDebt,
  seedDefaultsIfEmpty,
  ajustarSaldo,
  setUsuarioCola,
  recoverPendingTransactions,
  esRechazoDefinitivo,
  esYaGuardado,
} from '../services/financeService';
import { fetchFx, cachedFx, FxRates } from '../services/currency';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { calcularEfecto, aplicarEfecto, errorDesdeServidor, mensajeError, type ErrorDinero } from '../utils/reglas';

export interface AvisoSync {
  id: string;
  tipo: 'guardado' | 'deshecho' | 'error' | 'sin_red';
  transaccion?: Transaccion;
  mensaje?: string; // explicación concreta del rechazo (Fase 3)
}

/** Resultado de anotar: id si quedó pendiente de guardar, o el error con su mensaje (no se aplicó nada). */
export interface ResultadoAnotar { id?: string; error?: ErrorDinero }

/** Registro abierto desde otro módulo con la meta o deuda ya elegida (un solo canal para anotar, D-037). */
export interface PrefillRegistro {
  segment: 'general' | 'metas' | 'deudores';
  metaId?: string;
  operacionMeta?: 'apartar' | 'sacar';
  nuevaMeta?: boolean;
  deudaId?: string;
  operacionDeuda?: 'abono' | 'incremento';
  nuevaDeuda?: boolean;
}

/** Crear deuda (D-035): con movimiento de plata (por defecto) o "ya existía". */
export interface MovimientoDeuda { cuenta_id: string; monto: number; notas?: string }

const uid = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

interface CalculatorState {
  displayValue: string;
  previousValue: string | null;
  operation: string | null;
  waitingForNewOperand: boolean;
  selectedAccountId: string;
  selectedCategoryId: string;
  aviso?: string; // [E13] mensaje breve de la calculadora (p. ej. división entre 0)
}

interface FinanceStore {
  // Navigation & UI state
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  prefillRegistro: PrefillRegistro | null;
  abrirRegistro: (prefill: PrefillRegistro) => void;
  consumirPrefill: () => PrefillRegistro | null;
  privacyHidden: boolean;
  togglePrivacy: () => void;
  appTheme: AppTheme;
  setAppTheme: (theme: AppTheme) => void;

  // Perfil y sesión (Firebase Auth)
  userProfile: UserProfile;
  isAuthenticated: boolean;
  setSessionUser: (user: { id: string; email: string; nombre?: string; avatar_url?: string } | null) => void;
  hydrateFromServidor: () => Promise<void>;

  // Divisas (moneda base COP, tasa automática)
  fx: FxRates;
  refreshFx: () => Promise<void>;

  // Entities Data
  cuentas: Cuenta[];
  categorias: Categoria[];
  categoriasRapidas: CategoriaRapida[];
  transacciones: Transaccion[];
  deudas: Deuda[];
  metas: Meta[];

  // Pending Undo Queue for Optimistic UI (5 Seconds Rule)
  pendingUndoList: PendingUndoItem[];

  // Avisos visibles del resultado de guardar (iteración Registro 2026-11-17)
  avisos: AvisoSync[];
  cerrarAviso: (id: string) => void;

  // Calculator State
  calculator: CalculatorState;
  inputDigit: (digit: string) => void;
  performOperation: (nextOperation: string) => void;
  clearCalculator: () => void;
  backspaceCalculator: () => void;
  inputPercent: () => void;
  setCalculatorAccount: (accountId: string) => void;
  setCalculatorCategory: (categoryId: string) => void;

  // Domain Actions
  addCategoria: (cat: Omit<Categoria, 'id'>) => void;
  addCategoriaRapida: (rapida: Omit<CategoriaRapida, 'id'>) => void;
  addTransaccion: (transaccion: Omit<Transaccion, 'id' | 'user_id'>) => ResultadoAnotar;
  addTransaccionOptimistic: (transaccion: Omit<Transaccion, 'id' | 'user_id'>, extra?: { deudaCreadaId?: string }) => ResultadoAnotar;
  undoPendingTransaccion: (pendingId: string) => void;
  commitPendingTransaccion: (pendingId: string) => Promise<void>;

  addCuenta: (cuenta: Omit<Cuenta, 'id' | 'user_id'>) => void;
  /** Ajuste de saldo (E37): el servidor crea un movimiento 'ajuste' con la diferencia. */
  ajustarSaldoCuenta: (id: string, nuevoSaldo: number, notas?: string) => Promise<{ diferencia: number } | { error: string }>;
  cerrarSesion: () => Promise<void>;
  softDeleteCuenta: (id: string) => void;

  addDeuda: (deuda: Omit<Deuda, 'id' | 'user_id'>, movimiento?: MovimientoDeuda) => Promise<ResultadoAnotar>;
  softDeleteDeuda: (id: string) => void;

  addMeta: (meta: Omit<Meta, 'id' | 'user_id' | 'monto_actual' | 'porcentaje'>) => string;
  softDeleteMeta: (id: string) => void;
  softDeleteCategoria: (id: string) => void;
}

// [N6] Sin id hasta que hay sesión: ninguna recarga ni semilla corre para un usuario ficticio.
const INITIAL_USER: UserProfile = {
  id: '',
  email: 'usuario@wealthflow.app',
  nombre: 'Alexander V.',
  moneda_principal: 'COP',
  avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
};

const INITIAL_CUENTAS: Cuenta[] = [
  {
    id: 'c_1',
    user_id: 'user_1',
    nombre: 'Ahorros Principal',
    tipo: 'ahorro',
    moneda: 'COP',
    saldo_actual: 12050000,
    mascara: '**** 4589',
    color_badge: '#facc15',
    is_active: true,
  },
  {
    id: 'c_2',
    user_id: 'user_1',
    nombre: 'Bolsillo Gastos',
    tipo: 'bolsillo',
    moneda: 'COP',
    saldo_actual: 1400000,
    mascara: '**** 9901',
    color_badge: '#ec4899',
    is_active: true,
  },
  {
    id: 'c_3',
    user_id: 'user_1',
    nombre: 'Inversión USD',
    tipo: 'broker',
    moneda: 'USD',
    saldo_actual: 1250,
    mascara: 'Interactive Brokers',
    color_badge: '#3e90ff',
    is_active: true,
  },
  {
    id: 'c_4',
    user_id: 'user_1',
    nombre: 'Efectivo',
    tipo: 'efectivo',
    moneda: 'COP',
    saldo_actual: 450000,
    mascara: 'Billetera',
    color_badge: '#09bf49',
    is_active: true,
  },
];

const INITIAL_CATEGORIAS: Categoria[] = [
  { id: 'cat_1', nombre: 'Comida', supercategoria: 'Gastos Diarios', tipo: 'gasto', icono: 'restaurant', is_active: true },
  { id: 'cat_2', nombre: 'Transporte', supercategoria: 'Servicios & Movilidad', tipo: 'gasto', icono: 'directions_bus', is_active: true },
  { id: 'cat_3', nombre: 'Vivienda', supercategoria: 'Gastos Fijos', tipo: 'gasto', icono: 'home', is_active: true },
  { id: 'cat_4', nombre: 'Ocio', supercategoria: 'Estilo de Vida', tipo: 'gasto', icono: 'person', is_active: true },
  { id: 'cat_5', nombre: 'Salario', supercategoria: 'Ingresos', tipo: 'ingreso', icono: 'payments', is_active: true },
  { id: 'cat_6', nombre: 'Inversión', supercategoria: 'Patrimonio', tipo: 'ingreso', icono: 'trending_up', is_active: true },
];

const INITIAL_METAS: Meta[] = [
  {
    id: 'm_1',
    user_id: 'user_1',
    nombre: 'Fondo Emergencia',
    monto_objetivo: 15000000,
    monto_actual: 12000000,
    porcentaje: 80,
    color: '#3e90ff',
    fecha_limite: '2026-12-31',
    is_active: true,
  },
  {
    id: 'm_2',
    user_id: 'user_1',
    nombre: 'Inversiones',
    monto_objetivo: 10000000,
    monto_actual: 5000000,
    porcentaje: 50,
    color: '#09bf49',
    fecha_limite: '2026-10-15',
    is_active: true,
  },
  {
    id: 'm_3',
    user_id: 'user_1',
    nombre: 'Viaje Japón',
    monto_objetivo: 20000000,
    monto_actual: 9000000,
    porcentaje: 45,
    color: '#c863fb',
    fecha_limite: '2026-11-30',
    is_active: true,
  },
];

const INITIAL_DEUDAS: Deuda[] = [
  {
    id: 'd_1',
    user_id: 'user_1',
    contraparte: 'Carlos D.',
    concepto: 'Préstamo personal',
    tipo: 'por_cobrar',
    monto_total: 500000,
    monto_pagado: 0,
    estado: 'activa',
    fecha_vencimiento: '2026-09-30',
    is_active: true,
  },
  {
    id: 'd_2',
    user_id: 'user_1',
    contraparte: 'María R.',
    concepto: 'Cena Jueves',
    tipo: 'por_cobrar',
    monto_total: 700000,
    monto_pagado: 0,
    estado: 'activa',
    fecha_vencimiento: '2026-08-31',
    is_active: true,
  },
  {
    id: 'd_3',
    user_id: 'user_1',
    contraparte: 'MacBook Pro M3',
    concepto: 'Financiamiento 12 cuotas',
    tipo: 'por_pagar',
    monto_total: 8000000,
    monto_pagado: 5000000,
    estado: 'activa',
    detalles_pago: 'Cuota 8/12 • Amortizado 62%',
    fecha_vencimiento: '2026-12-15',
    is_active: true,
  },
];

const INITIAL_TRANSACCIONES: Transaccion[] = [
  {
    id: 'tx_1',
    user_id: 'user_1',
    cuenta_id: 'c_2',
    categoria_id: 'cat_1',
    monto: 12500,
    tipo: 'gasto',
    fecha: new Date().toISOString(),
    fecha_local_str: new Date().toISOString().slice(0, 10),
    notas: 'Almuerzo Ejecutivo',
    cuenta_nombre: 'Bolsillo Gastos',
    categoria_nombre: 'Comida',
    supercategoria: 'Gastos Diarios',
    is_active: true,
  },
];

// [E32] Sin atajos de ejemplo: cada persona crea los suyos.
const INITIAL_CATEGORIAS_RAPIDAS: CategoriaRapida[] = [];

// [E23] Los atajos se guardan en este navegador, por usuario (no hay tabla en el servidor).
const claveAtajos = (userId: string) => `LUMI_ATAJOS:${userId}`;
const leerAtajos = (userId: string): CategoriaRapida[] => {
  try { return JSON.parse(localStorage.getItem(claveAtajos(userId)) || '[]'); } catch { return []; }
};
const guardarAtajos = (userId: string, atajos: CategoriaRapida[]) => {
  try { localStorage.setItem(claveAtajos(userId), JSON.stringify(atajos)); } catch { /* sin almacenamiento */ }
};

const getInitialTheme = (): AppTheme => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('WEALTHFLOW_APP_THEME') as AppTheme;
    if (saved && ['blueprint', 'twitch', 'mercury', 'netflix'].includes(saved)) {
      document.documentElement.setAttribute('data-theme', saved);
      return saved;
    }
    document.documentElement.setAttribute('data-theme', 'blueprint');
  }
  return 'blueprint';
};

// [N2] Envíos en curso por id: una segunda llamada recibe la misma promesa (nunca se envía dos veces).
const enVuelo = new Map<string, Promise<void>>();
// [N7] Contador de recargas: solo se aplica el resultado de la más reciente.
let generacionRecarga = 0;

// [E33] Si el servidor no crea la entidad, se quita de la pantalla y se avisa.
const avisoCreacion = (get: () => FinanceStore, set: (fn: (s: FinanceStore) => Partial<FinanceStore>) => void, que: string) => {
  set((s) => ({ avisos: [...s.avisos, { id: uid(), tipo: 'error' as const, mensaje: `No se pudo crear ${que}. Revisa tu conexión e intenta otra vez.` }] }));
  void get;
};

export const useFinanceStore = create<FinanceStore>((set, get) => ({
  activeTab: 'calculator',
  setActiveTab: (tab) => set({ activeTab: tab }),
  prefillRegistro: null,
  abrirRegistro: (prefill) => set({ prefillRegistro: prefill, activeTab: 'register' }),
  consumirPrefill: () => {
    const p = get().prefillRegistro;
    if (p) set({ prefillRegistro: null });
    return p;
  },

  privacyHidden: false,
  togglePrivacy: () => set((state) => ({ privacyHidden: !state.privacyHidden })),

  appTheme: getInitialTheme(),
  setAppTheme: (theme: AppTheme) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('WEALTHFLOW_APP_THEME', theme);
      document.documentElement.setAttribute('data-theme', theme);
    }
    set({ appTheme: theme });
  },

  userProfile: INITIAL_USER,
  isAuthenticated: false,

  fx: cachedFx(),
  refreshFx: async () => {
    const fx = await fetchFx();
    set({ fx });
  },

  setSessionUser: (user) => {
    if (!user) {
      // [E38] Limpieza completa: temporizadores, avisos, atajos y calculadora del usuario anterior.
      get().pendingUndoList.forEach((p) => clearTimeout(p.timerId));
      setUsuarioCola('');
      set((s) => ({
        isAuthenticated: false, userProfile: INITIAL_USER, cuentas: [], categorias: [], metas: [], deudas: [], transacciones: [],
        pendingUndoList: [], avisos: [], categoriasRapidas: [],
        calculator: { ...s.calculator, displayValue: '0', previousValue: null, operation: null, waitingForNewOperand: false, selectedAccountId: '', selectedCategoryId: '' },
      }));
      return;
    }
    setUsuarioCola(user.id);
    set({ categoriasRapidas: leerAtajos(user.id) });
    set({
      isAuthenticated: true,
      userProfile: {
        id: user.id,
        email: user.email,
        nombre: user.nombre || user.email,
        moneda_principal: 'COP',
        avatar_url: user.avatar_url,
      },
    });
  },

  hydrateFromServidor: async () => {
    const { userProfile } = get();
    if (!userProfile?.id) return;
    const generacion = ++generacionRecarga;
    try {
      await seedDefaultsIfEmpty(userProfile.id);
      const data = await fetchAllData();
      if (generacion !== generacionRecarga || get().userProfile.id !== userProfile.id) return; // [N7] llegó una recarga más nueva
      // [E1] Los IDs de la semilla local ('c_2', 'cat_1'...) no existen en el servidor.
      // Se reemplazan por IDs reales para que el servidor no rechace la transacción.
      const existeCuenta = (id: string) => data.cuentas.some((c) => c.id === id);
      const existeCategoria = (id: string) => data.categorias.some((c) => c.id === id);
      const primeraCuenta = data.cuentas[0]?.id || '';
      const primeraCategoria = data.categorias.find((c) => c.tipo === 'gasto')?.id || data.categorias[0]?.id || '';
      const nombreSemilla = (id: string) => INITIAL_CATEGORIAS.find((c) => c.id === id)?.nombre;
      set((s) => {
        // [E40] Los movimientos que aún esperan sus 5 s no están en la base: se vuelven a aplicar encima.
        let base = { cuentas: data.cuentas, metas: data.metas, deudas: data.deudas };
        // [N7] Solo los que el servidor aún NO tiene (si ya lo tiene, su efecto ya viene en los saldos)
        for (const p of s.pendingUndoList) if (p.efecto && !data.transacciones.some((x) => x.id === p.id)) base = aplicarEfecto(base, p.efecto, 1);
        const pendientes = s.pendingUndoList.map((p) => p.transaccion).filter((t) => !data.transacciones.some((x) => x.id === t.id));
        return {
        cuentas: base.cuentas,
        categorias: data.categorias,
        metas: base.metas,
        deudas: base.deudas,
        transacciones: [...pendientes, ...data.transacciones],
        calculator: {
          ...s.calculator,
          selectedAccountId: existeCuenta(s.calculator.selectedAccountId) ? s.calculator.selectedAccountId : primeraCuenta,
          selectedCategoryId: existeCategoria(s.calculator.selectedCategoryId) ? s.calculator.selectedCategoryId : primeraCategoria,
        },
        // Atajos rápidos: se re-enlazan a la categoría real con el mismo nombre, o se descartan.
        categoriasRapidas: s.categoriasRapidas.flatMap((r) => {
          if (existeCategoria(r.categoria_id)) return [r];
          const nombre = nombreSemilla(r.categoria_id);
          const real = nombre ? data.categorias.find((c) => c.nombre === nombre) : undefined;
          return real ? [{ ...r, categoria_id: real.id }] : [];
        }),
        };
      });
    } catch (e: any) {
      console.error('[Store] Error hidratando desde el servidor:', e);
      // [E41] Aviso visible en vez de pantalla vacía en silencio.
      set((s) => ({ avisos: [...s.avisos, { id: uid(), tipo: 'sin_red' as const, mensaje: 'No pudimos cargar tus datos. Revisa tu conexión y vuelve a entrar.' }] }));
    }
  },

  // [N6] La app nunca muestra datos de demostración: empieza vacía y se llena desde el servidor.
  cuentas: [],
  categorias: [],
  categoriasRapidas: INITIAL_CATEGORIAS_RAPIDAS,
  transacciones: [],
  deudas: [],
  metas: [],
  pendingUndoList: [],

  avisos: [],
  cerrarAviso: (id) => set((s) => ({ avisos: s.avisos.filter((a) => a.id !== id) })),

  calculator: {
    displayValue: '0',
    previousValue: null,
    operation: null,
    waitingForNewOperand: false,
    selectedAccountId: '',
    selectedCategoryId: '',
  },

  inputDigit: (digit) =>
    set((state) => {
      if (state.calculator.aviso) state = { ...state, calculator: { ...state.calculator, aviso: undefined } };
      const { displayValue, waitingForNewOperand } = state.calculator;
      if (waitingForNewOperand) {
        return {
          calculator: {
            ...state.calculator,
            displayValue: digit === '.' ? '0.' : digit,
            waitingForNewOperand: false,
          },
        };
      }
      if (digit === '.' && displayValue.includes('.')) {
        return state;
      }
      const newDisplay = displayValue === '0' && digit !== '.' ? digit : displayValue + digit;
      // [E13] Máximo 12 dígitos enteros y 2 decimales
      const [ent, dec] = newDisplay.replace('-', '').split('.');
      if (ent.length > 12 || (dec && dec.length > 2)) return state;
      return {
        calculator: {
          ...state.calculator,
          displayValue: newDisplay,
        },
      };
    }),

  performOperation: (nextOperation) =>
    set((state) => {
      const { displayValue, previousValue, operation } = state.calculator;
      const inputValue = parseFloat(displayValue);

      if (previousValue == null) {
        return {
          calculator: {
            ...state.calculator,
            previousValue: displayValue,
            operation: nextOperation,
            waitingForNewOperand: true,
          },
        };
      }

      if (operation) {
        const prevValue = parseFloat(previousValue);
        let newValue = prevValue;

        switch (operation) {
          case '+':
            newValue = prevValue + inputValue;
            break;
          case '-':
            newValue = prevValue - inputValue;
            break;
          case '×':
          case '*':
            newValue = prevValue * inputValue;
            break;
          case '÷':
          case '/':
            if (inputValue === 0) {
              // [E13] No se divide entre 0: se avisa y se conserva la operación
              return { calculator: { ...state.calculator, aviso: 'No se puede dividir entre 0' } };
            }
            newValue = prevValue / inputValue;
            break;
          default:
            break;
        }

        const formatted = Number.isInteger(newValue) ? String(newValue) : newValue.toFixed(2);

        return {
          calculator: {
            ...state.calculator,
            displayValue: formatted,
            previousValue: nextOperation === '=' ? null : formatted,
            operation: nextOperation === '=' ? null : nextOperation,
            waitingForNewOperand: true,
          },
        };
      }

      return {
        calculator: {
          ...state.calculator,
          operation: nextOperation,
          waitingForNewOperand: true,
        },
      };
    }),

  clearCalculator: () =>
    set((state) => ({
      calculator: {
        ...state.calculator,
        displayValue: '0',
        previousValue: null,
        operation: null,
        waitingForNewOperand: false,
      },
    })),

  backspaceCalculator: () =>
    set((state) => {
      const { displayValue, waitingForNewOperand } = state.calculator;
      if (waitingForNewOperand || displayValue.length <= 1 || (displayValue.length === 2 && displayValue.startsWith('-'))) {
        return {
          calculator: {
            ...state.calculator,
            displayValue: '0',
            waitingForNewOperand: false,
          },
        };
      }
      return {
        calculator: {
          ...state.calculator,
          displayValue: displayValue.slice(0, -1),
        },
      };
    }),


  inputPercent: () =>
    set((state) => {
      const val = parseFloat(state.calculator.displayValue);
      return {
        calculator: {
          ...state.calculator,
          displayValue: String(val / 100),
        },
      };
    }),

  setCalculatorAccount: (accountId) =>
    set((state) => ({
      calculator: { ...state.calculator, selectedAccountId: accountId },
    })),

  setCalculatorCategory: (categoryId) =>
    set((state) => ({
      calculator: { ...state.calculator, selectedCategoryId: categoryId },
    })),

  addCategoria: (catData) => {
    const userId = get().userProfile.id;
    const newCat: Categoria = { ...catData, id: uid(), is_active: true };
    set((state) => ({ categorias: [...state.categorias, newCat] }));
    insertCategory({
      id: newCat.id, user_id: userId, nombre: newCat.nombre, supercategoria: newCat.supercategoria,
      tipo: newCat.tipo, icono: newCat.icono,
    } as any).catch((e) => {
      console.error('[Servidor] insertCategory:', e.message);
      set((s) => ({ categorias: s.categorias.filter((c) => c.id !== newCat.id) }));
      avisoCreacion(get, set, 'la categoría');
    });
  },

  addCategoriaRapida: (rapidaData) => {
    const newRapida: CategoriaRapida = {
      ...rapidaData,
      id: 'rap_' + Date.now(),
      is_active: true,
    };
    set((state) => ({ categoriasRapidas: [...state.categoriasRapidas, newRapida] }));
    guardarAtajos(get().userProfile.id, get().categoriasRapidas);
  },

  addTransaccion: (txData) => get().addTransaccionOptimistic(txData),

  /**
   * Anotar con 5 s para deshacer. Valida con las MISMAS reglas que el servidor (utils/reglas.ts):
   * si no pasa, no se aplica nada y se devuelve el error con su mensaje.
   */
  addTransaccionOptimistic: (txData, extra) => {
    const state = get();
    const resultado = calcularEfecto(txData, state);
    if ('error' in resultado) return { error: resultado.error };
    const efecto = resultado.efecto;
    const newId = uid();

    const cuentaObj = state.cuentas.find((c) => c.id === txData.cuenta_id);
    const conCategoria = txData.tipo === 'ingreso' || txData.tipo === 'gasto';
    const catObj = conCategoria ? state.categorias.find((c) => c.id === txData.categoria_id) : undefined;
    const dateObj = new Date(txData.fecha || Date.now());
    // [E30] Día local de Colombia, no UTC.
    const fechaLocalStr = txData.fecha_local_str || dateObj.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

    const fullTx: Transaccion = {
      ...txData,
      id: newId,
      user_id: state.userProfile.id,
      moneda: cuentaObj?.moneda || 'COP',
      categoria_id: conCategoria ? txData.categoria_id : '',
      fecha: txData.fecha || dateObj.toISOString(),
      fecha_local_str: fechaLocalStr,
      cuenta_nombre: cuentaObj?.nombre || (txData.meta_id ? 'Meta' : 'Cuenta'),
      // [E31] Sin nombres de categoría falsos en movimientos sin categoría.
      categoria_nombre: catObj?.nombre,
      supercategoria: catObj?.supercategoria,
      origen: txData.origen || 'manual',
      monto_aplicado: efecto.aplicado,
      is_active: true,
      is_pending_undo: true,
    };

    const nuevo = aplicarEfecto(state, efecto, 1);
    const timerId = setTimeout(() => { get().commitPendingTransaccion(newId); }, 5000);
    const pendingItem: PendingUndoItem = { id: newId, transaccion: fullTx, efecto, deudaCreadaId: extra?.deudaCreadaId, timerId, secondsLeft: 5 };

    persistToEmergencyQueue(fullTx);
    set((s) => ({
      transacciones: [fullTx, ...s.transacciones],
      cuentas: nuevo.cuentas,
      metas: nuevo.metas,
      deudas: nuevo.deudas,
      pendingUndoList: [...s.pendingUndoList, pendingItem],
    }));
    return { id: newId };
  },

  /** Deshacer: aplica el efecto INVERSO solo de este movimiento (E10: ya no restaura una foto de todo). */
  undoPendingTransaccion: (pendingId) => {
    const state = get();
    const pendingItem = state.pendingUndoList.find((p) => p.id === pendingId);
    if (!pendingItem || pendingItem.enviando) return; // [N1] ya va hacia el servidor: no se puede deshacer
    clearTimeout(pendingItem.timerId);
    removeFromEmergencyQueue(pendingId);

    const revertido = pendingItem.efecto ? aplicarEfecto(state, pendingItem.efecto, -1) : state;
    set({
      transacciones: state.transacciones.filter((t) => t.id !== pendingId),
      cuentas: revertido.cuentas,
      metas: revertido.metas,
      deudas: pendingItem.deudaCreadaId ? revertido.deudas.filter((d) => d.id !== pendingItem.deudaCreadaId) : revertido.deudas,
      pendingUndoList: state.pendingUndoList.filter((p) => p.id !== pendingId),
    });
    // Si la deuda se creó junto con este movimiento, también se retira.
    if (pendingItem.deudaCreadaId) softDeleteEntity('debts', pendingItem.deudaCreadaId);

    const avisoId = uid();
    set((s) => ({ avisos: [...s.avisos, { id: avisoId, tipo: 'deshecho' as const, transaccion: pendingItem.transaccion }] }));
    setTimeout(() => get().cerrarAviso(avisoId), 2000);
  },

  /** Envía el movimiento al servidor (/api/movimientos (server/dinero.ts)). Una sola vez por id (N2). */
  commitPendingTransaccion: (pendingId) => {
    const yaVa = enVuelo.get(pendingId);
    if (yaVa) return yaVa;
    const pendingItem = get().pendingUndoList.find((p) => p.id === pendingId);
    if (!pendingItem) return Promise.resolve();
    clearTimeout(pendingItem.timerId);
    // [N1] Desde aquí ya no se puede deshacer
    set((s) => ({ pendingUndoList: s.pendingUndoList.map((p) => (p.id === pendingId ? { ...p, enviando: true } : p)) }));

    const exito = () => {
      set((s) => ({
        transacciones: s.transacciones.map((t) => (t.id === pendingId ? { ...t, is_pending_undo: false } : t)),
        pendingUndoList: s.pendingUndoList.filter((p) => p.id !== pendingId),
      }));
      removeFromEmergencyQueue(pendingId);
      const avisoId = uid();
      set((s) => ({ avisos: [...s.avisos, { id: avisoId, tipo: 'guardado' as const, transaccion: pendingItem.transaccion }] }));
      setTimeout(() => get().cerrarAviso(avisoId), 1500);
    };

    const promesa = (async () => {
      try {
        await executeTransactionBatch({
          transaccion: pendingItem.transaccion,
          cuentaNombre: pendingItem.transaccion.cuenta_nombre,
          categoriaNombre: pendingItem.transaccion.categoria_nombre,
          supercategoria: pendingItem.transaccion.supercategoria,
        });
        exito();
      } catch (e: any) {
        if (esYaGuardado(e)) { exito(); return; } // [N2] ya estaba guardado: no es un error
        const definitivo = esRechazoDefinitivo(e); // [N4]
        if (definitivo) removeFromEmergencyQueue(pendingId);
        console.error('[Sync] La transacción no se guardó:', e?.message || e);
        // Se revierte SOLO su efecto, y solo si sigue pendiente (nunca dos veces)
        set((s) => {
          if (!s.pendingUndoList.some((p) => p.id === pendingId)) return {};
          const rev = pendingItem.efecto ? aplicarEfecto(s, pendingItem.efecto, -1) : s;
          return {
            cuentas: rev.cuentas, metas: rev.metas,
            // [N8] Si el préstamo inicial de una deuda nueva se rechazó, la deuda en $0 no queda como fantasma
            deudas: definitivo && pendingItem.deudaCreadaId ? rev.deudas.filter((d) => d.id !== pendingItem.deudaCreadaId) : rev.deudas,
            transacciones: s.transacciones.filter((t) => t.id !== pendingId),
            pendingUndoList: s.pendingUndoList.filter((p) => p.id !== pendingId),
          };
        });
        if (definitivo && pendingItem.deudaCreadaId) softDeleteEntity('debts', pendingItem.deudaCreadaId);
        const deuda = get().deudas.find((d) => d.id === pendingItem.transaccion.deuda_id);
        const mensaje = definitivo ? errorDesdeServidor(e?.message, deuda?.moneda || 'COP').mensaje : undefined;
        set((s) => ({
          avisos: [...s.avisos, { id: uid(), tipo: definitivo ? ('error' as const) : ('sin_red' as const), transaccion: pendingItem.transaccion, mensaje }],
        }));
        await get().hydrateFromServidor();
      } finally {
        enVuelo.delete(pendingId);
      }
    })();
    enVuelo.set(pendingId, promesa);
    return promesa;
  },

  addCuenta: (cuentaData) => {
    const userId = get().userProfile.id;
    const saldoInicial = cuentaData.saldo_actual || 0;
    const newCuenta: Cuenta = { ...cuentaData, id: uid(), user_id: userId, is_active: true };
    set((state) => ({ cuentas: [...state.cuentas, newCuenta] }));
    // [E37] La cuenta nace en 0 y el saldo inicial queda como movimiento de apertura ('ajuste').
    insertAccount({
      id: newCuenta.id, user_id: userId, nombre: newCuenta.nombre, tipo: newCuenta.tipo,
      moneda: newCuenta.moneda, saldo_actual: 0,
      mascara: newCuenta.mascara, color_badge: newCuenta.color_badge,
    } as any)
      .then(() => {
        if (saldoInicial !== 0) {
          set((s) => ({ cuentas: s.cuentas.map((c) => (c.id === newCuenta.id ? { ...c, saldo_actual: 0 } : c)) }));
          return get().ajustarSaldoCuenta(newCuenta.id, saldoInicial, 'Saldo inicial').then((r) => {
            if ('error' in r) avisoCreacion(get, set, 'el saldo inicial de la cuenta (queda en $0; ajústalo en Analítica › Ajustes)'); // [N5]
          });
        }
      })
      .catch((e) => {
        console.error('[Servidor] insertAccount:', e.message);
        set((s) => ({ cuentas: s.cuentas.filter((c) => c.id !== newCuenta.id) }));
        avisoCreacion(get, set, 'la cuenta');
      });
  },

  ajustarSaldoCuenta: async (id, nuevoSaldo, notas) => {
    // [E36] Primero se guardan los movimientos pendientes de esa cuenta: si no, el servidor
    // calcularía la diferencia sin ellos y se aplicarían dos veces.
    const pendientes = get().pendingUndoList.filter((p) => p.efecto?.cuentas.some((c) => c.id === id));
    for (const p of pendientes) await get().commitPendingTransaccion(p.id);
    // [N3] También lo que quedó en la cola de emergencia (anotado sin conexión) para esta cuenta
    const cola = await recoverPendingTransactions(get().userProfile.id, id);
    if (cola.pendientes > 0) return { error: 'Tienes movimientos sin guardar en esta cuenta. Conéctate y vuelve a intentarlo.' };
    if (cola.recuperados > 0) await get().hydrateFromServidor();

    const cuenta = get().cuentas.find((c) => c.id === id);
    if (!cuenta) return { error: mensajeError('CUENTA_AJENA') };
    const txId = uid();
    try {
      const r = await ajustarSaldo(txId, id, nuevoSaldo, notas);
      if (r.diferencia === 0) return { diferencia: 0 };
      const ajuste: Transaccion = {
        id: txId, user_id: get().userProfile.id, cuenta_id: id, categoria_id: '', monto: Math.abs(r.diferencia),
        moneda: cuenta.moneda, tipo: 'ajuste', fecha: new Date().toISOString(),
        fecha_local_str: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }),
        notas: notas || 'Ajuste de saldo', cuenta_nombre: cuenta.nombre, origen: 'ajuste', monto_aplicado: r.diferencia,
        saldo_anterior: r.saldo_nuevo - r.diferencia, saldo_nuevo: r.saldo_nuevo, is_active: true,
      };
      set((s) => ({
        cuentas: s.cuentas.map((c) => (c.id === id ? { ...c, saldo_actual: r.saldo_nuevo } : c)),
        transacciones: [ajuste, ...s.transacciones],
      }));
      const avisoId = uid();
      set((s) => ({ avisos: [...s.avisos, { id: avisoId, tipo: 'guardado' as const, transaccion: ajuste }] }));
      setTimeout(() => get().cerrarAviso(avisoId), 2500);
      return { diferencia: r.diferencia };
    } catch (e: any) {
      console.error('[Servidor] ajustarSaldo:', e?.message || e);
      await get().hydrateFromServidor();
      return { error: e?.code ? errorDesdeServidor(e?.message, cuenta.moneda).mensaje : 'Sin conexión. Intenta otra vez.' };
    }
  },

  cerrarSesion: async () => {
    // Guarda lo pendiente antes de salir para no perderlo.
    for (const p of [...get().pendingUndoList]) await get().commitPendingTransaccion(p.id);
    await signOut(auth);
    get().setSessionUser(null);
  },

  softDeleteCuenta: (id) => {
    set((state) => ({
      cuentas: state.cuentas.filter((c) => c.id !== id),
    }));
    softDeleteEntity('accounts', id);
  },

  /**
   * Crear deuda (D-035, E18). Con `movimiento`: la deuda nace en 0 y un 'prestamo_capital' mueve la plata
   * (presté → sale de la cuenta; me prestaron → entra) y sube el total. Sin `movimiento`: "ya existía".
   */
  addDeuda: async (deudaData, movimiento) => {
    const userId = get().userProfile.id;
    const conMovimiento = !!movimiento && movimiento.monto > 0;
    const newDeuda: Deuda = {
      ...deudaData, id: uid(), user_id: userId, is_active: true,
      monto_total: conMovimiento ? 0 : deudaData.monto_total, monto_pagado: 0, estado: 'activa',
    };
    try {
      // [E33] Se espera al servidor: si falla, no queda una deuda fantasma.
      await insertDebt({
        id: newDeuda.id, user_id: userId, contraparte: newDeuda.contraparte, concepto: newDeuda.concepto,
        tipo: newDeuda.tipo, moneda: newDeuda.moneda || 'COP',
        monto_total: newDeuda.monto_total, monto_pagado: 0, estado: 'activa', fecha_vencimiento: newDeuda.fecha_vencimiento,
      } as any);
    } catch (e: any) {
      console.error('[Servidor] insertDebt:', e?.message);
      return { error: { codigo: 'DESCONOCIDO', mensaje: 'No se pudo crear la deuda. Revisa tu conexión.' } };
    }
    set((state) => ({ deudas: [newDeuda, ...state.deudas] }));
    if (!conMovimiento) return { id: newDeuda.id };
    return get().addTransaccionOptimistic(
      {
        cuenta_id: movimiento!.cuenta_id, categoria_id: '', monto: movimiento!.monto, tipo: 'prestamo_capital',
        deuda_id: newDeuda.id, fecha: new Date().toISOString(),
        notas: movimiento!.notas || `${newDeuda.tipo === 'por_cobrar' ? 'Préstamo a' : 'Préstamo de'} ${newDeuda.contraparte}`,
      },
      { deudaCreadaId: newDeuda.id },
    );
  },


  softDeleteDeuda: (id) => {
    set((state) => ({
      deudas: state.deudas.filter((d) => d.id !== id),
    }));
    softDeleteEntity('debts', id);
  },

  addMeta: (metaData) => {
    const userId = get().userProfile.id;
    const newMeta: Meta = { ...metaData, id: uid(), user_id: userId, monto_actual: 0, porcentaje: 0, is_active: true };
    set((state) => ({ metas: [...state.metas, newMeta] }));
    insertGoal({
      id: newMeta.id, user_id: userId, nombre: newMeta.nombre, monto_objetivo: newMeta.monto_objetivo,
      monto_actual: 0, porcentaje: 0, color: newMeta.color, fecha_limite: newMeta.fecha_limite,
    } as any).catch((e) => {
      console.error('[Servidor] insertGoal:', e.message);
      set((s) => ({ metas: s.metas.filter((m) => m.id !== newMeta.id) }));
      avisoCreacion(get, set, 'la meta');
    });
    return newMeta.id;
  },


  softDeleteMeta: (id) => {
    set((state) => ({
      metas: state.metas.filter((m) => m.id !== id),
    }));
    softDeleteEntity('goals', id);
  },

  softDeleteCategoria: (id) => {
    set((state) => ({
      categorias: state.categorias.filter((c) => c.id !== id),
    }));
    softDeleteEntity('categories', id);
  },
}));
