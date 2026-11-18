// Iteración 2 · F4 · Verifica la respuesta REAL de una IA al paquete "Copiar para mi IA".
// Uso:  npx tsx scripts/prueba-informe-ia.ts <T1|T2|T3> <respuesta.md> [<respuesta2.md> …]
// Críticas (cualquiera reprueba): cifra inventada, nombre de un tercero, entidad o producto, visualizador alterado, cripto.
import { readFileSync } from 'node:fs';
import { armarPaquete } from '../src/ia/paquete';
import { verificarInforme } from '../src/ia/verificador';
import { T1 } from './datos-prueba-ia/t1-estudiante';
import { T2 } from './datos-prueba-ia/t2-freelancer';
import { T3 } from './datos-prueba-ia/t3-sin-ingresos';

const perfiles = { T1, T2, T3 } as const;
const [perfil, ...archivos] = process.argv.slice(2);
const doc = perfiles[perfil as keyof typeof perfiles];
if (!doc || !archivos.length) { console.log('Uso: npx tsx scripts/prueba-informe-ia.ts <T1|T2|T3> <respuesta.md> …'); process.exit(2); }
const paquete = armarPaquete(doc);
let aprobadas = 0;
for (const a of archivos) {
  const r = verificarInforme(paquete, doc, readFileSync(a, 'utf8'));
  if (r.ok) aprobadas++;
  console.log(`\n${a}: ${r.ok ? 'APROBADA' : `REPROBADA (${r.criticas} críticas)`} · ${r.cifras.total} cifras`);
  r.chequeos.forEach((c) => console.log(`  ${c.ok ? '✓' : c.critica ? '✗ CRÍTICA' : '△'} ${c.nombre}${c.detalle && !c.ok ? ' — ' + c.detalle : ''}`));
}
console.log(`\n${aprobadas} de ${archivos.length} sin fallas críticas`);
