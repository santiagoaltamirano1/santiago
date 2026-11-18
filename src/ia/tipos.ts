// Iteración 2 · F3 · Forma exacta de lo que devuelven /api/exportar (server/reportes.ts).
// Estos tipos no dependen de la base de datos: los usan exportService (app) y las funciones puras (scripts de prueba).

export type TipoMov =
  | 'ingreso' | 'gasto' | 'transferencia' | 'ajuste'
  | 'aporte_meta' | 'retiro_meta' | 'prestamo_capital' | 'abono_capital';

export interface FilaMovimiento {
  dia: string;                 // AAAA-MM-DD (Bogotá)
  hora: string;                // HH:MM
  tipo: TipoMov;
  cuenta_como: 'Ingreso' | 'Gasto' | 'No cuenta';
  categoria: string | null;
  detalle: string | null;      // notas, sin ids
  cuenta: string | null;
  destino: string | null;
  meta: string | null;
  deuda: string | null;        // contraparte
  operacion_deuda: string | null;
  monto: number;
  moneda: string;
  tasa_cop: number | null;
  cop: number;                 // en COP con la regla de /api/resumen (server/reportes.ts) (ajuste con signo)
  efecto_cuenta: -1 | 0 | 1;
  saldo_anterior: number | null;
  saldo_nuevo: number | null;
  origen: string;
}

export interface ResumenExport {
  version: number;
  generado_en: string;
  zona_horaria: string;
  hoy: string;
  desde: string;
  hasta: string;
  tasas: { moneda: string; cop_por_unidad: number; vigente_desde: string; fuente: string }[];
  foto: { disponible: number; en_cuentas: number; apartado_metas: number; debes: number; te_deben: number; patrimonio: number };
  totales: { movimientos: number; ingresos: number; gastos: number; ajustes: number; primer_dia: string | null; ultimo_dia: string | null };
  meses: { mes: string; ingresos: number; gastos: number; ajustes: number; movimientos: number }[];
  categorias_mes: { mes: string; tipo: 'gasto' | 'ingreso'; categoria: string; total: number; movimientos: number }[];
  cuentas: { nombre: string; tipo: string; moneda: string; saldo: number; saldo_cop: number; activa: boolean }[];
  metas: { nombre: string; objetivo: number; actual: number; fecha_limite: string | null; activa: boolean; aportes: number; retiros: number; movimientos: number; ultimo_movimiento: string | null }[];
  deudas: { contraparte: string; concepto: string | null; tipo: 'por_cobrar' | 'por_pagar'; moneda: string; total: number; pagado: number; pendiente: number; pendiente_cop: number; estado: string; vence: string | null; activa: boolean; primer_movimiento: string | null; prestado: number; abonado: number; movimientos: number }[];
  categorias: { nombre: string; tipo: 'gasto' | 'ingreso'; grupo: string | null; activa: boolean; movimientos: number }[];
  capturas_voz: { fecha: string; texto: string; estado: string; movimientos: number }[];
}

export interface DocumentoExport {
  resumen: ResumenExport;
  movimientos: FilaMovimiento[];
}

/** Los números llegan de Postgres como number o como texto (numeric): se normalizan aquí. */
export function normalizarDocumento(resumen: any, filas: any[]): DocumentoExport {
  const n = (v: any) => (v === null || v === undefined ? null : Number(v));
  const r = { ...resumen } as ResumenExport;
  r.cuentas = (resumen.cuentas || []).map((c: any) => ({ ...c, saldo: Number(c.saldo), saldo_cop: Number(c.saldo_cop) }));
  r.metas = (resumen.metas || []).map((m: any) => ({ ...m, objetivo: Number(m.objetivo), actual: Number(m.actual) }));
  r.deudas = (resumen.deudas || []).map((d: any) => ({ ...d, total: Number(d.total), pagado: Number(d.pagado), pendiente: Number(d.pendiente) }));
  r.tasas = (resumen.tasas || []).map((t: any) => ({ ...t, cop_por_unidad: Number(t.cop_por_unidad) }));
  const movimientos = filas.map((f: any) => ({
    ...f, monto: Number(f.monto), cop: Number(f.cop), tasa_cop: n(f.tasa_cop),
    saldo_anterior: n(f.saldo_anterior), saldo_nuevo: n(f.saldo_nuevo),
  })) as FilaMovimiento[];
  return { resumen: r, movimientos };
}
