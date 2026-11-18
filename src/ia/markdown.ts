// Iteración 2 · F3 · Documento Markdown de Exportar (orden fijo del diseño §2.2: solo encabezados y tablas).
// Función PURA: recibe el DocumentoExport y devuelve texto. Nunca lleva ids, correos ni llaves.
import type { DocumentoExport, FilaMovimiento } from './tipos';
import { formatMonto } from '../utils/money';
import { aliasTerceros, diasEntre, verificarCoherencia } from './indicadores';

export type ModoExport = 'datos' | 'ia';

export interface OpcionesMarkdown {
  modo?: ModoExport;               // 'datos' = todo; 'ia' = recortado para pegar en una IA (paquete del agente, F4)
  anonimizar?: boolean;            // nombres de terceros → "Persona A, B…"
  secciones?: number[];            // 1..11; por defecto todas (en modo 'ia' la 9 se excluye siempre)
}

export const SECCIONES: { n: number; titulo: string }[] = [
  { n: 1, titulo: 'Datos de la exportación' },
  { n: 2, titulo: 'Cómo leer este documento' },
  { n: 3, titulo: 'Resumen' },
  { n: 4, titulo: 'Cuentas' },
  { n: 5, titulo: 'Metas' },
  { n: 6, titulo: 'Deudas' },
  { n: 7, titulo: 'Movimientos' },
  { n: 8, titulo: 'Ajustes de saldo' },
  { n: 9, titulo: 'Capturas de voz' },
  { n: 10, titulo: 'Categorías' },
  { n: 11, titulo: 'Notas de calidad' },
];

export const MUESTRA_IA = { dias: 90, filas: 150, nota: 40, meses_categoria: 12 };

export const GLOSARIO: { tipo: string; que_es: string; cuenta_como: string }[] = [
  { tipo: 'ingreso', que_es: 'Plata que te entró (sueldo, mesada, ventas)', cuenta_como: 'Ingreso' },
  { tipo: 'gasto', que_es: 'Plata que gastaste', cuenta_como: 'Gasto' },
  { tipo: 'transferencia', que_es: 'Pasar plata entre tus propias cuentas', cuenta_como: 'No cuenta' },
  { tipo: 'ajuste', que_es: 'Corrección del saldo de una cuenta para que cuadre con la realidad', cuenta_como: 'No cuenta' },
  { tipo: 'aporte_meta', que_es: 'Apartar plata para una meta (sigue siendo tuya)', cuenta_como: 'No cuenta' },
  { tipo: 'retiro_meta', que_es: 'Sacar plata apartada de una meta', cuenta_como: 'No cuenta' },
  { tipo: 'prestamo_capital', que_es: 'Prestar plata o recibir un préstamo (crece una deuda)', cuenta_como: 'No cuenta' },
  { tipo: 'abono_capital', que_es: 'Pagar o recibir un pago de una deuda', cuenta_como: 'No cuenta' },
];

// ---------------------------------------------------------------------------
const cel = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—';
  return String(v).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[correo]')
    .replace(/[0-9a-fA-F]{8}-[0-9a-fA-F-]{2,}/g, '[id]');
};
const tabla = (cab: string[], filas: unknown[][]) =>
  [`| ${cab.join(' | ')} |`, `|${cab.map(() => '---').join('|')}|`, ...filas.map((f) => `| ${f.map(cel).join(' | ')} |`)].join('\n');
const cop = (v: number) => formatMonto(v, 'COP', 'auto');
const pct = (v: number | null) => (v === null || !Number.isFinite(v) ? '—' : (v * 100).toFixed(1).replace('.', ',') + ' %');
const tasa = (v: number) => { const [e, d] = v.toFixed(2).split('.'); return '$' + e.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d; };
const recortar = (s: string | null, n: number) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s);

export function montoFila(f: FilaMovimiento): string {
  const signo = f.tipo === 'gasto' ? 'gasto' : f.tipo === 'ingreso' ? 'ingreso' : f.tipo === 'ajuste' ? (f.cop < 0 ? 'gasto' : 'ingreso') : 'neutro';
  return formatMonto(f.monto, f.moneda, signo);
}

/** Cambia nombres de terceros por su alias: nombre completo y primer nombre suelto, palabra completa, sin importar mayúsculas. */
export function anonimizarTexto(texto: string, alias: Map<string, string>): string {
  let t = texto;
  // primero los nombres más largos, para que "Camilo Pérez" gane a "Camilo"
  const pares: [string, string][] = [];
  alias.forEach((a, nombre) => {
    const completo = nombre.trim();
    const primero = completo.split(/\s+/)[0];
    if (completo.length >= 3) pares.push([completo, a]);
    if (primero !== completo && primero.length >= 3) pares.push([primero, a]);
  });
  pares.sort((x, y) => y[0].length - x[0].length).forEach(([p, a]) => {
    t = t.replace(new RegExp(`(?<![\\p{L}])${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'giu'), a);
  });
  return t;
}

/** Tokens aproximados (≈ 4 caracteres por token en español con tablas). */
export const estimarTokens = (texto: string) => Math.ceil(texto.length / 4);

export function aMarkdown(doc: DocumentoExport, op: OpcionesMarkdown = {}): string {
  const modo = op.modo || 'datos';
  const R = doc.resumen;
  const quiero = (n: number) => (!op.secciones || op.secciones.includes(n)) && !(modo === 'ia' && n === 9);
  const alias = aliasTerceros(doc);
  const tercero = (nombre: string | null) => (nombre && op.anonimizar ? alias.get(nombre) || 'Persona' : nombre);
  const nota = (s: string | null) => {
    let t = s;
    if (op.anonimizar && t) t = anonimizarTexto(t, alias);
    return modo === 'ia' ? recortar(t, MUESTRA_IA.nota) : t;
  };
  const out: string[] = ['# Mis finanzas en Lumi', ''];

  if (quiero(1)) {
    out.push('## 1. Datos de la exportación', tabla(['Dato', 'Valor'], [
      ['Generado', R.generado_en.slice(0, 16).replace('T', ' ') + ' (UTC)'],
      ['Zona horaria de las fechas', R.zona_horaria],
      ['Rango', `${R.desde} a ${R.hasta}`],
      ['Moneda de los totales', 'COP (pesos colombianos)'],
      ...R.tasas.map((t) => [`Tasa ${t.moneda}`, `${tasa(t.cop_por_unidad)} por 1 ${t.moneda} (${t.fuente}, desde ${t.vigente_desde})`]),
      ['Versión del formato', `exportar v${R.version}${modo === 'ia' ? ' · modo IA' : ''}`],
    ]), '');
  }

  if (quiero(2)) {
    out.push('## 2. Cómo leer este documento',
      'Solo las filas con "Cuenta como" = Ingreso o Gasto son ingresos o gastos. Las transferencias, ajustes, metas y deudas mueven plata pero no son ingreso ni gasto.',
      '', tabla(['Tipo', 'Qué es', 'Cuenta como'], GLOSARIO.map((g) => [g.tipo, g.que_es, g.cuenta_como])), '');
  }

  if (quiero(3)) {
    const f = R.foto;
    out.push('## 3. Resumen', '### Hoy', tabla(['Concepto', 'Valor'], [
      ['Disponible (cuentas que no son tarjeta − apartado en metas)', cop(f.disponible)],
      ['En tus cuentas', cop(f.en_cuentas)],
      ['Apartado en metas', cop(f.apartado_metas)],
      ['Debes', cop(f.debes)],
      ['Te deben', cop(f.te_deben)],
      ['Patrimonio (cuentas + te deben − debes)', cop(f.patrimonio)],
    ]), '', '### Por mes', R.meses.length ? tabla(['Mes', 'Entró', 'Salió', 'Diferencia', 'Ajustes', 'Movimientos'],
      R.meses.map((m) => [m.mes, cop(m.ingresos), cop(m.gastos), cop(m.ingresos - m.gastos), cop(m.ajustes), m.movimientos])) : 'Sin movimientos.',
      '', `Total del rango: entró ${cop(R.totales.ingresos)} · salió ${cop(R.totales.gastos)}.`, '');
    const meses = [...new Set(R.categorias_mes.map((c) => c.mes))].sort();
    const visibles = modo === 'ia' ? meses.slice(-MUESTRA_IA.meses_categoria) : meses;
    const filasCat = R.categorias_mes.filter((c) => visibles.includes(c.mes));
    out.push('### Por categoría y mes', filasCat.length
      ? tabla(['Mes', 'Tipo', 'Categoría', 'Total', 'Movimientos'], filasCat.map((c) => [c.mes, c.tipo === 'gasto' ? 'Gasto' : 'Ingreso', c.categoria, cop(c.total), c.movimientos]))
      : 'Sin movimientos.', '');
  }

  if (quiero(4)) {
    out.push('## 4. Cuentas', R.cuentas.length ? tabla(['Cuenta', 'Tipo', 'Moneda', 'Saldo', 'Saldo en COP', 'Estado'],
      R.cuentas.map((c) => [c.nombre, c.tipo, c.moneda, formatMonto(c.saldo, c.moneda), cop(c.saldo_cop), c.activa ? 'Activa' : 'Archivada'])) : 'Sin cuentas.', '');
  }

  if (quiero(5)) {
    out.push('## 5. Metas', R.metas.length ? tabla(['Meta', 'Objetivo', 'Llevas', 'Falta', 'Fecha límite', 'Apartado en el rango', 'Sacado en el rango', 'Último movimiento', 'Estado'],
      R.metas.map((g) => [g.nombre, cop(g.objetivo), cop(g.actual), cop(Math.max(0, g.objetivo - g.actual)), g.fecha_limite, cop(g.aportes), cop(g.retiros), g.ultimo_movimiento, g.activa ? 'Activa' : 'Archivada'])) : 'Sin metas.', '');
  }

  if (quiero(6)) {
    out.push('## 6. Deudas', R.deudas.length ? tabla(['Con', 'Concepto', 'Tipo', 'Moneda', 'Total', 'Pagado', 'Pendiente', 'Pendiente en COP', 'Vence', 'Estado'],
      R.deudas.map((d) => [tercero(d.contraparte), nota(d.concepto), d.tipo === 'por_pagar' ? 'Debo' : 'Me deben', d.moneda, formatMonto(d.total, d.moneda), formatMonto(d.pagado, d.moneda),
        formatMonto(d.pendiente, d.moneda), cop(d.pendiente_cop), d.vence, !d.activa ? 'Archivada' : d.estado === 'saldada' ? 'Saldada' : 'Activa'])) : 'Sin deudas.', '');
  }

  if (quiero(7)) {
    let filas = doc.movimientos;
    let titulo = `## 7. Movimientos (${filas.length})`;
    if (modo === 'ia') {
      const desde90 = filas.filter((f) => diasEntre(f.dia, R.hasta) < MUESTRA_IA.dias);
      const muestra = desde90.slice(-MUESTRA_IA.filas);
      titulo = `## 7. Movimientos (muestra: ${muestra.length} de ${filas.length}; últimos ${MUESTRA_IA.dias} días, máximo ${MUESTRA_IA.filas}. Los totales y los indicadores usan TODOS)`;
      filas = muestra;
    }
    out.push(titulo, filas.length ? tabla(['Fecha', 'Tipo', 'Cuenta como', 'Categoría', 'Detalle', 'Cuenta', 'Destino', 'Meta o deuda', 'Monto', 'En COP', 'Tasa', 'Origen'],
      filas.map((f) => [f.dia + ' ' + f.hora, f.tipo, f.cuenta_como, f.categoria, nota(f.detalle), f.cuenta, f.destino, f.meta || tercero(f.deuda),
        montoFila(f), f.moneda === 'COP' ? '' : cop(f.cop), f.tasa_cop && f.moneda !== 'COP' ? tasa(f.tasa_cop) : '', f.origen === 'ia_voz' ? 'voz' : f.origen])) : 'Sin movimientos.', '');
  }

  if (quiero(8)) {
    const aj = doc.movimientos.filter((f) => f.tipo === 'ajuste');
    const total = aj.reduce((a, f) => a + f.cop, 0);
    out.push('## 8. Ajustes de saldo', modo === 'ia'
      ? `${aj.length} ${aj.length === 1 ? 'ajuste' : 'ajustes'} en el rango; efecto total ${cop(total)}. No son ingreso ni gasto.`
      : aj.length ? tabla(['Fecha', 'Cuenta', 'Saldo anterior', 'Saldo nuevo', 'Diferencia', 'Detalle'],
        aj.map((f) => [f.dia, f.cuenta, f.saldo_anterior === null ? '' : formatMonto(f.saldo_anterior, f.moneda), f.saldo_nuevo === null ? '' : formatMonto(f.saldo_nuevo, f.moneda), montoFila(f), nota(f.detalle)]))
        : 'Sin ajustes.', '');
  }

  if (quiero(9)) {
    out.push('## 9. Capturas de voz', R.capturas_voz.length ? tabla(['Fecha', 'Lo que dijiste', 'Estado', 'Movimientos guardados'],
      R.capturas_voz.map((c) => [c.fecha, nota(c.texto), c.estado, c.movimientos])) : 'Sin capturas de voz.', '');
  }

  if (quiero(10)) {
    out.push('## 10. Categorías', R.categorias.length ? tabla(['Categoría', 'Tipo', 'Grupo', 'Movimientos en el rango', 'Estado'],
      R.categorias.map((c) => [c.nombre, c.tipo, c.grupo, c.movimientos, c.activa ? 'Activa' : 'Archivada'])) : 'Sin categorías.', '');
  }

  if (quiero(11)) {
    const coh = verificarCoherencia(doc);
    out.push('## 11. Notas de calidad', tabla(['Revisión', 'Resultado'], [
      ['Las filas suman lo mismo que los totales del servidor', coh.ok ? 'Sí' : `NO: ${coh.detalle}`],
      ['Movimientos en el rango', R.totales.movimientos],
      ['Primer y último día con datos', `${R.totales.primer_dia || '—'} a ${R.totales.ultimo_dia || '—'}`],
      ['Nombres de terceros', op.anonimizar ? 'Cambiados por Persona A, B…' : 'Incluidos'],
    ]), '');
  }
  let texto = out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  // En modo IA los títulos del documento no deben parecerse a los del informe ("## 1. En 30 segundos"): van como "### D1."
  if (modo === 'ia') texto = texto.replace(/^# Mis finanzas en Lumi$/m, '## Mis finanzas en Lumi (datos)').replace(/^## (\d+)\. /gm, '### D$1. ').replace(/^### (Hoy|Por mes|Por categoría y mes)$/gm, '#### $1');
  return texto;
}
