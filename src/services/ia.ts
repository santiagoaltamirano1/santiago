import { api } from './api';
import type { TipoTransaccion, Moneda } from '../types';

// La IA (Gemini) SOLO organiza el texto. La llave vive en el servidor (secreto GEMINI_API_KEY) y nunca llega aquí.
export interface DudaIA { campo: 'cuenta' | 'destino' | 'categoria' | 'monto' | 'tipo' | 'meta' | 'deuda' | 'fecha'; pregunta: string }
export interface MovimientoIA {
  tipo: Exclude<TipoTransaccion, 'ajuste'>;
  monto: number;
  moneda: Moneda;
  descripcion: string;
  cuenta_id: string | null;
  destino_cuenta_id: string | null;
  categoria_id: string | null;
  meta_id: string | null;
  deuda_id: string | null;
  fecha: string | null; // YYYY-MM-DD; null = hoy
  confianza: number;
  dudas: DudaIA[];
  // Iteración 2 · F6 (voz-v2): de dónde salió en el texto y datos extra
  texto_fuente?: string;
  fuente?: { inicio: number; fin: number } | null;  // posición en el texto enviado (la calcula el servidor)
  nota?: string | null;
  contraparte?: string | null;
  cuenta_dicha?: string | null;
  destino_dicho?: string | null;
}
export interface RespuestaIA { captura_id: string; modelo: string; version_prompt?: string; movimientos: MovimientoIA[]; aclaracion: string | null }
export interface ExtraCaptura { texto_dictado?: string; transcriptor?: 'web_speech' | 'teclado' }

export const hoyBogota = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

export async function interpretarTexto(texto: string, cuentaPorDefecto?: string, extra: ExtraCaptura = {}): Promise<RespuestaIA> {
  try {
    return await api<RespuestaIA>('POST', '/api/voz/interpretar', {
      texto, cuenta_por_defecto: cuentaPorDefecto || null, hoy: hoyBogota(), texto_dictado: extra.texto_dictado || null, transcriptor: extra.transcriptor || 'web_speech',
    });
  } catch (e: any) {
    // El servidor manda un mensaje para la persona ("CODIGO: mensaje"): se muestra solo el mensaje
    const m = /^[A-Z_]+:\s*(.+)$/.exec(String(e?.message || ''));
    throw new Error(m?.[1] || 'No pudimos organizar el texto. Intenta otra vez o anótalo a mano.');
  }
}

/** Iteración 2 · F6 · Cierra la captura con lo que la persona guardó al final. El servidor calcula qué corrigió
 *  (base de la memoria personal, F9). Nunca bloquea: si falla, el registro ya quedó guardado. */
export interface ConfirmadoIA { i: number | null; incluido: boolean; tipo?: string; monto?: number; cuenta_id?: string | null; destino_cuenta_id?: string | null; categoria_id?: string | null; meta_id?: string | null; deuda_id?: string | null; fecha?: string | null }
export async function cerrarCaptura(capturaId: string, confirmados: ConfirmadoIA[]): Promise<void> {
  if (!capturaId) return;
  try { await api('POST', '/api/voz/cerrar', { captura_id: capturaId, confirmados }); } catch { /* no bloquea */ }
}
