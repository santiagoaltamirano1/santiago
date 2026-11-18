// Lumi Finance · Voz: organizar lo que dijo la persona, cerrar la captura y medir el prompt.
// (antes: Edge Function interpretar-movimientos + RPC wf_ia_cerrar_captura + Edge Function evaluar-voz)
// La IA SOLO organiza. Nada se guarda como movimiento aquí: la app lo confirma y lo envía a /api/movimientos.
import { randomUUID } from 'node:crypto';
import { firebase, col } from '../firebase';
import { falla, hoyBogota } from '../util';
import { esquema, instrucciones, validar, VERSION_VOZ_PRODUCCION, type Contexto, type VersionVoz } from './prompt';
import { pedirJson } from './gemini';
import { SET_EVAL, CTX_EVAL, HOY_EVAL, CUENTA_DEFECTO_EVAL } from './eval_set';
import { calificarCorrida, veredicto, type FilaEval } from './calificador';

const MAX_TEXTO = 1500;
const MAX_CAPTURAS_10_MIN = 30;

async function contexto(uid: string): Promise<Contexto> {
  const activos = async (c: 'cuentas' | 'categorias' | 'metas' | 'deudas') =>
    (await col(uid, c).where('is_active', '==', true).get()).docs.map((d) => d.data());
  const [cu, ca, me, de] = await Promise.all([activos('cuentas'), activos('categorias'), activos('metas'), activos('deudas')]);
  return {
    cuentas: cu.map((c) => ({ id: c.id, nombre: c.nombre, tipo: c.tipo, moneda: c.moneda })),
    categorias: ca.map((c) => ({ id: c.id, nombre: c.nombre, tipo: c.tipo, supercategoria: c.supercategoria ?? null })),
    metas: me.map((m) => ({ id: m.id, nombre: m.nombre })),
    deudas: de.filter((d) => d.estado === 'activa').map((d) => ({
      id: d.id, contraparte: d.contraparte, concepto: d.concepto ?? null, moneda: d.moneda,
      relacion: d.tipo === 'por_cobrar' ? 'me debe' : 'le debo', pendiente: Number(d.monto_total) - Number(d.monto_pagado),
    })),
  };
}

export async function interpretar(uid: string, b: any) {
  const texto = String(b?.texto || '').trim().slice(0, MAX_TEXTO);
  if (texto.length < 3) falla('TEXTO_CORTO', 'Dime qué quieres anotar.');
  const dictado = typeof b?.texto_dictado === 'string' ? b.texto_dictado.trim().slice(0, MAX_TEXTO) : null;
  const transcriptor = ['web_speech', 'teclado', 'servidor'].includes(b?.transcriptor) ? b.transcriptor : 'web_speech';
  const hoy = /^\d{4}-\d{2}-\d{2}$/.test(b?.hoy || '') ? b.hoy : hoyBogota();

  // Límite de uso por persona (protege el saldo de la IA)
  const hace10 = new Date(Date.now() - 10 * 60e3).toISOString();
  const recientes = await col(uid, 'capturas').where('creado_en', '>=', hace10).count().get();
  if (recientes.data().count >= MAX_CAPTURAS_10_MIN) falla('DEMASIADOS_INTENTOS', 'Muchos intentos seguidos. Espera unos minutos.', 429);

  const ctx = await contexto(uid);
  const cuentaDefecto = typeof b?.cuenta_por_defecto === 'string' ? b.cuenta_por_defecto : null;
  const nombreDefecto = ctx.cuentas.find((c) => c.id === cuentaDefecto)?.nombre || null;
  const id = randomUUID();
  const base = {
    id, user_id: uid, texto, texto_dictado: dictado && dictado !== texto ? dictado : null, transcriptor,
    version_prompt: VERSION_VOZ_PRODUCCION, creado_en: new Date().toISOString(), confirmado: null, correcciones: null, cerrada_en: null,
  };
  try {
    const { modelo, salida, metricas } = await pedirJson(instrucciones(VERSION_VOZ_PRODUCCION, ctx, hoy, nombreDefecto), texto, esquema(VERSION_VOZ_PRODUCCION).schema);
    const movimientos = validar(salida, ctx, cuentaDefecto, VERSION_VOZ_PRODUCCION, texto, hoy);
    await col(uid, 'capturas').doc(id).set({
      ...base, respuesta: { ...salida, validados: movimientos }, modelo, estado: 'interpretada',
      metricas: { ...metricas, movimientos: movimientos.length, fuentes_ubicadas: movimientos.filter((m: any) => m.fuente).length },
    });
    return { captura_id: id, modelo, version_prompt: VERSION_VOZ_PRODUCCION, movimientos, aclaracion: salida?.aclaracion ?? null };
  } catch (e: any) {
    console.error('[voz]', e?.message || e);
    await col(uid, 'capturas').doc(id).set({ ...base, respuesta: { error: String(e?.message || e) }, modelo: null, estado: 'error', metricas: {} }).catch(() => undefined);
    return falla('IA_FALLO', 'No pudimos organizar el texto. Intenta otra vez o anótalo a mano.', 502);
  }
}

/** = wf_ia_cerrar_captura: guarda lo que la persona confirmó y calcula qué corrigió frente a la IA. Idempotente. */
export async function cerrarCaptura(uid: string, capturaId: string, confirmados: unknown) {
  if (!Array.isArray(confirmados) || confirmados.length > 30 || JSON.stringify(confirmados).length > 50000) falla('CONFIRMADOS_INVALIDOS', 'lista muy grande o mal formada');
  const ref = col(uid, 'capturas').doc(capturaId);
  const campos = ['tipo', 'monto', 'cuenta_id', 'destino_cuenta_id', 'categoria_id', 'meta_id', 'deuda_id', 'fecha'];
  return firebase().db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists) falla('CAPTURA_AJENA', 'esa captura no es tuya', 403);
    const cap = s.data()!;
    if (cap.cerrada_en) return { ya_cerrada: true, correcciones: (cap.correcciones || []).length };
    const validados: any[] = cap.respuesta?.validados || [];
    const corr: any[] = [];
    for (const c of confirmados as any[]) {
      if (typeof c?.i === 'number') {
        const ia = validados[c.i];
        if (!ia) continue;
        if (c.incluido === false) { corr.push({ i: c.i, campo: 'quitado' }); continue; }
        for (const campo of campos) {
          const distinto = campo === 'monto'
            ? Math.abs((Number(c[campo]) || 0) - (Number(ia[campo]) || 0)) > 0.005
            : String(c[campo] ?? '') !== String(ia[campo] ?? '');
          if (distinto) corr.push({ i: c.i, campo, ia: ia[campo] ?? null, persona: c[campo] ?? null });
        }
      } else corr.push({ i: null, campo: 'agregado' });
    }
    tx.update(ref, { confirmado: confirmados, correcciones: corr, cerrada_en: new Date().toISOString(), metricas: { ...(cap.metricas || {}), correcciones: corr.length } });
    return { ya_cerrada: false, correcciones: corr.length };
  });
}

/** Corre el set de 30 frases contra el modelo actual y lo califica. Solo si EVAL_VOZ=1 (gasta saldo de la IA). */
export async function evaluarVoz(version: VersionVoz = VERSION_VOZ_PRODUCCION, intentos = 1) {
  if (process.env.EVAL_VOZ !== '1') falla('NO_DISPONIBLE', 'activa el secreto EVAL_VOZ=1 para medir la voz', 404);
  const nombreDefecto = CTX_EVAL.cuentas.find((c) => c.id === CUENTA_DEFECTO_EVAL)?.nombre || null;
  const sistema = instrucciones(version, CTX_EVAL, HOY_EVAL, nombreDefecto);
  const filas: FilaEval[] = [];
  const corridas = [];
  for (let intento = 1; intento <= Math.min(Math.max(1, intentos), 3); intento++) {
    const delIntento: FilaEval[] = [];
    // 5 a la vez para no pasar los límites de la IA
    for (let k = 0; k < SET_EVAL.length; k += 5) {
      await Promise.all(SET_EVAL.slice(k, k + 5).map(async (c) => {
        try {
          const r = await pedirJson(sistema, c.frase, esquema(version).schema);
          delIntento.push({ version, n: c.n, intento, movimientos: validar(r.salida, CTX_EVAL, CUENTA_DEFECTO_EVAL, version, c.frase, HOY_EVAL), aclaracion: r.salida?.aclaracion ?? null, ms: r.metricas.ms, tokens_entrada: r.metricas.tokens_entrada, tokens_salida: r.metricas.tokens_salida, error: null });
        } catch (e: any) {
          delIntento.push({ version, n: c.n, intento, movimientos: null, aclaracion: null, ms: null, tokens_entrada: null, tokens_salida: null, error: String(e?.message || e) });
        }
      }));
    }
    filas.push(...delIntento);
    corridas.push(calificarCorrida(delIntento, version));
  }
  const peor = corridas.reduce((a, b) => (b.perfectas < a.perfectas || (b.perfectas === a.perfectas && b.promedio < a.promedio) ? b : a));
  return { version, corridas: corridas.map((c) => c.perfectas), veredicto: veredicto(peor), peor, filas };
}
