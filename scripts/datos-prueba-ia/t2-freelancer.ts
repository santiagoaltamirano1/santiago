// Perfil de prueba T2 (freelancer): 8 meses, ~700 movimientos, ingresos irregulares, gasto creciendo +$100.000/mes,
// Netflix y arriendo recurrentes, tarjeta con −$1.800.000, cuenta en USD y "me deben" (Andrea).
// Trampas: detalles con nombres de bancos y apps (los pone la prueba del paquete).
import type { DocumentoExport, FilaMovimiento } from '../../src/ia/tipos';

export function t2(): DocumentoExport {
  const filas: FilaMovimiento[] = [];
  const base = (dia: string, tipo: FilaMovimiento['tipo'], cop: number, categoria: string, detalle: string): FilaMovimiento => ({
    dia, hora: '10:00', tipo, cuenta_como: tipo === 'ingreso' ? 'Ingreso' : tipo === 'gasto' ? 'Gasto' : 'No cuenta', categoria, detalle,
    cuenta: 'Banco', destino: null, meta: null, deuda: null, operacion_deuda: null, monto: cop, moneda: 'COP', tasa_cop: 1, cop, efecto_cuenta: tipo === 'ingreso' ? 1 : -1,
    saldo_anterior: null, saldo_nuevo: null, origen: 'manual',
  });
  const ingresos = [3000000, 1200000, 4500000, 900000, 3800000, 2500000, 2100000, 3000000]; // abr..nov (irregular)
  const gastoMes = [1500000, 1600000, 1700000, 1800000, 1900000, 2000000, 2100000];          // abr..oct: +100.000/mes
  for (let k = 0; k < 8; k++) {
    const mes = `2026-${String(4 + k).padStart(2, '0')}`;
    filas.push(base(`${mes}-05`, 'ingreso', ingresos[k], 'Freelance', 'pago cliente'));
    if (k === 7) break; // noviembre en curso: solo el ingreso y el arriendo
    filas.push(base(`${mes}-03`, 'gasto', 38900, 'Suscripciones', 'Netflix plan'));
    const resto = gastoMes[k] - 38900 - 800000;
    filas.push(base(`${mes}-01`, 'gasto', 800000, 'Arriendo', 'arriendo'));
    for (let d = 0; d < 100; d++) filas.push(base(`${mes}-${String(1 + (d % 28)).padStart(2, '0')}`, 'gasto', resto / 100, 'Tinto y antojos', 'tinto ' + d));
  }
  filas.push(base('2026-11-01', 'gasto', 800000, 'Arriendo', 'arriendo'));
  filas.sort((a, b) => a.dia.localeCompare(b.dia));
  const sum = (t: string) => filas.filter((f) => f.tipo === t).reduce((a, f) => a + f.cop, 0);
  return {
    resumen: {
      version: 1, generado_en: '2026-11-18T20:00:00Z', zona_horaria: 'America/Bogota', hoy: '2026-11-18', desde: '2026-04-01', hasta: '2026-11-18', tasas: [],
      foto: { disponible: 2000000, en_cuentas: 4000000, apartado_metas: 0, debes: 0, te_deben: 1000000, patrimonio: 3200000 },
      totales: { movimientos: filas.length, ingresos: sum('ingreso'), gastos: sum('gasto'), ajustes: 0, primer_dia: filas[0].dia, ultimo_dia: filas.at(-1)!.dia },
      meses: [], categorias_mes: [],
      cuentas: [
        { nombre: 'Banco', tipo: 'ahorro', moneda: 'COP', saldo: 3800000, saldo_cop: 3800000, activa: true },
        { nombre: 'Dólares', tipo: 'broker', moneda: 'USD', saldo: 600, saldo_cop: 2000000, activa: true },
        { nombre: 'Tarjeta', tipo: 'tarjeta', moneda: 'COP', saldo: -1800000, saldo_cop: -1800000, activa: true },
      ],
      metas: [], categorias: [], capturas_voz: [],
      deudas: [{ contraparte: 'Andrea', concepto: null, tipo: 'por_cobrar', moneda: 'COP', total: 1000000, pagado: 0, pendiente: 1000000, pendiente_cop: 1000000, estado: 'activa', vence: null, activa: true, primer_movimiento: '2026-08-01', prestado: 1000000, abonado: 0, movimientos: 1 }],
    },
    movimientos: filas,
  };
}

export const T2: DocumentoExport = t2();
