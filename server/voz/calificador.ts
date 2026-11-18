// Iteración 2 · F6 · Calificador del set de voz (MESA_VOZ_v2.md §1).
// Lo usa el servidor (/api/dev/evaluar-voz) y scripts/calificar-voz.ts (califica un JSON guardado).
// Umbral para aceptar una versión: monto, tipo y cantidad ≥ 97 %; promedio por campo ≥ 92 %; ≥ 24 de 30 perfectas;
// CERO dudas esperadas resueltas en silencio; latencia p95 ≤ 4 s. Cada versión se juzga por su PEOR corrida.
import { SET_EVAL, type Esperado } from './eval_set.ts';

export interface FilaEval { version: string; n: number; intento: number; movimientos: any[] | null; aclaracion: string | null; ms: number | null; tokens_entrada: number | null; tokens_salida: number | null; error: string | null }

const CAMPOS = ['cantidad', 'tipo', 'monto', 'moneda', 'cuenta', 'destino', 'categoria', 'meta', 'deuda', 'fecha', 'fuente'] as const;
type Campo = (typeof CAMPOS)[number];

const tipoOk = (e: Esperado, t: string) => (Array.isArray(e.tipo) ? e.tipo.includes(t) : e.tipo === t);
const montoOk = (e: Esperado, m: number) => Math.abs((Number(m) || 0) - e.monto) <= Math.max(0.5, e.monto * 0.001);
const igualONulo = (esperado: unknown, real: unknown) => (esperado === undefined ? true : (esperado ?? null) === (real ?? null));

export function calificarCaso(n: number, movs: any[] | null, version: string) {
  const caso = SET_EVAL.find((c) => c.n === n)!;
  const reales = Array.isArray(movs) ? movs : [];
  const r: Record<Campo, { ok: number; total: number }> = Object.fromEntries(CAMPOS.map((c) => [c, { ok: 0, total: 0 }])) as any;
  const sumar = (c: Campo, ok: boolean) => { r[c].total++; if (ok) r[c].ok++; };
  const fallas: string[] = [];
  sumar('cantidad', reales.length === caso.esperado.length);
  if (reales.length !== caso.esperado.length) fallas.push(`cantidad ${reales.length} ≠ ${caso.esperado.length}`);

  // Emparejar: primero por tipo+monto, después lo que sobre en orden
  const libres = reales.map((_, i) => i);
  const pareja = caso.esperado.map((e) => {
    const k = libres.findIndex((i) => tipoOk(e, reales[i].tipo) && montoOk(e, reales[i].monto));
    return k >= 0 ? libres.splice(k, 1)[0] : -1;
  });
  pareja.forEach((p, j) => { if (p < 0 && libres.length) pareja[j] = libres.shift()!; });

  let silencio = false;
  caso.esperado.forEach((e, j) => {
    const m = pareja[j] >= 0 ? reales[pareja[j]] : null;
    const chk = (c: Campo, ok: boolean, txt: string) => { sumar(c, !!m && ok); if (!(m && ok)) fallas.push(`#${j + 1} ${c}: ${txt}`); };
    chk('tipo', !!m && tipoOk(e, m.tipo), `${m?.tipo} ≠ ${e.tipo}`);
    chk('monto', !!m && montoOk(e, m.monto), `${m?.monto} ≠ ${e.monto}`);
    chk('moneda', !!m && (m.moneda || 'COP') === (e.moneda || 'COP'), `${m?.moneda} ≠ ${e.moneda || 'COP'}`);
    if (e.cuenta !== undefined) chk('cuenta', !!m && igualONulo(e.cuenta, m.cuenta_id), `${m?.cuenta_id} ≠ ${e.cuenta}`);
    if (e.destino !== undefined) chk('destino', !!m && igualONulo(e.destino, m.destino_cuenta_id), `${m?.destino_cuenta_id} ≠ ${e.destino}`);
    if (e.categoria !== undefined) {
      const acepta = Array.isArray(e.categoria) ? e.categoria : [e.categoria];
      chk('categoria', !!m && acepta.includes(m.categoria_id ?? null), `${m?.categoria_id} ∉ ${JSON.stringify(acepta)}`);
    }
    if (e.meta !== undefined) chk('meta', !!m && igualONulo(e.meta, m.meta_id), `${m?.meta_id} ≠ ${e.meta}`);
    if (e.deuda !== undefined) chk('deuda', !!m && igualONulo(e.deuda, m.deuda_id), `${m?.deuda_id} ≠ ${e.deuda}`);
    const fechaReal = m?.fecha && m.fecha !== '2026-11-18' ? m.fecha : null;
    chk('fecha', !!m && (e.fecha ?? null) === fechaReal, `${m?.fecha} ≠ ${e.fecha ?? 'hoy'}`);
    if (version !== 'voz-v1') chk('fuente', !!m && !!m.fuente, 'texto_fuente no ubicado');
    // Duda esperada: debe preguntar por alguno de esos campos
    const debe = caso.dudas?.[j];
    if (debe) {
      const pregunto = !!m && Array.isArray(m.dudas) && m.dudas.some((d: any) => debe.includes(d.campo));
      if (!pregunto) { silencio = true; fallas.push(`#${j + 1} resolvió en silencio (debía preguntar por ${debe.join(' o ')})`); }
    }
  });
  const camposOk = CAMPOS.every((c) => r[c].ok === r[c].total);
  return { n, r, perfecta: camposOk && !silencio, silencio, fallas };
}

export function calificarCorrida(filas: FilaEval[], version: string) {
  const casos = SET_EVAL.map((c) => {
    const f = filas.find((x) => x.n === c.n);
    return { ...calificarCaso(c.n, f?.error ? null : f?.movimientos ?? null, version), error: f?.error ?? (f ? null : 'sin resultado'), ms: f?.ms ?? null, tin: f?.tokens_entrada ?? 0, tout: f?.tokens_salida ?? 0 };
  });
  const pct = (c: Campo) => { const ok = casos.reduce((a, x) => a + x.r[c].ok, 0), t = casos.reduce((a, x) => a + x.r[c].total, 0); return t ? ok / t : 1; };
  const porCampo = Object.fromEntries(CAMPOS.filter((c) => version !== 'voz-v1' || c !== 'fuente').map((c) => [c, pct(c)])) as Record<Campo, number>;
  const promedio = Object.values(porCampo).reduce((a, b) => a + b, 0) / Object.values(porCampo).length;
  const ms = casos.map((x) => x.ms).filter((x): x is number => x !== null).sort((a, b) => a - b);
  const p95 = ms.length ? ms[Math.min(ms.length - 1, Math.ceil(0.95 * ms.length) - 1)] : null;
  return {
    porCampo, promedio, perfectas: casos.filter((x) => x.perfecta).length, silencios: casos.filter((x) => x.silencio).map((x) => x.n),
    errores: casos.filter((x) => x.error).map((x) => x.n), p95, tokensEntrada: casos.reduce((a, x) => a + x.tin, 0) / casos.length, tokensSalida: casos.reduce((a, x) => a + x.tout, 0) / casos.length,
    fallas: casos.filter((x) => x.fallas.length).map((x) => `${x.n}. ${x.fallas.join('; ')}`),
  };
}

export function veredicto(c: ReturnType<typeof calificarCorrida>) {
  const reglas = [
    { regla: 'monto ≥ 97 %', ok: c.porCampo.monto >= 0.97 },
    { regla: 'tipo ≥ 97 %', ok: c.porCampo.tipo >= 0.97 },
    { regla: 'cantidad ≥ 97 %', ok: c.porCampo.cantidad >= 0.97 },
    { regla: 'promedio por campo ≥ 92 %', ok: c.promedio >= 0.92 },
    { regla: '≥ 24 de 30 perfectas', ok: c.perfectas >= 24 },
    { regla: 'cero dudas resueltas en silencio', ok: c.silencios.length === 0 },
    { regla: 'latencia p95 ≤ 4 s', ok: c.p95 !== null && c.p95 <= 4000 },
    { regla: 'sin errores de la IA', ok: c.errores.length === 0 },
  ];
  return { aprobada: reglas.every((r) => r.ok), reglas };
}
