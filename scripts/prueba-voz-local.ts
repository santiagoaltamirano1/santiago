// Iteración 2 · F6 · Pruebas locales (sin IA) del módulo de voz y del calificador.
// Ejecutar:  npx tsx scripts/prueba-voz-local.ts
import { ubicarFuentes, validar, calendario, esquema, instrucciones } from '../server/voz/prompt.ts';
import { CTX_EVAL, SET_EVAL } from '../server/voz/eval_set.ts';
import { calificarCaso, calificarCorrida, veredicto, type FilaEval } from '../server/voz/calificador';
import { normalizarDictado, palabrasANumero } from '../src/utils/normalizarDictado';

let ok = 0, mal = 0;
const caso = (n: string, c: boolean, d = '') => { if (c) ok++; else { mal++; console.log('  ✗', n, d); } };

// ---------------------------------------------------------------- ubicar texto_fuente
const t = 'gasté 15 mil en taxi, 15 mil en taxi';
const f = ubicarFuentes(t, ['15 mil en taxi', '15 mil en taxi']);
caso('Fuente: frases repetidas se ubican en orden (caso 26)', f[0]!.inicio === 6 && f[1]!.inicio === 22, JSON.stringify(f));
const t2 = 'Compré mercado por 180 mil, no, mejor dicho fueron 185';
const f2 = ubicarFuentes(t2, ['compre mercado por 180 mil no mejor dicho fueron 185']);
caso('Fuente: sin tildes ni puntuación igual se ubica', !!f2[0] && t2.slice(f2[0].inicio, f2[0].fin) === t2, JSON.stringify(f2));
caso('Fuente: inventado → null', ubicarFuentes('hola', ['algo que no dijo'])[0] === null);
const t3 = 'vendí la bici en 600 mil y me llegó a Nequi, de eso aparté 200 para el Mac';
const f3 = ubicarFuentes(t3, ['vendí la bici en 600 mil y me llegó a Nequi', 'aparté 200 para el Mac']);
caso('Fuente: dos fragmentos de una misma frase', !!f3[0] && !!f3[1] && f3[1].inicio > f3[0].inicio);

// ---------------------------------------------------------------- validar
const base = { monto: 50000, moneda: 'COP', descripcion: 'x', cuenta_id: 'inventada', destino_cuenta_id: null, categoria_id: null, meta_id: null, deuda_id: null, fecha: null, confianza: 0.9, dudas: [], texto_fuente: 'puse 50 mil en Daviplata', nota: null, contraparte: null, destino_dicho: null };
const v1 = validar({ movimientos: [{ ...base, tipo: 'transferencia', cuenta_dicha: 'Daviplata' }] }, CTX_EVAL, 'c-efe', 'voz-v1', 'puse 50 mil en Daviplata');
caso('v1 (línea base): Daviplata se cambia en silencio por Efectivo (el fallo que se corrige)', v1[0].cuenta_id === 'c-efe');
const v2 = validar({ movimientos: [{ ...base, tipo: 'gasto', categoria_id: 'g-otr', cuenta_dicha: 'Daviplata' }] }, CTX_EVAL, 'c-efe', 'voz-v2', 'puse 50 mil en Daviplata', '2026-11-18');
caso('v2: Daviplata NO se resuelve en silencio: cuenta null + duda con el nombre', v2[0].cuenta_id === null && v2[0].dudas.some((d: any) => d.campo === 'cuenta' && d.pregunta.includes('Daviplata')), JSON.stringify(v2[0].dudas));
const v2b = validar({ movimientos: [{ ...base, tipo: 'gasto', categoria_id: 'g-com', cuenta_id: 'c-neq', cuenta_dicha: 'el Nequi' }] }, CTX_EVAL, 'c-efe', 'voz-v2', 'x', '2026-11-18');
const v2g = validar({ movimientos: [{ ...base, tipo: 'transferencia', cuenta_id: 'c-efe', destino_cuenta_id: null, cuenta_dicha: null, destino_dicho: 'Daviplata' }] }, CTX_EVAL, 'c-efe', 'voz-v2', 'x', '2026-11-18');
caso('v2: destino que no existe → duda que nombra a Daviplata', v2g[0].destino_cuenta_id === null && v2g[0].dudas.some((d: any) => d.campo === 'destino' && d.pregunta.includes('Daviplata')));
caso('v2: "el Nequi" sí existe y se respeta', v2b[0].cuenta_id === 'c-neq' && v2b[0].dudas.length === 0);
const v2c = validar({ movimientos: [{ ...base, tipo: 'gasto', categoria_id: 'g-com', cuenta_id: null, cuenta_dicha: null }] }, CTX_EVAL, 'c-efe', 'voz-v2', 'x', '2026-11-18');
caso('v2: sin cuenta nombrada → la de por defecto', v2c[0].cuenta_id === 'c-efe');
const v2d = validar({ movimientos: [{ ...base, tipo: 'gasto', categoria_id: 'g-com', cuenta_id: 'c-efe', cuenta_dicha: null, fecha: '2026-12-01' }] }, CTX_EVAL, 'c-efe', 'voz-v2', 'x', '2026-11-18');
caso('v2: fecha futura → hoy y duda de fecha', v2d[0].fecha === null && v2d[0].dudas.some((d: any) => d.campo === 'fecha'));
const v2e = validar({ movimientos: [{ ...base, tipo: 'prestamo_capital', cuenta_id: 'c-efe', deuda_id: 'inventada', contraparte: 'Camilo', cuenta_dicha: null }] }, CTX_EVAL, 'c-efe', 'voz-v2', 'x', '2026-11-18');
caso('v2: deuda con alguien que no existe → duda que nombra a Camilo', v2e[0].deuda_id === null && v2e[0].dudas.some((d: any) => d.pregunta.includes('Camilo')));
const v2f = validar({ movimientos: [{ ...base, tipo: 'gasto', categoria_id: 'g-com', cuenta_id: 'c-efe', cuenta_dicha: null, nota: '  para el cumpleaños de Ana  ' + 'x'.repeat(200) }] }, CTX_EVAL, 'c-efe', 'voz-v2', 'x', '2026-11-18');
caso('v2: nota limpia y máximo 140 caracteres', v2f[0].nota.startsWith('para el cumpleaños de Ana') && v2f[0].nota.length === 140);

// ---------------------------------------------------------------- prompt y esquema
caso('Calendario: lunes = 2026-11-16 desde el miércoles 18', calendario('2026-11-18').includes('lunes = 2026-11-16') && calendario('2026-11-18').includes('ayer = 2026-11-17'));
const e2 = esquema('voz-v2') as any;
const req = e2.schema.properties.movimientos.items.required;
caso('Esquema v2: estricto, con los 5 campos nuevos obligatorios', e2.strict && ['texto_fuente', 'nota', 'contraparte', 'cuenta_dicha', 'destino_dicho'].every((k) => req.includes(k)));
caso('Esquema v1 sin cambios (12 campos)', (esquema('voz-v1') as any).schema.properties.movimientos.items.required.length === 12);
const p2 = instrucciones('voz-v2', CTX_EVAL, '2026-11-18', 'Efectivo');
caso('Prompt v2: lo fijo primero (caché) y los datos al final', p2.indexOf('# Reglas') < p2.indexOf('# Datos de esta persona') && p2.trimEnd().endsWith(']'));
caso('Prompt v2: ninguna frase del set de evaluación copiada en los ejemplos', SET_EVAL.every((c) => !p2.includes(c.frase)));

// ---------------------------------------------------------------- calificador
const perfecto = (n: number) => SET_EVAL.find((c) => c.n === n)!.esperado.map((e) => ({
  tipo: Array.isArray(e.tipo) ? e.tipo[0] : e.tipo, monto: e.monto, moneda: e.moneda || 'COP', cuenta_id: e.cuenta ?? null, destino_cuenta_id: e.destino ?? null,
  categoria_id: Array.isArray(e.categoria) ? e.categoria[0] : e.categoria ?? null, meta_id: e.meta ?? null, deuda_id: e.deuda ?? null, fecha: e.fecha ?? null, fuente: { inicio: 0, fin: 1 },
  dudas: (SET_EVAL.find((c) => c.n === n)!.dudas || []).flat().slice(0, 1).map((campo) => ({ campo, pregunta: '?' })),
}));
const filas: FilaEval[] = SET_EVAL.map((c) => ({ version: 'voz-v2', n: c.n, intento: 1, movimientos: perfecto(c.n), aclaracion: null, ms: 1500, tokens_entrada: 3000, tokens_salida: 200, error: null }));
const cal = calificarCorrida(filas, 'voz-v2');
caso('Calificador: respuestas perfectas = 30/30 y aprobada', cal.perfectas === 30 && veredicto(cal).aprobada, JSON.stringify(cal.fallas.slice(0, 3)));
const silencio = calificarCaso(19, [{ tipo: 'transferencia', monto: 50000, moneda: 'COP', cuenta_id: 'c-efe', destino_cuenta_id: 'c-neq', dudas: [], fuente: { inicio: 0, fin: 1 } }], 'voz-v2');
caso('Calificador: Daviplata resuelto en silencio = falla', silencio.silencio && !silencio.perfecta);
const correccion = calificarCaso(17, [{ tipo: 'gasto', monto: 180000, cuenta_id: 'c-efe', categoria_id: 'g-mer', dudas: [], fuente: {} }, { tipo: 'gasto', monto: 185000, cuenta_id: 'c-efe', categoria_id: 'g-mer', dudas: [], fuente: {} }], 'voz-v2');
caso('Calificador: corrección contada como 2 movimientos = falla de cantidad', !correccion.perfecta && correccion.fallas.some((x) => x.startsWith('cantidad')));
const lento = calificarCorrida(filas.map((x) => ({ ...x, ms: 6000 })), 'voz-v2');
caso('Calificador: p95 de 6 s no aprueba', !veredicto(lento).aprobada);

// ---------------------------------------------------------------- normalizador del dictado
const N = (x: string) => normalizarDictado(x).texto;
caso('Normalizador: "veinticinco mil" → "25 mil"', N('me gasté veinticinco mil en almuerzo') === 'me gasté 25 mil en almuerzo');
caso('Normalizador: "dos palos trescientos" conserva el resto', N('me llegaron dos palos trescientos') === 'me llegaron 2 palos trescientos');
caso('Normalizador: "trescientos cincuenta mil"', N('pagué trescientos cincuenta mil de arriendo') === 'pagué 350 mil de arriendo');
caso('Normalizador: "media luca" y "una gamba"', N('media luca de chicle y una gamba de mercado') === '500 de chicle y 100 mil de mercado');
caso('Normalizador: "un palo y medio"', N('pagué un palo y medio') === 'pagué 1,5 palos');
caso('Normalizador: "cuarenta y cinco lucas"', N('cuarenta y cinco lucas') === '45 lucas');
caso('Normalizador: "un tinto" NO se toca (no es dinero)', N('compré un tinto de 3 mil') === 'compré un tinto de 3 mil');
caso('Normalizador: "dos taxis" NO se toca', N('dos taxis de 15 mil') === 'dos taxis de 15 mil');
caso('Normalizador: texto sin cambios → cambio=false', normalizarDictado('pasé 200 mil a Nequi').cambio === false);
caso('palabrasANumero: ciento veintitrés = 123 · "hola" = null', palabrasANumero('ciento veintitres') === 123 && palabrasANumero('hola') === null);

console.log(`\nprueba-voz-local: ${ok} OK, ${mal} fallas`);
if (mal) process.exit(1);
