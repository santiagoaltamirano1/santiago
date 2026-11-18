// Lumi Finance · Tasas de cambio EN VIVO (versión de prueba: no se guardan en Firestore).
//   USD: TRM oficial (Superfinanciera, datos.gov.co). EUR: BCE (EUR→USD) × TRM de ese día.
//   Se guardan en memoria del servidor 1 hora. Un valor raro se descarta (fuera de 1.000–15.000 o salto > 15 %).
import { hoyBogota } from '../motor/util';
import type { TasaVigente } from '../motor/tasas';

const URL_TRM = 'https://www.datos.gov.co/resource/32sa-8pi3.json?$order=vigenciadesde%20DESC&$limit=10';
const URL_EUR = 'https://api.frankfurter.app/latest?from=EUR&to=USD';
const UNA_HORA = 3600e3;

async function getJson(url: string, intentos = 3): Promise<any> {
  let ultimo = '';
  for (let i = 1; i <= intentos; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (r.ok) return await r.json();
      ultimo = `HTTP ${r.status}`;
    } catch (e: any) { ultimo = e?.message || String(e); }
    await new Promise((res) => setTimeout(res, 800 * i));
  }
  throw new Error(`${ultimo} (tras ${intentos} intentos)`);
}

interface Trm { valor: number; desde: string; hasta: string | null }

/** Valores de la TRM ordenados por fecha, sin los raros (= wf_registrar_trm). */
export function filtrarTrm(filas: any[]): Trm[] {
  const ok: Trm[] = [];
  const orden = [...(filas || [])].sort((a, b) => String(a.vigenciadesde).localeCompare(String(b.vigenciadesde)));
  for (const f of orden) {
    const valor = Number(f.valor);
    const desde = String(f.vigenciadesde || '').slice(0, 10);
    const previa = ok[ok.length - 1]?.valor;
    if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(desde) || valor < 1000 || valor > 15000 || (previa && Math.abs(valor - previa) / previa > 0.15)) continue;
    ok.push({ valor, desde, hasta: f.vigenciahasta ? String(f.vigenciahasta).slice(0, 10) : null });
  }
  return ok;
}

/** Arma la lista vigente: USD de hoy, EUR (BCE × TRM) y la próxima TRM si ya salió. */
export function armarVigentes(trm: Trm[], eurUsd: number | null, fechaBce: string | null, hoy = hoyBogota(), ahora = new Date().toISOString()): TasaVigente[] {
  const out: TasaVigente[] = [];
  const usd = [...trm].reverse().find((t) => t.desde <= hoy);
  if (usd) out.push({ moneda: 'USD', cop_por_unidad: usd.valor, vigente_desde: usd.desde, vigente_hasta: usd.hasta, fuente: 'TRM Superfinanciera', consultado_en: ahora, proxima: false });
  if (eurUsd && eurUsd >= 0.5 && eurUsd <= 2 && fechaBce) {
    const base = [...trm].reverse().find((t) => t.desde <= fechaBce);
    if (base) out.push({ moneda: 'EUR', cop_por_unidad: Math.round(eurUsd * base.valor * 1e4) / 1e4, vigente_desde: fechaBce, vigente_hasta: null, fuente: 'BCE × TRM', consultado_en: ahora, proxima: false });
  }
  const prox = trm.find((t) => t.desde > hoy);
  if (prox) out.push({ moneda: 'USD', cop_por_unidad: prox.valor, vigente_desde: prox.desde, vigente_hasta: prox.hasta, fuente: 'TRM Superfinanciera', consultado_en: ahora, proxima: true });
  return out;
}

let cache: { cuando: number; dia: string; tasas: TasaVigente[] } | null = null;
let enCurso: Promise<TasaVigente[]> | null = null;

/** GET /api/tasas. Si falla internet, devuelve lo último que tenga (o lista vacía: la app usa su copia o el valor por defecto). */
export async function tasasVigentes(): Promise<TasaVigente[]> {
  if (process.env.TASAS_DESACTIVADAS === '1') return cache?.tasas ?? [];
  if (cache && Date.now() - cache.cuando < UNA_HORA && cache.dia === hoyBogota()) return cache.tasas;
  if (enCurso) return enCurso;
  enCurso = (async () => {
    try {
      const [trm, eur] = await Promise.allSettled([getJson(URL_TRM), getJson(URL_EUR)]);
      const lista = filtrarTrm(trm.status === 'fulfilled' ? trm.value : []);
      const j = eur.status === 'fulfilled' ? eur.value : null;
      const tasas = armarVigentes(lista, j ? Number(j?.rates?.USD) : null, j ? String(j?.date || '').slice(0, 10) : null);
      if (tasas.length) cache = { cuando: Date.now(), dia: hoyBogota(), tasas };
      return tasas.length ? tasas : cache?.tasas ?? [];
    } finally { enCurso = null; }
  })();
  return enCurso;
}
