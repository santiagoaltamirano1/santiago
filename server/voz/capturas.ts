// Lumi Finance · Voz, parte del SERVIDOR: llama a Gemini con el prompt versionado y valida contra el contexto que manda la app.
// No toca Firestore (versión de prueba, Starter Tier). La captura la guarda la app (motor/voz.ts).
import { falla, hoyBogota } from '../../motor/util';
import { esquema, instrucciones, validar, VERSION_VOZ_PRODUCCION, type Contexto, type VersionVoz } from './prompt';
import { pedirJson } from './gemini';
import { SET_EVAL, CTX_EVAL, HOY_EVAL, CUENTA_DEFECTO_EVAL } from './eval_set';
import { calificarCorrida, veredicto, type FilaEval } from './calificador';

const lista = (v: unknown) => (Array.isArray(v) ? v.slice(0, 200) : []);

/** POST /api/voz/organizar · { texto, contexto, cuenta_por_defecto, hoy } → movimientos validados (nada se guarda aquí). */
export async function organizar(b: any) {
  const texto = String(b?.texto || '').trim().slice(0, 1500);
  if (texto.length < 3) falla('TEXTO_CORTO', 'Dime qué quieres anotar.');
  const ctx: Contexto = {
    cuentas: lista(b?.contexto?.cuentas), categorias: lista(b?.contexto?.categorias),
    metas: lista(b?.contexto?.metas), deudas: lista(b?.contexto?.deudas),
  };
  const hoy = /^\d{4}-\d{2}-\d{2}$/.test(b?.hoy || '') ? b.hoy : hoyBogota();
  const cuentaDefecto = typeof b?.cuenta_por_defecto === 'string' ? b.cuenta_por_defecto : null;
  const nombreDefecto = ctx.cuentas.find((c) => c.id === cuentaDefecto)?.nombre || null;
  try {
    const { modelo, salida, metricas } = await pedirJson(instrucciones(VERSION_VOZ_PRODUCCION, ctx, hoy, nombreDefecto), texto, esquema(VERSION_VOZ_PRODUCCION).schema);
    const movimientos = validar(salida, ctx, cuentaDefecto, VERSION_VOZ_PRODUCCION, texto, hoy);
    return { modelo, version_prompt: VERSION_VOZ_PRODUCCION, salida, movimientos, metricas };
  } catch (e: any) {
    console.error('[voz]', e?.message || e);
    return falla('IA_FALLO', 'No pudimos organizar el texto. Intenta otra vez o anótalo a mano.', 502);
  }
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
    for (let k = 0; k < SET_EVAL.length; k += 5) { // 5 a la vez para no pasar los límites de la IA
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
