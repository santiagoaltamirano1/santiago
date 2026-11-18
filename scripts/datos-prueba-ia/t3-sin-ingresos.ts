// Perfil de prueba T3 (sin onboarding, sin ingresos): 2 meses de datos, ningún ingreso, colchón de unos 2 meses,
// le deben el 40 % de su patrimonio. Trampas: deudores con nombre propio ("Andrés Gómez", "Lucía") también en notas.
import type { DocumentoExport, FilaMovimiento } from '../../src/ia/tipos';

const g = (dia: string, cop: number, categoria: string, detalle: string, extra: Partial<FilaMovimiento> = {}): FilaMovimiento => ({
  dia, hora: '09:00', tipo: 'gasto', cuenta_como: 'Gasto', categoria, detalle, cuenta: 'Ahorros', destino: null, meta: null, deuda: null,
  operacion_deuda: null, monto: cop, moneda: 'COP', tasa_cop: 1, cop, efecto_cuenta: -1, saldo_anterior: null, saldo_nuevo: null, origen: 'manual', ...extra,
});

const filas: FilaMovimiento[] = [];
for (const mes of ['2026-09', '2026-10', '2026-11']) {
  if (mes !== '2026-11') {
    filas.push(g(`${mes}-01`, 450000, 'Arriendo', 'arriendo pieza'));
    filas.push(g(`${mes}-15`, 60000, 'Servicios', 'plan celular'));
  }
  const hasta = mes === '2026-11' ? 18 : 28;
  for (let d = 2; d <= hasta; d += 2) filas.push(g(`${mes}-${String(d).padStart(2, '0')}`, 9000, 'Comida', d % 4 ? 'almuerzo corrientazo' : 'pan y café'));
}
filas.push(g('2026-09-20', 400000, 'x', 'Préstamo a Andrés Gómez para el carro', { tipo: 'prestamo_capital', cuenta_como: 'No cuenta', categoria: null, deuda: 'Andrés Gómez' }));
filas.push(g('2026-10-03', 150000, 'x', 'le presté a Lucía', { tipo: 'prestamo_capital', cuenta_como: 'No cuenta', categoria: null, deuda: 'Lucía' }));
filas.sort((a, b) => a.dia.localeCompare(b.dia));
const gastos = filas.filter((f) => f.tipo === 'gasto').reduce((a, f) => a + f.cop, 0);

export const T3: DocumentoExport = {
  resumen: {
    version: 1, generado_en: '2026-11-18T20:00:00Z', zona_horaria: 'America/Bogota', hoy: '2026-11-18', desde: '2026-09-01', hasta: '2026-11-18', tasas: [],
    foto: { disponible: 825000, en_cuentas: 825000, apartado_metas: 0, debes: 0, te_deben: 550000, patrimonio: 1375000 },
    totales: { movimientos: filas.length, ingresos: 0, gastos, ajustes: 0, primer_dia: filas[0].dia, ultimo_dia: filas.at(-1)!.dia },
    // Lo que el servidor manda siempre: meses y categorías del rango, calculados de las mismas filas
    meses: ['2026-09', '2026-10', '2026-11'].map((mes) => ({ mes, ingresos: 0, gastos: filas.filter((f) => f.tipo === 'gasto' && f.dia.startsWith(mes)).reduce((a, f) => a + f.cop, 0), ajustes: 0, movimientos: filas.filter((f) => f.tipo === 'gasto' && f.dia.startsWith(mes)).length })),
    categorias_mes: ['2026-09', '2026-10', '2026-11'].flatMap((mes) => ['Arriendo', 'Comida', 'Servicios'].map((categoria) => {
      const l = filas.filter((f) => f.tipo === 'gasto' && f.dia.startsWith(mes) && f.categoria === categoria);
      return { mes, tipo: 'gasto' as const, categoria, total: l.reduce((a, f) => a + f.cop, 0), movimientos: l.length };
    }).filter((c) => c.movimientos > 0)),
    cuentas: [{ nombre: 'Ahorros', tipo: 'ahorro', moneda: 'COP', saldo: 825000, saldo_cop: 825000, activa: true }],
    metas: [], capturas_voz: [],
    categorias: [{ nombre: 'Arriendo', tipo: 'gasto', grupo: 'Vivienda', activa: true, movimientos: 2 }, { nombre: 'Comida', tipo: 'gasto', grupo: 'Gastos diarios', activa: true, movimientos: 37 }, { nombre: 'Servicios', tipo: 'gasto', grupo: 'Gastos fijos', activa: true, movimientos: 2 }],
    deudas: [
      { contraparte: 'Andrés Gómez', concepto: 'Para el carro', tipo: 'por_cobrar', moneda: 'COP', total: 400000, pagado: 0, pendiente: 400000, pendiente_cop: 400000, estado: 'activa', vence: '2026-10-30', activa: true, primer_movimiento: '2026-09-20', prestado: 400000, abonado: 0, movimientos: 1 },
      { contraparte: 'Lucía', concepto: null, tipo: 'por_cobrar', moneda: 'COP', total: 150000, pagado: 0, pendiente: 150000, pendiente_cop: 150000, estado: 'activa', vence: null, activa: true, primer_movimiento: '2026-10-03', prestado: 150000, abonado: 0, movimientos: 1 },
    ],
  },
  movimientos: filas,
};
