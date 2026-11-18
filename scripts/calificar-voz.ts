// Califica resultados guardados del set de voz.  Uso:  npx tsx scripts/calificar-voz.ts <resultados.json>
//   resultados.json = [{ version, n, intento, movimientos, aclaracion, ms, tokens_entrada, tokens_salida, error }]
import { readFileSync } from 'node:fs';
import { calificarCorrida, veredicto, type FilaEval } from '../server/voz/calificador';

if (process.argv[2]) {
  const filas: FilaEval[] = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const versiones = [...new Set(filas.map((f) => f.version))].sort();
  const p = (x: number) => (x * 100).toFixed(1).replace('.', ',') + ' %';
  for (const v of versiones) {
    const intentos = [...new Set(filas.filter((f) => f.version === v).map((f) => f.intento))].sort();
    const corridas = intentos.map((i) => calificarCorrida(filas.filter((f) => f.version === v && f.intento === i), v));
    const peor = corridas.reduce((a, b) => (b.perfectas < a.perfectas || (b.perfectas === a.perfectas && b.promedio < a.promedio) ? b : a));
    const ver = veredicto(peor);
    console.log(`\n=== ${v} · ${corridas.length} corrida(s) · se juzga la peor · ${ver.aprobada ? 'APROBADA' : 'NO APROBADA'}`);
    console.log('   perfectas por corrida:', corridas.map((c) => c.perfectas).join(', '));
    console.log('   ' + Object.entries(peor.porCampo).map(([k, x]) => `${k} ${p(x)}`).join(' · '));
    console.log(`   promedio ${p(peor.promedio)} · perfectas ${peor.perfectas}/30 · silencios [${peor.silencios.join(', ')}] · p95 ${peor.p95} ms · tokens ${Math.round(peor.tokensEntrada)} entrada / ${Math.round(peor.tokensSalida)} salida`);
    ver.reglas.forEach((r) => console.log(`   ${r.ok ? '✓' : '✗'} ${r.regla}`));
    peor.fallas.forEach((f) => console.log('     · ' + f));
  }
}
