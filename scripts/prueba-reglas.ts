// Prueba de las reglas de dinero de la app (Fase 3). Mismos casos que las pruebas SQL de la Fase 2.
// Ejecutar:  npx tsx scripts/prueba-reglas.ts
import { calcularEfecto, aplicarEfecto, disponibleCOP, errorDesdeServidor } from '../src/utils/reglas';
import type { Cuenta, Meta, Deuda, Categoria } from '../src/types';

const fx = { usdCop: 3315.7, eurCop: 3649.31, updatedAt: 0, source: 'prueba' } as any;
const cuentas: Cuenta[] = [
  { id: 'ah', user_id: 'u', nombre: 'Ahorros', tipo: 'ahorro', moneda: 'COP', saldo_actual: 1657850 },
  { id: 'ef', user_id: 'u', nombre: 'Efectivo', tipo: 'efectivo', moneda: 'COP', saldo_actual: 400000 },
  { id: 'us', user_id: 'u', nombre: 'USD', tipo: 'broker', moneda: 'USD', saldo_actual: 100 },
  { id: 'tc', user_id: 'u', nombre: 'Tarjeta', tipo: 'tarjeta', moneda: 'COP', saldo_actual: -200000 },
];
const metas: Meta[] = [{ id: 'mac', user_id: 'u', nombre: 'MacBook', monto_objetivo: 8000000, monto_actual: 50000, porcentaje: 1 }];
const deudas: Deuda[] = [
  { id: 'fin', user_id: 'u', contraparte: 'Financiera', tipo: 'por_pagar', moneda: 'COP', monto_total: 8000000, monto_pagado: 5000000, estado: 'activa' },
  { id: 'mar', user_id: 'u', contraparte: 'María', tipo: 'por_cobrar', moneda: 'COP', monto_total: 700000, monto_pagado: 205000, estado: 'activa' },
  { id: 'sal', user_id: 'u', contraparte: 'Saldada', tipo: 'por_pagar', moneda: 'COP', monto_total: 100, monto_pagado: 100, estado: 'saldada' },
];
const categorias: Categoria[] = [
  { id: 'com', nombre: 'Comida', supercategoria: 'x', tipo: 'gasto', icono: 'x' },
  { id: 'sal', nombre: 'Salario', supercategoria: 'x', tipo: 'ingreso', icono: 'x' },
];
let estado = { cuentas, metas, deudas, fx, categorias };
let ok = 0, mal = 0;
const caso = (nombre: string, cond: boolean, detalle = '') => { cond ? ok++ : mal++; console.log(`${cond ? 'OK ' : 'MAL'} ${nombre}${detalle ? ' · ' + detalle : ''}`); };
const tx = (t: any) => ({ categoria_id: '', fecha: '', ...t });
const efecto = (t: any) => calcularEfecto(tx(t), estado);

// Disponible = cuentas no tarjeta (1657850+400000+100*3315.7) − metas (50000)
caso('Disponible excluye tarjetas y resta metas', Math.round(disponibleCOP(cuentas, metas, fx)) === 1657850 + 400000 + 331570 - 50000);

// Metas: apartar 50.000 y sacar 20.000 de la MacBook (ejemplo de la dueña)
let r: any = efecto({ tipo: 'aporte_meta', monto: 50000, meta_id: 'mac' });
caso('Apartar 50.000 no toca cuentas', 'efecto' in r && r.efecto.cuentas.length === 0 && r.efecto.meta.delta === 50000);
estado = { ...estado, ...aplicarEfecto(estado, r.efecto, 1) };
r = efecto({ tipo: 'retiro_meta', monto: 20000, meta_id: 'mac' });
estado = { ...estado, ...aplicarEfecto(estado, r.efecto, 1) };
caso('MacBook 50.000 + 50.000 − 20.000 = 80.000', estado.metas[0].monto_actual === 80000, String(estado.metas[0].monto_actual));
r = efecto({ tipo: 'retiro_meta', monto: 90000, meta_id: 'mac' });
caso('Sacar más de lo apartado → RETIRO_MAYOR', 'error' in r && r.error.codigo === 'RETIRO_MAYOR' && r.error.maximo === 80000, r.error?.mensaje);
r = efecto({ tipo: 'aporte_meta', monto: 999999999, meta_id: 'mac' });
caso('Apartar más que el disponible → DISPONIBLE_INSUFICIENTE', 'error' in r && r.error.codigo === 'DISPONIBLE_INSUFICIENTE', r.error?.mensaje);

// Deudas
r = efecto({ tipo: 'abono_capital', monto: 4000000, cuenta_id: 'ah', deuda_id: 'fin' });
caso('Abonar 4M con 3M pendientes → SOBREPAGO 3M', 'error' in r && r.error.codigo === 'SOBREPAGO' && r.error.maximo === 3000000, r.error?.mensaje);
r = efecto({ tipo: 'abono_capital', monto: 3000000, cuenta_id: 'ah', deuda_id: 'fin' });
const tras = aplicarEfecto(estado, r.efecto, 1);
caso('Abonar exacto 3M → saldada y cuenta −3M', tras.deudas[0].estado === 'saldada' && tras.cuentas[0].saldo_actual === 1657850 - 3000000);
r = efecto({ tipo: 'abono_capital', monto: 1, cuenta_id: 'ah', deuda_id: 'sal' });
caso('Abonar a deuda saldada → DEUDA_SALDADA', 'error' in r && r.error.codigo === 'DEUDA_SALDADA');
r = efecto({ tipo: 'prestamo_capital', monto: 100000, cuenta_id: 'ef', deuda_id: 'mar' });
const tras2 = aplicarEfecto(estado, r.efecto, 1);
caso('Prestar 100.000 más a María: total 800.000, Efectivo −100.000', tras2.deudas[1].monto_total === 800000 && tras2.cuentas[1].saldo_actual === 300000);
r = efecto({ tipo: 'abono_capital', monto: 100, cuenta_id: 'us', deuda_id: 'mar' });
caso('Abono en USD a deuda COP se convierte (100 USD = 331.570)', 'efecto' in r && r.efecto.deuda.delta === 331570 && r.efecto.cuentas[0].delta === 100);

// Deshacer = inverso exacto (E10): dos movimientos en la misma cuenta, deshacer el primero
const e1: any = efecto({ tipo: 'gasto', monto: 10000, cuenta_id: 'ef', categoria_id: 'com' });
let s1 = aplicarEfecto(estado, e1.efecto, 1);
const e2: any = calcularEfecto(tx({ tipo: 'gasto', monto: 20000, cuenta_id: 'ef', categoria_id: 'com' }), { ...estado, ...s1 });
s1 = aplicarEfecto(s1, e2.efecto, 1);
s1 = aplicarEfecto(s1, e1.efecto, -1);
caso('E10: deshacer el primero conserva el segundo (400.000 − 20.000)', s1.cuentas[1].saldo_actual === 380000, String(s1.cuentas[1].saldo_actual));

// Validaciones comunes
caso('Gasto con categoría de ingreso → CATEGORIA_INVALIDA', (efecto({ tipo: 'gasto', monto: 1, cuenta_id: 'ef', categoria_id: 'sal' }) as any).error?.codigo === 'CATEGORIA_INVALIDA');
caso('Transferencia sin destino → DESTINO_REQUERIDO', (efecto({ tipo: 'transferencia', monto: 1, cuenta_id: 'ef' }) as any).error?.codigo === 'DESTINO_REQUERIDO');
caso('Monto 0 → MONTO_INVALIDO', (efecto({ tipo: 'gasto', monto: 0, cuenta_id: 'ef', categoria_id: 'com' }) as any).error?.codigo === 'MONTO_INVALIDO');
caso('Meta y deuda juntas → META_Y_DEUDA', (efecto({ tipo: 'gasto', monto: 1, cuenta_id: 'ef', categoria_id: 'com', meta_id: 'mac', deuda_id: 'fin' }) as any).error?.codigo === 'META_Y_DEUDA');

// Traducción de errores del servidor
const e = errorDesdeServidor('SOBREPAGO: 3000000.00');
caso('Error del servidor traducido', e.codigo === 'SOBREPAGO' && e.mensaje === 'Solo quedan $3.000.000 pendientes.', e.mensaje);

console.log(`\n${ok} OK · ${mal} MAL`);
process.exit(mal ? 1 : 0);
