// Prueba de la detección de duplicados del registro por voz (Fase 5). Ejecutar: npx tsx scripts/prueba-duplicados.ts
import { detectarDuplicados } from '../src/utils/duplicados';
const hoy = '2026-11-17';
const existentes: any[] = [{ id: 't1', tipo: 'gasto', monto: 25000, cuenta_id: 'ef', fecha: '2026-11-17T15:00:00Z', fecha_local_str: hoy }];
const r = detectarDuplicados([
  { tipo: 'gasto', monto: 25000, cuenta_id: 'ef', fecha: hoy },      // ya anotado hoy
  { tipo: 'gasto', monto: 25000, cuenta_id: 'ef', fecha: '2026-11-16' }, // mismo monto, otro día → no
  { tipo: 'gasto', monto: 8000, cuenta_id: 'ef', fecha: hoy },        // nuevo
  { tipo: 'gasto', monto: 8000, cuenta_id: 'ef', fecha: hoy },        // dicho dos veces
  { tipo: 'ingreso', monto: 25000, cuenta_id: 'ef', fecha: hoy },     // otro tipo → no
], existentes);
const esperado = ['ya_anotado', null, null, 'repetido_en_dictado', null];
const ok = JSON.stringify(r) === JSON.stringify(esperado);
console.log(ok ? 'OK  duplicados' : 'MAL duplicados', JSON.stringify(r));
process.exit(ok ? 0 : 1);
