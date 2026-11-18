// Panel de PRUEBA: mide la voz con las 30 frases del set (server/voz/eval_set.ts) contra el modelo real de Gemini.
// Solo aparece si el servidor tiene el secreto EVAL_VOZ=1. Gasta saldo de la IA: quitar el secreto al terminar.
import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';

interface Resultado { version: string; corridas: number[]; veredicto: { aprobada: boolean; reglas: { regla: string; ok: boolean }[] }; peor: { fallas: string[]; p95: number | null }; filas: unknown[] }

export const MedirVoz: React.FC = () => {
  const [activo, setActivo] = useState(false);
  const [estado, setEstado] = useState<'listo' | 'midiendo' | 'error'>('listo');
  const [res, setRes] = useState<Resultado | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/salud').then((r) => r.json()).then((s) => setActivo(!!s?.evaluacion_voz)).catch(() => setActivo(false));
  }, []);
  if (!activo) return null;

  const medir = async () => {
    setEstado('midiendo'); setRes(null); setError('');
    try { setRes(await api<Resultado>('POST', '/api/dev/evaluar-voz', { intentos: 3 })); setEstado('listo'); }
    catch (e: any) { setError(e?.message || 'No se pudo medir'); setEstado('error'); }
  };
  const descargar = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `medicion-voz-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section aria-labelledby="medir-voz" className="bg-white p-5 rounded-[24px] border border-dashed border-[#d4d4d4] space-y-3">
      <h2 id="medir-voz" className="text-base font-semibold text-[#0a0a0a]">Medir la voz (solo pruebas)</h2>
      <p className="text-sm text-[#737373]">Corre 30 frases de prueba 3 veces con la IA real y las califica. Tarda 1 a 3 minutos. Al terminar, quita el secreto EVAL_VOZ.</p>
      <button onClick={medir} disabled={estado === 'midiendo'} className="w-full bg-[#0a0a0a] text-[#fafafa] py-3 rounded-[18px] font-medium disabled:opacity-60">
        {estado === 'midiendo' ? 'Midiendo… no cierres esta pantalla' : 'Medir la voz'}
      </button>
      {error && <p role="alert" className="text-sm text-ember">{error}</p>}
      {res && (
        <div role="status" className="text-sm space-y-2">
          <p className="font-semibold">{res.veredicto.aprobada ? '✓ APROBADA' : '✗ NO APROBADA'} · perfectas por corrida: {res.corridas.join(', ')} de 30 · p95 {res.peor.p95 ?? '—'} ms</p>
          <ul className="space-y-0.5">{res.veredicto.reglas.map((r) => <li key={r.regla}>{r.ok ? '✓' : '✗'} {r.regla}</li>)}</ul>
          {res.peor.fallas.length > 0 && <details><summary className="cursor-pointer">Fallas de la peor corrida ({res.peor.fallas.length})</summary><ul className="text-xs text-[#525252] mt-1">{res.peor.fallas.slice(0, 40).map((f, i) => <li key={i}>· {f}</li>)}</ul></details>}
          <button onClick={descargar} className="underline text-[#0a0a0a]">Descargar resultados (.json)</button>
        </div>
      )}
    </section>
  );
};
