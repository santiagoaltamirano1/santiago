// Lumi Finance · Tasas que usa el MOTOR para convertir monedas.
// Las consulta el servidor en vivo (GET /api/tasas: TRM oficial y BCE × TRM) y la app las guarda en este navegador.
// La app le indica al motor de dónde leerlas con usarTasas(); si no hay ninguna, se usan las tasas por defecto.
import { TASAS_POR_DEFECTO, type Tasas } from './util';

export interface TasaVigente { moneda: 'USD' | 'EUR'; cop_por_unidad: number; vigente_desde: string | null; vigente_hasta: string | null; fuente: string; consultado_en: string | null; proxima: boolean }

let proveedor: () => { tasas: Tasas; vigentes: TasaVigente[] } = () => ({ tasas: TASAS_POR_DEFECTO, vigentes: [] });
export const usarTasas = (fn: typeof proveedor) => { proveedor = fn; };

/** Tasas del día (COP por 1 USD y por 1 EUR). */
export async function tasasConfig(): Promise<Tasas> {
  const t = proveedor().tasas;
  return { usd: Number(t.usd) || TASAS_POR_DEFECTO.usd, eur: Number(t.eur) || TASAS_POR_DEFECTO.eur };
}
/** Lista para el documento de Exportar. */
export async function tasasVigentes(): Promise<TasaVigente[]> { return proveedor().vigentes; }
