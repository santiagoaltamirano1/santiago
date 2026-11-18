import { api } from './api';
import type { FxRates } from '../utils/fx';
export type { FxRates } from '../utils/fx';

// La tasa la consulta el SERVIDOR (TRM oficial y BCE; se actualiza sola si tiene más de 1 hora: server/tasas.ts).
// La app solo la lee con GET /api/tasas; no llama APIs externas ni escribe la configuración (E12).
// Si no hay conexión: última copia guardada en este navegador (con su fecha real, E44) → valor por defecto.
const LS_KEY = 'WEALTHFLOW_FX';
export const DEFAULT_USDCOP = 4100;
export const DEFAULT_EURCOP = 4450;

export function cachedFx(): FxRates {
  try {
    const r = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (r && r.usdCop > 0) return { ...r, respaldo: true };
  } catch { /* ignore */ }
  return { usdCop: DEFAULT_USDCOP, eurCop: DEFAULT_EURCOP, fuente: 'valor por defecto', updatedAt: 0, respaldo: true };
}

function saveCache(fx: FxRates) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ ...fx, respaldo: false })); } catch { /* ignore */ }
}

export async function fetchFx(): Promise<FxRates> {
  try {
    const data = await api<any[]>('GET', '/api/tasas');
    const filas = (data || []) as { moneda: string; cop_por_unidad: number; vigente_desde: string; vigente_hasta: string | null; fuente: string; consultado_en: string; proxima: boolean }[];
    const usd = filas.find((f) => f.moneda === 'USD' && !f.proxima);
    const eur = filas.find((f) => f.moneda === 'EUR' && !f.proxima);
    const prox = filas.find((f) => f.moneda === 'USD' && f.proxima);
    if (!usd) throw new Error('sin TRM');
    const fx: FxRates = {
      usdCop: Number(usd.cop_por_unidad),
      eurCop: eur ? Number(eur.cop_por_unidad) : cachedFx().eurCop,
      fuente: eur ? `${usd.fuente} · EUR: ${eur.fuente}` : usd.fuente,
      updatedAt: new Date(usd.consultado_en).getTime(),
      usdDesde: usd.vigente_desde,
      usdHasta: usd.vigente_hasta || undefined,
      eurDesde: eur?.vigente_desde,
      proximaTrm: prox ? { valor: Number(prox.cop_por_unidad), desde: prox.vigente_desde } : undefined,
      respaldo: false,
    };
    saveCache(fx);
    return fx;
  } catch {
    return cachedFx();
  }
}

// toCOP y convertir viven en utils/fx.ts (sin dependencias, igual que convertir() de server/util.ts).
export { toCOP, convertir } from '../utils/fx';
