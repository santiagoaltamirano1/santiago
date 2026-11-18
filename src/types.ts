export type Moneda = 'COP' | 'USD' | 'EUR';

export type TipoCuenta = 'ahorro' | 'bolsillo' | 'broker' | 'efectivo' | 'corriente' | 'tarjeta';

export interface Cuenta {
  id: string;
  user_id: string;
  nombre: string;
  tipo: TipoCuenta;
  moneda: Moneda;
  saldo_actual: number;
  mascara?: string; // Ej: **** 4589
  color_badge?: string; // Hex o clase CSS
  is_active?: boolean; // Soft delete flag
}

export interface Categoria {
  id: string;
  nombre: string;
  supercategoria: string;
  tipo: 'ingreso' | 'gasto';
  icono: string; // Nombre de Material Symbol
  is_active?: boolean; // Soft delete flag
}

// Tipos de movimiento (Fase 2). La app hoy solo crea los tres primeros; los demás se conectan en la Fase 3.
// ajuste: diferencia de saldo (solo vía /api/ajustar-saldo) · aporte_meta / retiro_meta: metas virtuales, no mueven cuentas
// prestamo_capital / abono_capital: capital de deudas, mueve la cuenta pero no es ingreso ni gasto
export type TipoTransaccion =
  | 'ingreso' | 'gasto' | 'transferencia'
  | 'ajuste' | 'aporte_meta' | 'retiro_meta' | 'prestamo_capital' | 'abono_capital';

export type OrigenTransaccion = 'manual' | 'ajuste' | 'ia_voz' | 'recuperada';

export interface Transaccion {
  id: string;
  user_id: string;
  cuenta_id: string;
  categoria_id: string;
  monto: number;
  moneda?: Moneda; // Moneda del monto (= moneda de la cuenta de origen)
  tipo: TipoTransaccion;
  fecha: string; // ISO string
  fecha_utc?: any; // serverTimestamp() para Firestore
  fecha_local_str?: string; // YYYY-MM-DD para resiliencia horaria/Looker
  notas?: string;
  destino_cuenta_id?: string; // Si es transferencia
  meta_id?: string; // Si es un aporte a meta
  deuda_id?: string; // Si es un pago/abono a deuda
  operacion_deuda?: 'abono' | 'incremento'; // Abono o Incremento de deuda
  // Desnormalización Analítica (OLAP)
  cuenta_nombre?: string;
  categoria_nombre?: string;
  supercategoria?: string;
  // Bimodalidad & Optimistic UI
  is_active?: boolean;
  is_pending_undo?: boolean;
  // Trazabilidad (Fase 2, los llena el servidor)
  origen?: OrigenTransaccion;
  monto_aplicado?: number; // monto aplicado a meta/deuda/destino en su moneda; en ajustes, la diferencia con signo
  tasa_cop?: number;       // COP por unidad de la moneda del movimiento al guardar
  saldo_anterior?: number; // solo ajustes
  saldo_nuevo?: number;    // solo ajustes
  captura_id?: string;     // captura de IA que lo originó
}

export interface Deuda {
  id: string;
  user_id: string;
  contraparte: string;
  concepto?: string;
  tipo: 'por_cobrar' | 'por_pagar';
  moneda?: Moneda; // Moneda de la deuda/cobro (COP por defecto)
  monto_total: number;
  monto_pagado: number;
  estado: 'activa' | 'saldada';
  detalles_pago?: string; // Ej: 'Cuota 8/12'
  fecha_vencimiento?: string; // Ej: '2026-11-15'
  is_active?: boolean;
}

export interface Meta {
  id: string;
  user_id: string;
  nombre: string;
  monto_objetivo: number;
  monto_actual: number;
  porcentaje: number;
  color?: string;
  fecha_limite?: string; // Ej: '2026-12-31'
  is_active?: boolean;
}

export interface CategoriaRapida {
  id: string;
  nombre: string;
  categoria_id: string;
  subcategoria: string;
  nota_predeterminada: string;
  icono: string;
  is_active?: boolean;
}

export type ActiveTab = 'calculator' | 'register' | 'debts_goals' | 'analytics';

export type AppTheme = 'blueprint' | 'twitch' | 'mercury' | 'netflix';

export interface ThemeConfig {
  id: AppTheme;
  name: string;
  subtitle: string;
  source: string;
  tag: string;
  isDark: boolean;
  colors: {
    canvas: string;
    paper: string;
    surfaceAlt: string;
    ink: string;
    midGray: string;
    hairline: string;
    primary: string;
    primaryText: string;
    ember: string;
  };
  description: string;
}

export const APP_THEMES: ThemeConfig[] = [
  {
    id: 'blueprint',
    name: 'Clinical Blueprint',
    subtitle: 'Frosted Paper & Archival Ink',
    source: 'Diseño Base Actual',
    tag: 'Claro / Acromático',
    isDark: false,
    colors: {
      canvas: '#f5f5f5',
      paper: '#ffffff',
      surfaceAlt: '#fafafa',
      ink: '#0a0a0a',
      midGray: '#666666',
      hairline: '#e5e5e5',
      primary: '#0a0a0a',
      primaryText: '#fafafa',
      ember: '#c8000a',
    },
    description: 'Estética de plano arquitectónico con papel esmerilado, escala acromática pura, alto contraste y tipografía suiza.',
  },
  {
    id: 'twitch',
    name: 'Twitch Violet',
    subtitle: 'Electric Purple & Lilac Canvas',
    source: 'refero.design twitch.tv',
    tag: 'Luz Vibrante / Gaming',
    isDark: false,
    colors: {
      canvas: '#f4f0fb',
      paper: '#ffffff',
      surfaceAlt: '#ede6f9',
      ink: '#0e0720',
      midGray: '#665a87',
      hairline: '#e2d8f7',
      primary: '#9146FF',
      primaryText: '#ffffff',
      ember: '#c8000a',
    },
    description: 'Inspirado en la interfaz luminosa de Twitch: fondo lavanda sutil, tarjetas blancas y acentos en púrpura eléctrico #9146FF.',
  },
  {
    id: 'mercury',
    name: 'Mercury Dark',
    subtitle: 'Midnight Obsidian & Cyber Cobalt',
    source: 'refero.design fintech',
    tag: 'Fintech Modo Oscuro',
    isDark: true,
    colors: {
      canvas: '#0b0e14',
      paper: '#141822',
      surfaceAlt: '#1d2331',
      ink: '#f1f5f9',
      midGray: '#8997ac',
      hairline: '#232a3b',
      primary: '#2563eb',
      primaryText: '#ffffff',
      ember: '#f87171',
    },
    description: 'Diseño bancario institucional de alta tecnología: fondo medianoche profundo, paneles en pizarra oscura y acentos cobalt ultra precisos.',
  },
  {
    id: 'netflix',
    name: 'Netflix Crimson',
    subtitle: 'Cinematic Carbon & Red Velvet',
    source: 'refero.design netflix.com',
    tag: 'Cinema High-Contrast',
    isDark: true,
    colors: {
      canvas: '#080808',
      paper: '#141414',
      surfaceAlt: '#202020',
      ink: '#ffffff',
      midGray: '#949494',
      hairline: '#2b2b2b',
      primary: '#E50914',
      primaryText: '#ffffff',
      ember: '#ff3b3b',
    },
    description: 'Contraste cinematográfico absoluto: negro puro de sala oscura, superficies de grafito pulido y el icónico rojo carmesí #E50914.',
  },
];


export interface UserProfile {
  id: string;
  email: string;
  nombre: string;
  moneda_principal: Moneda;
  avatar_url?: string;
}

export interface PendingUndoItem {
  id: string;
  transaccion: Transaccion;
  previousAccountState?: { id: string; saldo: number }[];
  previousGoalSnapshot?: { id: string; monto_actual: number; porcentaje: number };
  previousDebtSnapshot?: { id: string; monto_pagado: number; monto_total: number; estado: 'activa' | 'saldada' };
  timerId: ReturnType<typeof setTimeout>;
  secondsLeft: number;
  // Fase 3: efecto aplicado en pantalla; deshacer aplica el inverso (E10)
  efecto?: import('./utils/reglas').Efecto;
  deudaCreadaId?: string; // deuda creada junto con este movimiento: se borra si se deshace
  enviando?: boolean;     // [N1] ya salió hacia el servidor: no se puede deshacer
}
