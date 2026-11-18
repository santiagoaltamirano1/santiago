// Prueba de la presentación de tasas (Fase 4). Ejecutar: npx tsx scripts/prueba-tasas.ts
import { describirTrm, describirConsulta, convertir, type FxRates } from '../src/utils/fx';
const fx: FxRates = { usdCop: 3316.7, eurCop: 3644.7216, fuente: 'TRM Superfinanciera · EUR: BCE × TRM', updatedAt: Date.now(),
  usdDesde: '2026-11-14', usdHasta: '2026-11-17', eurDesde: '2026-11-17', proximaTrm: { valor: 3309.55, desde: '2026-11-18' }, respaldo: false };
let mal = 0;
const caso = (n: string, c: boolean, d = '') => { if (!c) mal++; console.log(`${c ? 'OK ' : 'MAL'} ${n} · ${d}`); };
caso('TRM con vigencia de varios días', describirTrm(fx) === 'TRM $3.316,70 · vigente del 14 de nov al 17 de nov', describirTrm(fx));
caso('TRM de un solo día', describirTrm({ ...fx, usdDesde: '2026-11-18', usdHasta: '2026-11-18' }).endsWith('vigente el 18 de nov'), describirTrm({ ...fx, usdDesde: '2026-11-18', usdHasta: '2026-11-18' }));
caso('Hora de actualización', describirConsulta(fx).startsWith('Actualizada hoy'), describirConsulta(fx));
caso('Respaldo avisa', describirConsulta({ ...fx, respaldo: true }).startsWith('Última tasa guardada'), describirConsulta({ ...fx, respaldo: true }));
caso('Sin conexión nunca', describirTrm({ ...fx, updatedAt: 0 }).includes('sin conexión'), describirTrm({ ...fx, updatedAt: 0 }));
caso('US$100 → COP con TRM', convertir(100, 'USD', 'COP', fx) === 331670, String(convertir(100, 'USD', 'COP', fx)));
caso('€100 → US$ vía COP', Math.abs(convertir(100, 'EUR', 'USD', fx) - 109.89) < 0.01, convertir(100, 'EUR', 'USD', fx).toFixed(4));
console.log(mal ? `${mal} MAL` : 'todo OK'); process.exit(mal ? 1 : 0);
