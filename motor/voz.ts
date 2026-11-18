// Lumi Finance · Voz, parte del MOTOR (navegador): contexto de la persona, captura y cierre.
// La IA (Gemini) la llama el SERVIDOR (POST /api/voz/organizar), porque solo él tiene la llave.
import { col, transaccion, nuevoId } from './bd';
import { falla, hoyBogota } from './util';

const MAX_TEXTO = 1500;
const MAX_CAPTURAS_10_MIN = 30;

export interface ContextoVoz {
  cuentas: { id: string; nombre: string; tipo?: string; moneda?: string }[];
  categorias: { id: string; nombre: string; tipo: 'gasto' | 'ingreso'; supercategoria?: string | null }[];
  metas: { id: string; nombre: string }[];
  deudas: { id: string; contraparte: string; concepto?: string | null; moneda?: string; relacion: string; pendiente?: number }[];
}

export async function contextoVoz(uid: string): Promise<ContextoVoz> {
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

export interface RespuestaOrganizar { modelo: string; version_prompt: string; salida: any; movimientos: any[]; metricas: Record<string, unknown> }

/** Organiza lo que dijo la persona: arma el contexto, pide a la IA (organizar = llamada al servidor) y guarda la captura. */
export async function interpretar(uid: string, b: any, organizar: (cuerpo: unknown) => Promise<RespuestaOrganizar>) {
  const texto = String(b?.texto || '').trim().slice(0, MAX_TEXTO);
  if (texto.length < 3) falla('TEXTO_CORTO', 'Dime qué quieres anotar.');
  const dictado = typeof b?.texto_dictado === 'string' ? b.texto_dictado.trim().slice(0, MAX_TEXTO) : null;
  const transcriptor = ['web_speech', 'teclado', 'servidor'].includes(b?.transcriptor) ? b.transcriptor : 'web_speech';
  const hoy = /^\d{4}-\d{2}-\d{2}$/.test(b?.hoy || '') ? b.hoy : hoyBogota();
  const hace10 = new Date(Date.now() - 10 * 60e3).toISOString();
  const recientes = await col(uid, 'capturas').where('creado_en', '>=', hace10).count().get();
  if (recientes.data().count >= MAX_CAPTURAS_10_MIN) falla('DEMASIADOS_INTENTOS', 'Muchos intentos seguidos. Espera unos minutos.', 429);

  const contexto = await contextoVoz(uid);
  const cuentaDefecto = typeof b?.cuenta_por_defecto === 'string' ? b.cuenta_por_defecto : null;
  const id = nuevoId();
  const base = {
    id, user_id: uid, texto, texto_dictado: dictado && dictado !== texto ? dictado : null, transcriptor,
    creado_en: new Date().toISOString(), confirmado: null, correcciones: null, cerrada_en: null,
  };
  let r: RespuestaOrganizar;
  try {
    r = await organizar({ texto, contexto, cuenta_por_defecto: cuentaDefecto, hoy });
  } catch (e: any) {
    await col(uid, 'capturas').doc(id).set({ ...base, version_prompt: null, respuesta: { error: String(e?.message || e) }, modelo: null, estado: 'error', metricas: {} }).catch(() => undefined);
    return falla('IA_FALLO', 'No pudimos organizar el texto. Intenta otra vez o anótalo a mano.', 502);
  }
  await col(uid, 'capturas').doc(id).set({
    ...base, version_prompt: r.version_prompt, respuesta: { ...r.salida, validados: r.movimientos }, modelo: r.modelo, estado: 'interpretada',
    metricas: { ...r.metricas, movimientos: r.movimientos.length, fuentes_ubicadas: r.movimientos.filter((m: any) => m.fuente).length },
  });
  return { captura_id: id, modelo: r.modelo, version_prompt: r.version_prompt, movimientos: r.movimientos, aclaracion: r.salida?.aclaracion ?? null };
}

/** = wf_ia_cerrar_captura: guarda lo que la persona confirmó y calcula qué corrigió frente a la IA. Idempotente. */
export async function cerrarCaptura(uid: string, capturaId: string, confirmados: unknown) {
  if (!Array.isArray(confirmados) || confirmados.length > 30 || JSON.stringify(confirmados).length > 50000) falla('CONFIRMADOS_INVALIDOS', 'lista muy grande o mal formada');
  if (!capturaId) falla('CAPTURA_AJENA', 'esa captura no es tuya', 403);
  const ref = col(uid, 'capturas').doc(capturaId);
  const campos = ['tipo', 'monto', 'cuenta_id', 'destino_cuenta_id', 'categoria_id', 'meta_id', 'deuda_id', 'fecha'];
  return transaccion(async (tx) => {
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
