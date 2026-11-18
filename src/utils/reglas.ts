// Reglas de dinero del lado de la app (Fase 3).
// ESPEJO de las reglas del servidor: motor/dinero.ts (registrarMovimiento). Si cambias una regla, cambia LAS DOS.
// Si cambias una regla aquí, cámbiala allá en el mismo cambio, y viceversa.
// Se usa para: validar ANTES de guardar (mismos códigos que el servidor), aplicar el efecto optimista
// y DESHACER aplicando el efecto inverso (no una foto: corrige E10).

import type { Categoria, Cuenta, Deuda, Meta, Moneda, Transaccion } from '../types';
import { convertir, type FxRates } from './fx';
import { formatMonto } from './money';

export type CodigoError =
  | 'MONTO_INVALIDO' | 'CUENTA_REQUERIDA' | 'DESTINO_REQUERIDO' | 'MISMA_CUENTA' | 'META_REQUERIDA'
  | 'DEUDA_REQUERIDA' | 'META_Y_DEUDA' | 'DEUDA_SALDADA' | 'SOBREPAGO' | 'RETIRO_MAYOR'
  | 'DISPONIBLE_INSUFICIENTE' | 'TIPO_INVALIDO' | 'CUENTA_AJENA' | 'DESTINO_AJENO' | 'META_AJENA'
  | 'DEUDA_AJENA' | 'NO_AUTENTICADO' | 'ORIGEN_INVALIDO' | 'CATEGORIA_REQUERIDA' | 'CATEGORIA_AJENA'
  | 'CATEGORIA_INVALIDA' | 'CAPTURA_AJENA' | 'DESCONOCIDO';

export interface ErrorDinero {
  codigo: CodigoError;
  mensaje: string;      // texto listo para mostrar
  maximo?: number;      // pendiente, acumulado o disponible, en `monedaMaximo`
  monedaMaximo?: Moneda;
}

/** Cambios que un movimiento produce. Deshacer = aplicar con signo contrario. */
export interface Efecto {
  cuentas: { id: string; delta: number }[];
  meta?: { id: string; delta: number };                       // en COP
  deuda?: { id: string; campo: 'monto_pagado' | 'monto_total'; delta: number };
  aplicado: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Disponible (D-029): cuentas que no son tarjeta, en COP, menos lo apartado en metas. Igual que disponibleCop() de motor/dinero.ts. */
export function disponibleCOP(cuentas: Cuenta[], metas: Meta[], fx: FxRates): number {
  const enCuentas = cuentas
    .filter((c) => c.is_active !== false && c.tipo !== 'tarjeta')
    .reduce((s, c) => s + convertir(c.saldo_actual, c.moneda || 'COP', 'COP', fx), 0);
  const apartado = metas.filter((m) => m.is_active !== false).reduce((s, m) => s + m.monto_actual, 0);
  return enCuentas - apartado;
}

export function pendienteDeuda(d: Deuda): number {
  return Math.max(0, r2(d.monto_total - d.monto_pagado));
}

/** ¿Una transacción que llegó del servidor cuenta como ingreso/gasto del flujo? (ajustes, metas y capital no) */
export const esFlujo = (t: Pick<Transaccion, 'tipo'>) => t.tipo === 'ingreso' || t.tipo === 'gasto';

export function mensajeError(codigo: CodigoError, maximo?: number, moneda: Moneda = 'COP'): string {
  const m = maximo !== undefined ? formatMonto(maximo, moneda, 'neutro') : '';
  switch (codigo) {
    case 'MONTO_INVALIDO': return 'Escribe cuánto fue.';
    case 'CUENTA_REQUERIDA': case 'CUENTA_AJENA': return 'Elige una cuenta.';
    case 'DESTINO_REQUERIDO': case 'DESTINO_AJENO': return 'Elige la cuenta que recibe.';
    case 'MISMA_CUENTA': return 'Elige otra cuenta para recibir.';
    case 'META_REQUERIDA': case 'META_AJENA': return 'Elige una meta.';
    case 'DEUDA_REQUERIDA': case 'DEUDA_AJENA': return 'Elige una deuda.';
    case 'META_Y_DEUDA': return 'Un movimiento va a una meta o a una deuda, no a las dos.';
    case 'DEUDA_SALDADA': return 'Esta deuda ya está saldada.';
    case 'SOBREPAGO': return `Solo quedan ${m} pendientes.`;
    case 'RETIRO_MAYOR': return `En esta meta tienes ${m}.`;
    case 'DISPONIBLE_INSUFICIENTE': return `Solo tienes ${m} libres para apartar.`;
    case 'NO_AUTENTICADO': return 'Tu sesión se cerró. Entra de nuevo.';
    case 'CATEGORIA_REQUERIDA': case 'CATEGORIA_AJENA': return 'Elige una categoría.';
    case 'CAPTURA_AJENA': return 'No se encontró lo que dictaste. Dícelo otra vez.';
    case 'CATEGORIA_INVALIDA': return 'Esa categoría no corresponde: elige una del mismo tipo (gasto o ingreso).';
    default: return 'No se pudo guardar. Anótalo otra vez.';
  }
}

const err = (codigo: CodigoError, maximo?: number, monedaMaximo: Moneda = 'COP'): { error: ErrorDinero } => ({
  error: { codigo, maximo, monedaMaximo, mensaje: mensajeError(codigo, maximo, monedaMaximo) },
});

/** Traduce un error del servidor ("SOBREPAGO: 3000000.00") a un ErrorDinero. */
export function errorDesdeServidor(mensaje: string | undefined, monedaMaximo: Moneda = 'COP'): ErrorDinero {
  const m = /^([A-Z_]+):\s*(.*)$/.exec(mensaje || '');
  const codigo = (m?.[1] as CodigoError) || 'DESCONOCIDO';
  const num = m ? Number(m[2]) : NaN;
  const maximo = Number.isFinite(num) ? num : undefined;
  return { codigo, maximo, monedaMaximo, mensaje: mensajeError(codigo, maximo, monedaMaximo) };
}

interface Estado { cuentas: Cuenta[]; metas: Meta[]; deudas: Deuda[]; fx: FxRates; categorias?: Categoria[] }

/** Valida y calcula el efecto de un movimiento con las mismas reglas que el servidor. */
export function calcularEfecto(tx: Omit<Transaccion, 'id' | 'user_id'>, s: Estado): { efecto: Efecto } | { error: ErrorDinero } {
  const monto = Math.abs(tx.monto || 0);
  if (!(monto > 0)) return err('MONTO_INVALIDO');
  if (tx.meta_id && tx.deuda_id) return err('META_Y_DEUDA');
  if (tx.cuenta_id && tx.cuenta_id === tx.destino_cuenta_id) return err('MISMA_CUENTA');
  const necesitaCuenta = ['ingreso', 'gasto', 'transferencia', 'prestamo_capital', 'abono_capital'].includes(tx.tipo);
  if (necesitaCuenta && !tx.cuenta_id) return err('CUENTA_REQUERIDA');
  if (tx.tipo === 'transferencia' && !tx.destino_cuenta_id) return err('DESTINO_REQUERIDO');
  if ((tx.tipo === 'aporte_meta' || tx.tipo === 'retiro_meta') && !tx.meta_id) return err('META_REQUERIDA');
  if ((tx.tipo === 'prestamo_capital' || tx.tipo === 'abono_capital') && !tx.deuda_id) return err('DEUDA_REQUERIDA');
  if (tx.tipo === 'ajuste') return err('TIPO_INVALIDO');
  // Igual que la validación de categoría de motor/dinero.ts: gasto/ingreso exigen categoría de su mismo tipo.
  if ((tx.tipo === 'ingreso' || tx.tipo === 'gasto') && s.categorias) {
    if (!tx.categoria_id) return err('CATEGORIA_REQUERIDA');
    const cat = s.categorias.find((c) => c.id === tx.categoria_id);
    if (!cat) return err('CATEGORIA_AJENA');
    if (cat.tipo !== tx.tipo) return err('CATEGORIA_INVALIDA');
  }

  const cuenta = tx.cuenta_id ? s.cuentas.find((c) => c.id === tx.cuenta_id) : undefined;
  if (tx.cuenta_id && !cuenta) return err('CUENTA_AJENA');
  const cur: Moneda = cuenta?.moneda || 'COP';
  const ef: Efecto = { cuentas: [], aplicado: monto };

  if (tx.tipo === 'ingreso' || tx.tipo === 'gasto' || tx.tipo === 'transferencia') {
    ef.cuentas.push({ id: cuenta!.id, delta: tx.tipo === 'ingreso' ? monto : -monto });
    if (tx.tipo === 'transferencia') {
      const dest = s.cuentas.find((c) => c.id === tx.destino_cuenta_id);
      if (!dest) return err('DESTINO_AJENO');
      ef.aplicado = r2(convertir(monto, cur, dest.moneda || 'COP', s.fx));
      ef.cuentas.push({ id: dest.id, delta: ef.aplicado });
    }
    // Forma anterior (gasto/ingreso con meta o deuda): solo la usan movimientos viejos o la cola de recuperación.
    if (tx.meta_id) {
      const g = s.metas.find((m) => m.id === tx.meta_id);
      if (!g) return err('META_AJENA');
      ef.aplicado = r2(convertir(monto, cur, 'COP', s.fx));
      ef.meta = { id: g.id, delta: ef.aplicado };
    }
    if (tx.deuda_id) {
      const d = s.deudas.find((x) => x.id === tx.deuda_id);
      if (!d) return err('DEUDA_AJENA');
      const delta = r2(convertir(monto, cur, d.moneda || 'COP', s.fx));
      if (tx.operacion_deuda === 'incremento') {
        ef.aplicado = delta; ef.deuda = { id: d.id, campo: 'monto_total', delta };
      } else {
        const pend = pendienteDeuda(d);
        if (pend <= 0) return err('DEUDA_SALDADA');
        ef.aplicado = Math.min(delta, pend); ef.deuda = { id: d.id, campo: 'monto_pagado', delta: ef.aplicado };
      }
    }
    return { efecto: ef };
  }

  if (tx.tipo === 'aporte_meta' || tx.tipo === 'retiro_meta') {
    const g = s.metas.find((m) => m.id === tx.meta_id);
    if (!g) return err('META_AJENA');
    const enCOP = r2(convertir(monto, cur, 'COP', s.fx));
    if (tx.tipo === 'aporte_meta') {
      const disp = disponibleCOP(s.cuentas, s.metas, s.fx);
      // [N9] floor: la propuesta "Apartar $X" nunca supera el disponible real (evita rechazo en bucle)
      if (enCOP > disp) return err('DISPONIBLE_INSUFICIENTE', Math.max(0, Math.floor(disp)));
      ef.meta = { id: g.id, delta: enCOP };
    } else {
      if (enCOP > g.monto_actual) return err('RETIRO_MAYOR', g.monto_actual);
      ef.meta = { id: g.id, delta: -enCOP };
    }
    ef.aplicado = enCOP;
    return { efecto: ef };
  }

  // prestamo_capital / abono_capital
  const d = s.deudas.find((x) => x.id === tx.deuda_id);
  if (!d) return err('DEUDA_AJENA');
  const curDeuda: Moneda = d.moneda || 'COP';
  const delta = r2(convertir(monto, cur, curDeuda, s.fx));
  if (tx.tipo === 'prestamo_capital') {
    // Presto (por_cobrar): sale plata. Me prestan (por_pagar): entra plata.
    ef.cuentas.push({ id: cuenta!.id, delta: d.tipo === 'por_cobrar' ? -monto : monto });
    ef.deuda = { id: d.id, campo: 'monto_total', delta };
    ef.aplicado = delta;
  } else {
    const pend = pendienteDeuda(d);
    if (pend <= 0) return err('DEUDA_SALDADA');
    if (delta > pend + 0.01) return err('SOBREPAGO', pend, curDeuda);
    // Pago lo que debo (por_pagar): sale plata. Me pagan (por_cobrar): entra plata.
    ef.cuentas.push({ id: cuenta!.id, delta: d.tipo === 'por_pagar' ? -monto : monto });
    ef.aplicado = Math.min(delta, pend);
    ef.deuda = { id: d.id, campo: 'monto_pagado', delta: ef.aplicado };
  }
  return { efecto: ef };
}

/** Aplica (signo 1) o revierte (signo −1) un efecto sobre el estado. */
export function aplicarEfecto(s: { cuentas: Cuenta[]; metas: Meta[]; deudas: Deuda[] }, ef: Efecto, signo: 1 | -1) {
  const cuentas = s.cuentas.map((c) => {
    const ds = ef.cuentas.filter((x) => x.id === c.id);
    return ds.length ? { ...c, saldo_actual: r2(c.saldo_actual + signo * ds.reduce((a, x) => a + x.delta, 0)) } : c;
  });
  const metas = ef.meta
    ? s.metas.map((m) => {
        if (m.id !== ef.meta!.id) return m;
        const actual = Math.max(0, r2(m.monto_actual + signo * ef.meta!.delta));
        return { ...m, monto_actual: actual, porcentaje: Math.min(100, Math.round((actual / m.monto_objetivo) * 100)) };
      })
    : s.metas;
  const deudas = ef.deuda
    ? s.deudas.map((d) => {
        if (d.id !== ef.deuda!.id) return d;
        const n = { ...d, [ef.deuda!.campo]: r2(d[ef.deuda!.campo] + signo * ef.deuda!.delta) } as Deuda;
        n.estado = n.monto_pagado >= n.monto_total && n.monto_total > 0 ? 'saldada' : 'activa';
        return n;
      })
    : s.deudas;
  return { cuentas, metas, deudas };
}
