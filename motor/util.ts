// Utilidades compartidas del servidor: errores de negocio, redondeo, fechas de Bogotá y conversión de monedas.

/** Error de negocio. El mensaje SIEMPRE empieza por "CODIGO: detalle" (la app lo traduce con errorDesdeServidor). */
export class ErrorNegocio extends Error {
  constructor(public codigo: string, detalle = '', public status = 400) {
    super(`${codigo}: ${detalle || codigo}`);
  }
}
export const falla = (codigo: string, detalle = '', status = 400): never => { throw new ErrorNegocio(codigo, detalle, status); };

/** Redondeo como Postgres round(): mitad lejos del cero. */
export function redondear(v: number, decimales = 0): number {
  const f = 10 ** decimales;
  const r = Math.round(Math.abs(v) * f + 1e-9) / f;
  return v < 0 ? -r : r;
}
export const r2 = (v: number) => redondear(v, 2);
export const r4 = (v: number) => redondear(v, 4);

/** Fecha de hoy en Bogotá (UTC−5, sin horario de verano). */
export function hoyBogota(ahora = new Date()): string {
  return new Date(ahora.getTime() - 5 * 3600e3).toISOString().slice(0, 10);
}
/** Día de un movimiento: fecha_local_str si es AAAA-MM-DD; si no, la fecha en Bogotá. (= wf_dia_movimiento) */
export function diaMovimiento(local: string | null | undefined, fechaIso: string): string {
  if (local && /^\d{4}-\d{2}-\d{2}$/.test(local)) return local;
  return hoyBogota(new Date(fechaIso));
}
/** Hora HH:MM en Bogotá. */
export function horaBogota(fechaIso: string): string {
  return new Date(new Date(fechaIso).getTime() - 5 * 3600e3).toISOString().slice(11, 16);
}
export const mesDe = (dia: string) => dia.slice(0, 7);
export function sumarMeses(mes: string, n: number): string {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}
export function ultimoDiaMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}

export const MONEDAS = ['COP', 'USD', 'EUR'] as const;
export type Moneda = (typeof MONEDAS)[number];
export interface Tasas { usd: number; eur: number }
export const TASAS_POR_DEFECTO: Tasas = { usd: 4100, eur: 4450 };

/** = wf_convertir: pasa por COP. */
export function convertir(monto: number, desde: string, hacia: string, t: Tasas): number {
  const enCop = desde === 'USD' ? monto * t.usd : desde === 'EUR' ? monto * t.eur : monto;
  return hacia === 'USD' ? enCop / t.usd : hacia === 'EUR' ? enCop / t.eur : enCop;
}
export const tasaDe = (moneda: string, t: Tasas) => (moneda === 'USD' ? t.usd : moneda === 'EUR' ? t.eur : 1);

/** = wf_cop_movimiento: valor en COP con la tasa guardada en el movimiento (ajustes negativos restan). */
export function copMovimiento(m: { monto: number; moneda?: string; tasa_cop?: number | null; tipo: string; monto_aplicado?: number | null }, t: Tasas): number {
  return Number(m.monto) * (m.tasa_cop ?? tasaDe(m.moneda || 'COP', t)) * (m.tipo === 'ajuste' && Number(m.monto_aplicado || 0) < 0 ? -1 : 1);
}

/** = wf_sin_ids: quita UUIDs de un texto. */
export const sinIds = (s: string | null | undefined) => (s == null ? s : s.replace(/[0-9a-fA-F]{8}-[0-9a-fA-F-]{2,}/g, '[id]'));

export const esUuid = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-fA-F-]{8,64}$/.test(s);
export const texto = (v: unknown, max = 500): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
