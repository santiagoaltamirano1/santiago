// Conversión de monedas sin dependencias (espejo de convertir() de server/util.ts). Moneda base: COP.

export interface FxRates {
  usdCop: number;   // cuántos COP vale 1 USD (TRM vigente hoy)
  eurCop: number;   // cuántos COP vale 1 EUR (BCE × TRM)
  fuente: string;   // de dónde salió la tasa
  updatedAt: number; // cuándo la consultó el SERVIDOR (ms); 0 = nunca (valor por defecto)
  usdDesde?: string; // vigencia de la TRM (YYYY-MM-DD)
  usdHasta?: string;
  eurDesde?: string;
  proximaTrm?: { valor: number; desde: string }; // TRM ya publicada para un día siguiente
  respaldo?: boolean; // true si no se pudo consultar al servidor y se usa la copia guardada o el valor por defecto
}

const dia = (iso: string) => new Date(iso + 'T12:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
const pesos = (v: number) => '$' + v.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "TRM $3.316,70 · vigente del 14 nov al 17 nov" */
export function describirTrm(fx: FxRates): string {
  if (!fx.updatedAt) return `Tasa aproximada ${pesos(fx.usdCop)} (sin conexión con la TRM)`;
  const vig = fx.usdDesde
    ? fx.usdHasta && fx.usdHasta !== fx.usdDesde ? ` · vigente del ${dia(fx.usdDesde)} al ${dia(fx.usdHasta)}` : ` · vigente el ${dia(fx.usdDesde)}`
    : '';
  return `TRM ${pesos(fx.usdCop)}${vig}`;
}

/** "Actualizada hoy 5:30 p. m." (cuándo la consultó el servidor) */
export function describirConsulta(fx: FxRates): string {
  if (!fx.updatedAt) return 'Sin actualizar';
  const f = new Date(fx.updatedAt);
  const hoy = new Date().toDateString() === f.toDateString();
  const hora = f.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  return `${fx.respaldo ? 'Última tasa guardada · ' : ''}Actualizada ${hoy ? 'hoy' : f.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} ${hora}`;
}

/** Convierte un monto de su moneda a COP usando las tasas dadas. */
export function toCOP(monto: number, moneda: string | undefined, fx: FxRates): number {
  if (!moneda || moneda === 'COP') return monto;
  if (moneda === 'USD') return monto * fx.usdCop;
  if (moneda === 'EUR') return monto * fx.eurCop;
  return monto;
}

/** Convierte entre dos monedas cualesquiera (vía COP). */
export function convertir(monto: number, desde: string, hacia: string, fx: FxRates): number {
  const enCOP = toCOP(monto, desde, fx);
  if (!hacia || hacia === 'COP') return enCOP;
  if (hacia === 'USD') return enCOP / fx.usdCop;
  if (hacia === 'EUR') return enCOP / fx.eurCop;
  return enCOP;
}
