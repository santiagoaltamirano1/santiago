import type { Transaccion } from '../types';

// Fase 5: un movimiento dictado "parece repetido" si ya hay uno del mismo tipo, monto y cuenta
// el mismo día (o si se repite dentro del mismo dictado). La persona decide si lo anota igual.
export interface Candidato { tipo: string; monto: number; cuenta_id: string | null; meta_id?: string | null; deuda_id?: string | null; fecha: string }

const clave = (c: Candidato) => [c.tipo, Math.round(c.monto * 100), c.cuenta_id || '', c.meta_id || '', c.deuda_id || '', c.fecha].join('|');

export function detectarDuplicados(candidatos: Candidato[], existentes: Transaccion[]): ('ya_anotado' | 'repetido_en_dictado' | null)[] {
  const dia = (t: Transaccion) => t.fecha_local_str || new Date(t.fecha).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  const yaHay = new Set(existentes.map((t) => clave({ tipo: t.tipo, monto: t.monto, cuenta_id: t.cuenta_id || null, meta_id: t.meta_id, deuda_id: t.deuda_id, fecha: dia(t) })));
  const vistos = new Set<string>();
  return candidatos.map((c) => {
    const k = clave(c);
    if (yaHay.has(k)) return 'ya_anotado';
    if (vistos.has(k)) return 'repetido_en_dictado';
    vistos.add(k);
    return null;
  });
}
