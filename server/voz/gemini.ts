// Lumi Finance · Llamada a Gemini con salida estructurada.
// La llave GEMINI_API_KEY la pone AI Studio como secreto del servidor: nunca llega al navegador.
// Modelo: GEMINI_MODELO (opcional). Si un modelo falla, se prueba el siguiente de la lista.
// Formato de la respuesta: primero JSON Schema (responseJsonSchema); si el modelo lo rechaza, el formato
// clásico de Gemini (responseSchema con nullable). Sin "pensar" (más rápido); si el modelo lo exige, pensando.
import { GoogleGenAI } from '@google/genai';

const MODELO_POR_DEFECTO = 'gemini-2.5-flash';
export const modelos = () => [...new Set([process.env.GEMINI_MODELO, MODELO_POR_DEFECTO, 'gemini-flash-latest'].filter(Boolean) as string[])];

type Cliente = Pick<GoogleGenAI, 'models'>;
let cliente: Cliente | null = null;
const ia = (): Cliente => {
  if (cliente) return cliente;
  if (!process.env.GEMINI_API_KEY) throw new Error('IA_SIN_CONFIGURAR: falta GEMINI_API_KEY');
  return (cliente = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }));
};
/** Solo para pruebas: reemplaza a Gemini por un cliente simulado. */
export const usarClienteDePrueba = (c: Cliente | null) => { cliente = c; };

/** JSON Schema → JSON Schema que acepta Gemini: `type: [t, "null"]` pasa a anyOf y se fija el orden de los campos. */
export function aEsquemaGemini(s: any): any {
  if (Array.isArray(s)) return s.map(aEsquemaGemini);
  if (!s || typeof s !== 'object') return s;
  const out: any = {};
  for (const [k, v] of Object.entries(s)) {
    if (k === 'properties') out.properties = Object.fromEntries(Object.entries(v as any).map(([p, x]) => [p, aEsquemaGemini(x)]));
    else if (k === 'items') out.items = aEsquemaGemini(v);
    else out[k] = v;
  }
  if (Array.isArray(out.type)) {
    const { type, description, ...resto } = out;
    return { anyOf: (type as string[]).map((t) => (t === 'null' ? { type: 'null' } : { type: t, ...resto })), ...(description ? { description } : {}) };
  }
  if (out.properties) out.propertyOrdering = Object.keys(out.properties);
  return out;
}

/** JSON Schema → esquema clásico de Gemini (OpenAPI: tipos en mayúscula, nullable, sin additionalProperties). */
export function aEsquemaOpenApi(s: any): any {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return s;
  const out: any = {};
  let tipo = s.type;
  if (Array.isArray(tipo)) { out.nullable = tipo.includes('null'); tipo = tipo.find((t: string) => t !== 'null'); }
  if (tipo) out.type = String(tipo).toUpperCase();
  for (const k of ['description', 'enum', 'required']) if (s[k] !== undefined) out[k] = s[k];
  if (s.items) out.items = aEsquemaOpenApi(s.items);
  if (s.properties) {
    out.properties = Object.fromEntries(Object.entries(s.properties).map(([p, x]) => [p, aEsquemaOpenApi(x)]));
    out.propertyOrdering = Object.keys(s.properties);
  }
  return out;
}

export interface RespuestaModelo { modelo: string; salida: any; metricas: { ms: number; tokens_entrada: number | null; tokens_cache: number | null; tokens_salida: number | null } }

export async function pedirJson(sistema: string, texto: string, esquema: any): Promise<RespuestaModelo> {
  let ultimo = '';
  for (const modelo of modelos()) {
    let formato: 'json' | 'openapi' = 'json';
    let sinPensar = true;
    for (let intento = 0; intento < 4; intento++) {
      const t0 = Date.now();
      try {
        const r = await ia().models.generateContent({
          model: modelo,
          contents: [{ role: 'user', parts: [{ text: texto }] }],
          config: {
            systemInstruction: sistema,
            temperature: 0,
            responseMimeType: 'application/json',
            ...(formato === 'json' ? { responseJsonSchema: aEsquemaGemini(esquema) } : { responseSchema: aEsquemaOpenApi(esquema) }),
            ...(sinPensar ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          },
        });
        const txt = r.text;
        if (!txt) throw new Error('respuesta vacía' + (r.promptFeedback?.blockReason ? ` (${r.promptFeedback.blockReason})` : ''));
        const u = r.usageMetadata;
        return {
          modelo, salida: JSON.parse(txt),
          metricas: { ms: Date.now() - t0, tokens_entrada: u?.promptTokenCount ?? null, tokens_cache: u?.cachedContentTokenCount ?? null, tokens_salida: u?.candidatesTokenCount ?? null },
        };
      } catch (e: any) {
        const msg = String(e?.message || e);
        ultimo = `${modelo}: ${msg.slice(0, 300)}`;
        if (/IA_SIN_CONFIGURAR|API[_ ]?key|PERMISSION_DENIED|UNAUTHENTICATED/i.test(msg)) throw new Error(ultimo);
        if (sinPensar && /thinking|budget/i.test(msg)) { sinPensar = false; continue; }
        if (formato === 'json' && /schema|INVALID_ARGUMENT/i.test(msg)) { formato = 'openapi'; continue; }
        break; // otro error: siguiente modelo
      }
    }
  }
  throw new Error(ultimo || 'sin modelos');
}
