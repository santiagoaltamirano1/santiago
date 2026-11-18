// Lumi Finance · Tasas de cambio (antes: wf_actualizar_tasas + wf_registrar_trm + wf_refrescar_tasa_del_dia + pg_cron).
// En Google no hay tareas programadas: el servidor actualiza "cuando se necesita".
//   · Si la última consulta tiene más de 1 hora, la próxima petición dispara la actualización (una a la vez).
//   · USD: TRM oficial (Superfinanciera, datos.gov.co). EUR: BCE (EUR→USD) × TRM de ese día.
//   · Un valor raro se descarta (fuera de 1.000–15.000 o salto > 15 % frente al anterior).
// Colecciones: tasas/{moneda_fecha_fuente}  ·  sistema/config (tasas de HOY que usan los cálculos)  ·  sistema/tasas_estado
import { colTasas, docConfig, docEstadoTasas } from './firebase';
import { hoyBogota, r2 } from './util';

const URL_TRM = 'https://www.datos.gov.co/resource/32sa-8pi3.json?$order=vigenciadesde%20DESC&$limit=10';
const URL_EUR = 'https://api.frankfurter.app/latest?from=EUR&to=USD';
const FUENTE_TRM = 'TRM Superfinanciera';
const FUENTE_EUR = 'BCE × TRM';
const UNA_HORA = 3600e3;

export interface Tasa { moneda: 'USD' | 'EUR'; cop_por_unidad: number; vigente_desde: string; vigente_hasta: string | null; fuente: string; consultado_en: string }
export interface TasaVigente extends Tasa { proxima: boolean }

const idTasa = (moneda: string, desde: string, fuente: string) => `${moneda}_${desde}_${fuente === FUENTE_TRM ? 'TRM' : 'BCE'}`;

async function getJson(url: string, intentos = 3): Promise<any> {
  let ultimo = '';
  for (let i = 1; i <= intentos; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (r.ok) return await r.json();
      ultimo = `HTTP ${r.status}`;
    } catch (e: any) { ultimo = e?.message || String(e); }
    await new Promise((res) => setTimeout(res, 1000 * i));
  }
  throw new Error(`${ultimo} (tras ${intentos} intentos)`);
}

async function todas(moneda: 'USD' | 'EUR'): Promise<Tasa[]> {
  const s = await colTasas().where('moneda', '==', moneda).get();
  return s.docs.map((d) => d.data() as Tasa).sort((a, b) => a.vigente_desde.localeCompare(b.vigente_desde));
}

/** = wf_tasas_vigentes: USD y EUR vigentes hoy, y la próxima TRM si ya se publicó. */
export async function tasasVigentes(): Promise<TasaVigente[]> {
  const hoy = hoyBogota();
  const [usd, eur] = await Promise.all([todas('USD'), todas('EUR')]);
  const ultimaHasta = (l: Tasa[]) => [...l].reverse().find((t) => t.vigente_desde <= hoy);
  const out: TasaVigente[] = [];
  const u = ultimaHasta(usd.filter((t) => t.fuente.startsWith('TRM')));
  if (u) out.push({ ...u, proxima: false });
  const e = ultimaHasta(eur.filter((t) => t.fuente === FUENTE_EUR));
  if (e) out.push({ ...e, proxima: false });
  const prox = usd.find((t) => t.fuente.startsWith('TRM') && t.vigente_desde > hoy);
  if (prox) out.push({ ...prox, proxima: true });
  return out;
}

async function anotarIntento(fuente: string, ok: boolean, detalle: string) {
  const ref = docEstadoTasas();
  const s = await ref.get();
  const intentos = [{ cuando: new Date().toISOString(), fuente, ok, detalle }, ...((s.data()?.intentos as any[]) || [])].slice(0, 40);
  await ref.set({ intentos }, { merge: true });
}

/** = wf_registrar_trm */
async function registrarTrm(filas: any[]): Promise<number> {
  const usd = await todas('USD');
  let n = 0;
  const orden = [...filas].sort((a, b) => String(a.vigenciadesde).localeCompare(String(b.vigenciadesde)));
  for (const f of orden) {
    const valor = Number(f.valor);
    const desde = String(f.vigenciadesde || '').slice(0, 10);
    const hasta = f.vigenciahasta ? String(f.vigenciahasta).slice(0, 10) : null;
    const previa = [...usd].reverse().find((t) => t.vigente_desde < desde)?.cop_por_unidad;
    if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(desde) || valor < 1000 || valor > 15000 || (previa && Math.abs(valor - previa) / previa > 0.15)) {
      await anotarIntento('TRM', false, `valor descartado ${valor} para ${desde} (anterior ${previa ?? '—'})`);
      continue;
    }
    const t: Tasa = { moneda: 'USD', cop_por_unidad: valor, vigente_desde: desde, vigente_hasta: hasta, fuente: FUENTE_TRM, consultado_en: new Date().toISOString() };
    await colTasas().doc(idTasa('USD', desde, FUENTE_TRM)).set(t);
    usd.push(t); usd.sort((a, b) => a.vigente_desde.localeCompare(b.vigente_desde));
    n++;
  }
  return n;
}

/** = wf_refrescar_tasa_del_dia: copia a sistema/config las tasas vigentes hoy. */
export async function refrescarTasaDelDia() {
  const v = await tasasVigentes();
  const usd = v.find((t) => t.moneda === 'USD' && !t.proxima);
  const eur = v.find((t) => t.moneda === 'EUR' && !t.proxima);
  if (usd) {
    const previa = (await docConfig().get()).data() || {};
    await docConfig().set({
      usd_cop: r2(usd.cop_por_unidad), eur_cop: eur ? r2(eur.cop_por_unidad) : previa.eur_cop ?? 4450,
      fuente: FUENTE_TRM + (eur ? ' · EUR: ' + FUENTE_EUR : ''), updated_at: new Date().toISOString(),
    }, { merge: true });
  }
  return { hoy: hoyBogota(), usd: usd?.cop_por_unidad ?? null, eur: eur?.cop_por_unidad ?? null };
}

/** = wf_actualizar_tasas */
export async function actualizarTasas() {
  const res: Record<string, unknown> = {};
  try {
    const n = await registrarTrm(await getJson(URL_TRM));
    await anotarIntento('TRM', true, `${n} valores`);
    res.trm = n;
  } catch (e: any) {
    await anotarIntento('TRM', false, e.message); res.trm_error = e.message;
  }
  try {
    const j = await getJson(URL_EUR);
    const eurUsd = Number(j?.rates?.USD);
    const fecha = String(j?.date || '').slice(0, 10);
    if (!(eurUsd >= 0.5 && eurUsd <= 2)) throw new Error(`USD por EUR fuera de rango: ${eurUsd}`);
    const usdEnFecha = [...(await todas('USD'))].reverse().find((t) => t.fuente.startsWith('TRM') && t.vigente_desde <= fecha)?.cop_por_unidad;
    if (!usdEnFecha) throw new Error(`no hay TRM para ${fecha}`);
    const valor = Math.round(eurUsd * usdEnFecha * 1e4) / 1e4;
    await colTasas().doc(idTasa('EUR', fecha, FUENTE_EUR)).set({ moneda: 'EUR', cop_por_unidad: valor, vigente_desde: fecha, vigente_hasta: null, fuente: FUENTE_EUR, consultado_en: new Date().toISOString() });
    await anotarIntento('EUR', true, `${eurUsd} USD/EUR del ${fecha} × TRM ${usdEnFecha}`);
    res.eur = r2(valor);
  } catch (e: any) {
    await anotarIntento('EUR', false, e.message); res.eur_error = e.message;
  }
  Object.assign(res, await refrescarTasaDelDia());
  await docEstadoTasas().set({ ultima_consulta: new Date().toISOString() }, { merge: true });
  return res;
}

let enCurso: Promise<unknown> | null = null;
/** Actualiza si la última consulta tiene más de 1 hora (o si cambió el día en Bogotá). Nunca dos a la vez. */
export async function asegurarTasasFrescas(): Promise<void> {
  if (process.env.TASAS_DESACTIVADAS === '1') return;
  if (enCurso) { await enCurso; return; }
  const est = (await docEstadoTasas().get()).data() || {};
  const ultima = est.ultima_consulta ? new Date(est.ultima_consulta).getTime() : 0;
  const cambioDia = ultima && hoyBogota(new Date(ultima)) !== hoyBogota();
  if (Date.now() - ultima < UNA_HORA && !cambioDia) return;
  enCurso = actualizarTasas().catch((e) => console.error('[tasas]', e)).finally(() => { enCurso = null; });
  await enCurso;
}
