// Iteración 2 · F3 · Indicadores precalculados para el agente analista (diseño: docs/fases/MESA_AGENTE_ANALISTA_v1.md §2.2).
// Funciones PURAS: reciben el DocumentoExport y devuelven cifras con ID. La IA nunca calcula: solo cita estos IDs.
// Convenciones: COP = columna `cop` de cada fila (regla de /api/resumen (motor/reportes.ts)). Gasto e ingreso = solo tipos 'gasto' e 'ingreso'.
// Factor mensual 30,4 · anual 365 · proyecciones redondeadas al $1.000.
import type { DocumentoExport, FilaMovimiento } from './tipos';
import { REFERENCIAS, Referencia, claseCategoria, ClaseCategoria, referenciasVigentes, valorRef } from './referencias';

export const FACTOR_MES = 30.4;
export const FACTOR_ANO = 365;
const HORMIGA_DEFECTO = 25000;

// ---------------------------------------------------------------------------
// Fechas (texto AAAA-MM-DD, sin zonas horarias)
// ---------------------------------------------------------------------------
const utc = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
export const diasEntre = (a: string, b: string) => Math.round((utc(b) - utc(a)) / 864e5);
const mesDe = (d: string) => d.slice(0, 7);
export function sumarMeses(mes: string, k: number): string {
  const t = +mes.slice(0, 4) * 12 + (+mes.slice(5, 7) - 1) + k;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}
const difMeses = (a: string, b: string) => (+b.slice(0, 4) * 12 + +b.slice(5, 7)) - (+a.slice(0, 4) * 12 + +a.slice(5, 7));
const finDeMes = (mes: string) => { const s = sumarMeses(mes, 1) + '-01'; return new Date(utc(s) - 864e5).toISOString().slice(0, 10); };
const r1000 = (v: number) => Math.round(v / 1000) * 1000;

// ---------------------------------------------------------------------------
// Agrupar por "detalle normalizado": minúsculas, sin tildes ni números, primeras 2 palabras (vacío → categoría)
// ---------------------------------------------------------------------------
// Notas que escribe la propia app (no la persona): no son un hábito, cuentan como su categoría
const NOTA_AUTOMATICA = /^(gasto|ingreso|registro (gasto|ingreso|transferencia)|aporte a meta|retiro de meta|abono a deuda|incremento a deuda|aumento de deuda|ajuste de saldo|saldo inicial)\b/i;

// Palabras vacías: no cuentan para agrupar ("pan y café" → "pan cafe", no "pan y")
const VACIAS = new Set(['y', 'e', 'o', 'u', 'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'en', 'a', 'al', 'con', 'para', 'por', 'mi', 'mis', 'su', 'sus', 'que', 'lo']);

export function normalizarDetalle(detalle: string | null | undefined, categoria: string | null | undefined): string {
  const sinTilde = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const d = sinTilde(detalle || '');
  const c = sinTilde(categoria || '');
  if (NOTA_AUTOMATICA.test(d) && (!c || d.endsWith(c) || d.includes(':'))) detalle = '';
  const limpio = (detalle || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\[id\]/g, ' ').replace(/[0-9]/g, ' ').replace(/[^a-zñ ]/g, ' ').trim().split(/\s+/).filter((w) => w && !VACIAS.has(w)).slice(0, 2).join(' ');
  return limpio || (categoria || 'sin categoría').toLowerCase();
}

/** "Persona A, B…" para los nombres de terceros (orden estable: el de la lista de deudas). */
export function aliasTerceros(doc: DocumentoExport): Map<string, string> {
  const m = new Map<string, string>();
  doc.resumen.deudas.forEach((d) => {
    if (!m.has(d.contraparte)) {
      const i = m.size;
      m.set(d.contraparte, 'Persona ' + (i < 26 ? String.fromCharCode(65 + i) : 'Z' + (i - 25)));
    }
  });
  return m;
}

// ---------------------------------------------------------------------------
// Tipos de salida
// ---------------------------------------------------------------------------
export type BanderaCalidad = 'CALIDAD_POCOS_DIAS' | 'CALIDAD_SUBREGISTRO' | 'SIN_INGRESOS' | 'MUESTRA_RECORTADA' | 'COHERENCIA_FALLA';

export interface IndCategoria { categoria: string; clase: ClaseCategoria; mensual: number; pct_ingreso: number | null; pct_gasto: number; movimientos: number; ticket: number; barra: string }
export interface IndGrupo { grupo: string; movimientos: number; ticket: number; por_semana: number; mensual: number; anual: number; categoria: string }
export interface IndMeta { nombre: string; objetivo: number; actual: number; falta: number; aporte_ref: number; fecha_limite: string | null; meses_hasta_limite: number | null; requerido: number | null; meses_estimados: number | null; fecha_estimada: string | null; estado: 'cumplida' | 'a_tiempo' | 'atrasada' | 'sin_aportes' }
export interface IndDeuda { contraparte: string; alias: string; tipo: 'por_cobrar' | 'por_pagar'; pendiente_cop: number; vence: string | null; dias_al_vencimiento: number | null; abono_ref: number; meses_para_saldar: number | null; alerta: 'VENCIDA' | 'VENCE_30' | null }
export interface Palanca { id: string; tipo: 'habito' | 'categoria' | 'recurrente'; nombre: string; porcentaje: number; base_mensual: number; ahorro_mensual: number; a3: number; a6: number; a12: number; nota?: string }
export interface Escenario { id: 'E1' | 'E2' | 'E3'; nombre: string; serie: number[]; m3: number; m6: number; m12: number; supuesto: string }
export interface Grafico { id: string; titulo: string; tipo: 'bar' | 'line'; horizontal: boolean; etiquetas: string[]; series: { nombre: string; color: 'ingreso' | 'gasto' | 'neutro' | 'plan' | 'tendencia'; valores: (number | null)[] }[] }

export interface Indicadores {
  corte: string;
  inicio_ventana: string;
  dias_obs: number;
  meses_cerrados: string[];
  calidad: BanderaCalidad[];
  coherencia: { ok: boolean; detalle: string };
  I01: { valor: number; estimado: boolean };
  I01b: number;
  I02: number;
  I03: { cv: number; irregular: boolean } | null;
  I04: number;
  I05: number;
  I06: { margen: number; tasa_ahorro: number | null };
  I07: IndCategoria[];
  I08: { pendiente: number; pct: number | null } | null;
  I09: { grupos: IndGrupo[]; total_mensual: number; total_anual: number; umbral: number };
  I10: IndGrupo[];
  I11: { pct_fin_de_semana: number | null; por_dia: { dia: string; total: number }[] };
  I12: { grupo: string; categoria: string; mensual: number; meses: number }[];
  I13: { disponible: number; meses: number | null; objetivos: { meses: number; monto: number; falta: number }[] };
  I14: IndMeta[];
  I15: IndDeuda[];
  I16: { saldo: number; costo_ref_mensual: number; tasa_mensual: number } | null;
  I17: { te_deben: number; pct_patrimonio: number | null; dias_desde_el_mas_antiguo: number | null } | null;
  I18: { saldo_usd: number; valor_cop: number; pct_cuentas: number | null; sensibilidad_10: number } | null;
  I19: { patrimonio: number; escenarios: Escenario[] };
  P: Palanca[];
  plan: { ids: string[]; mensual: number };
  graficos: { corte: string; graficos: Grafico[] };
  referencias: Referencia[];
}

// ---------------------------------------------------------------------------
// Control de coherencia: las filas deben sumar lo mismo que los totales del servidor
// ---------------------------------------------------------------------------
export function verificarCoherencia(doc: DocumentoExport): { ok: boolean; detalle: string } {
  const t = doc.resumen.totales;
  const s = (tipo: string) => doc.movimientos.filter((f) => f.tipo === tipo).reduce((a, f) => a + f.cop, 0);
  const tol = Math.max(2, doc.movimientos.length); // cada fila se redondea a peso: ±1 por fila
  const problemas: string[] = [];
  if (doc.movimientos.length !== t.movimientos) problemas.push(`filas ${doc.movimientos.length} ≠ ${t.movimientos}`);
  if (Math.abs(s('gasto') - t.gastos) > tol) problemas.push(`gastos ${Math.round(s('gasto'))} ≠ ${t.gastos}`);
  if (Math.abs(s('ingreso') - t.ingresos) > tol) problemas.push(`ingresos ${Math.round(s('ingreso'))} ≠ ${t.ingresos}`);
  return problemas.length ? { ok: false, detalle: problemas.join('; ') } : { ok: true, detalle: 'Las filas suman lo mismo que los totales del servidor' };
}

// ---------------------------------------------------------------------------
// Cálculo principal
// ---------------------------------------------------------------------------
export function calcularIndicadores(doc: DocumentoExport, refsBase: Referencia[] = REFERENCIAS, corteForzado?: string): Indicadores {
  const R = doc.resumen;
  const corte = corteForzado || R.hasta || R.hoy;
  const refs = referenciasVigentes(corte, refsBase);
  const umbral = valorRef('R04', refs) ?? HORMIGA_DEFECTO;
  const usura = valorRef('R02', refs);
  const mesCorte = mesDe(corte);
  const todas = doc.movimientos.filter((f) => f.dia <= corte);

  // Ventana: hasta 6 meses cerrados antes del mes de corte + el mes en curso
  const primerDia = todas.length ? todas.reduce((m, f) => (f.dia < m ? f.dia : m), todas[0].dia) : corte;
  const inicio = [sumarMeses(mesCorte, -6) + '-01', R.desde || primerDia, primerDia].reduce((a, b) => (a > b ? a : b));
  const dias = Math.max(1, diasEntre(inicio, corte) + 1);
  const ven = todas.filter((f) => f.dia >= inicio);
  const gastos = ven.filter((f) => f.tipo === 'gasto');
  const ingresos = ven.filter((f) => f.tipo === 'ingreso');

  const porMes = (lista: FilaMovimiento[], mes: string) => lista.filter((f) => mesDe(f.dia) === mes).reduce((a, f) => a + f.cop, 0);
  const cerrados = Array.from({ length: 6 }, (_, i) => sumarMeses(mesCorte, i - 6))
    .filter((m) => m >= mesDe(inicio) && ven.some((f) => mesDe(f.dia) === m && (f.tipo === 'gasto' || f.tipo === 'ingreso')));
  const n = cerrados.length;
  const ingMes = cerrados.map((m) => porMes(ingresos, m));
  const gasMes = cerrados.map((m) => porMes(gastos, m));

  // I01–I03 ingresos
  const I01 = n > 0 ? { valor: ingMes.reduce((a, b) => a + b, 0) / n, estimado: false } : { valor: porMes(ingresos, mesCorte), estimado: true };
  const I01b = I01.valor / 4.33;
  const I02 = n >= 2 ? Math.min(...ingMes) : I01.valor;
  let I03: Indicadores['I03'] = null;
  if (n >= 3) {
    const mu = ingMes.reduce((a, b) => a + b, 0) / n;
    const sigma = Math.sqrt(ingMes.reduce((a, b) => a + (b - mu) ** 2, 0) / n);
    const cv = mu > 0 ? sigma / mu : 0;
    I03 = { cv, irregular: cv > 0.25 };
  }

  // I04–I06 gasto y margen
  const G = gastos.reduce((a, f) => a + f.cop, 0);
  const I05 = G / dias;
  const I04 = I05 * FACTOR_MES;
  const margen = I01.valor - I04;
  const I06 = { margen, tasa_ahorro: I01.valor > 0 ? margen / I01.valor : null };

  // I07 categorías
  const cats = new Map<string, FilaMovimiento[]>();
  gastos.forEach((f) => { const k = f.categoria || 'Sin categoría'; cats.set(k, [...(cats.get(k) || []), f]); });
  const crudo = [...cats.entries()].map(([categoria, l]) => {
    const total = l.reduce((a, f) => a + f.cop, 0);
    return { categoria, clase: claseCategoria(categoria), total, mensual: (total / dias) * FACTOR_MES, movimientos: l.length, ticket: total / l.length };
  }).sort((a, b) => b.mensual - a.mensual);
  const mayor = crudo[0]?.mensual || 0;
  const I07: IndCategoria[] = crudo.map((c) => ({
    categoria: c.categoria, clase: c.clase, mensual: c.mensual, movimientos: c.movimientos, ticket: c.ticket,
    pct_ingreso: I01.valor > 0 ? c.mensual / I01.valor : null,
    pct_gasto: G > 0 ? c.total / G : 0,
    barra: '█'.repeat(mayor > 0 ? Math.round((10 * c.mensual) / mayor) : 0),
  }));

  // I08 tendencia del gasto (mínimos cuadrados sobre meses cerrados)
  let I08: Indicadores['I08'] = null;
  if (n >= 3) {
    const xm = (n - 1) / 2, ym = gasMes.reduce((a, b) => a + b, 0) / n;
    const num = gasMes.reduce((a, y, x) => a + (x - xm) * (y - ym), 0);
    const den = gasMes.reduce((a, _y, x) => a + (x - xm) ** 2, 0);
    const b = den ? num / den : 0;
    I08 = { pendiente: b, pct: ym ? b / ym : null };
  }

  // I09 hormiga e I10 top detalles
  const agrupar = (lista: FilaMovimiento[]): IndGrupo[] => {
    const m = new Map<string, FilaMovimiento[]>();
    lista.forEach((f) => { const k = normalizarDetalle(f.detalle, f.categoria); m.set(k, [...(m.get(k) || []), f]); });
    return [...m.entries()].map(([grupo, l]) => {
      const total = l.reduce((a, f) => a + f.cop, 0);
      return { grupo, categoria: l[0].categoria || 'Sin categoría', movimientos: l.length, ticket: total / l.length, por_semana: l.length / (dias / 7), mensual: (total / dias) * FACTOR_MES, anual: (total / dias) * FACTOR_ANO };
    }).sort((a, b) => b.mensual - a.mensual);
  };
  // Recortable = ni la categoría ni el detalle son esenciales ("almuerzo corrientazo" en Comida no se recorta; "pan y café" sí)
  const recortable = (f: FilaMovimiento) => claseCategoria(f.categoria) !== 'esencial' && !(f.detalle && claseCategoria(f.detalle) === 'esencial');
  const hormiga = agrupar(gastos.filter((f) => f.cop <= umbral && recortable(f)));
  const I09 = { grupos: hormiga, total_mensual: hormiga.reduce((a, g) => a + g.mensual, 0), total_anual: hormiga.reduce((a, g) => a + g.anual, 0), umbral };
  const I10 = agrupar(gastos).slice(0, 10);

  // I11 ritmo semanal
  const nombresDia = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const porDia = nombresDia.map((dia, i) => ({ dia, total: gastos.filter((f) => new Date(utc(f.dia)).getUTCDay() === i).reduce((a, f) => a + f.cop, 0) }));
  const I11 = { pct_fin_de_semana: G > 0 ? (porDia[0].total + porDia[6].total) / G : null, por_dia: [...porDia.slice(1), porDia[0]] };

  // I12 recurrentes: mismo detalle en ≥ 2 de los últimos 3 meses cerrados, montos a ±15 % de su mediana
  const I12: Indicadores['I12'] = [];
  if (n >= 2) {
    const ult3 = [1, 2, 3].map((k) => sumarMeses(mesCorte, -k));
    const m = new Map<string, FilaMovimiento[]>();
    gastos.filter((f) => ult3.includes(mesDe(f.dia))).forEach((f) => { const k = normalizarDetalle(f.detalle, f.categoria); m.set(k, [...(m.get(k) || []), f]); });
    m.forEach((l, grupo) => {
      // Un recurrente es un cobro fijo (máx. 2 por mes), no un hábito diario: se mide con el total de cada mes
      const totales = new Map<string, { n: number; total: number }>();
      l.forEach((f) => { const t = totales.get(mesDe(f.dia)) || { n: 0, total: 0 }; totales.set(mesDe(f.dia), { n: t.n + 1, total: t.total + f.cop }); });
      if (totales.size < 2 || [...totales.values()].some((t) => t.n > 2)) return;
      const v = [...totales.values()].map((t) => t.total).sort((a, b) => a - b);
      const med = v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
      if (v.every((x) => Math.abs(x - med) <= 0.15 * med)) I12.push({ grupo, categoria: l[0].categoria || 'Sin categoría', mensual: med, meses: totales.size });
    });
    I12.sort((a, b) => b.mensual - a.mensual);
  }

  // I13 colchón
  const disponible = R.foto.disponible;
  const I13 = {
    disponible,
    meses: I04 > 0 ? disponible / I04 : null,
    objetivos: [1, 3, 6].map((k) => ({ meses: k, monto: k * I04, falta: Math.max(0, k * I04 - disponible) })),
  };

  // Referencia de aportes y abonos: últimos 3 meses (incluido el actual) / meses con datos (máx. 3)
  const ult3conActual = [0, 1, 2].map((k) => sumarMeses(mesCorte, -k));
  const ritmo = (filtro: (f: FilaMovimiento) => boolean, signo: (f: FilaMovimiento) => number) => {
    const l = todas.filter((f) => ult3conActual.includes(mesDe(f.dia)) && filtro(f));
    const meses = new Set(l.map((f) => mesDe(f.dia))).size;
    return meses ? l.reduce((a, f) => a + signo(f) * f.cop, 0) / Math.min(3, meses) : 0;
  };

  // I14 metas activas
  const I14: IndMeta[] = R.metas.filter((g) => g.activa).map((g) => {
    const falta = Math.max(0, g.objetivo - g.actual);
    const aporte_ref = ritmo((f) => f.meta === g.nombre && (f.tipo === 'aporte_meta' || f.tipo === 'retiro_meta'), (f) => (f.tipo === 'retiro_meta' ? -1 : 1));
    const meses_hasta = g.fecha_limite ? Math.max(1, difMeses(mesCorte, mesDe(g.fecha_limite))) : null;
    const requerido = meses_hasta ? falta / meses_hasta : null;
    const meses_estimados = aporte_ref > 0 && falta > 0 ? Math.ceil(falta / aporte_ref) : falta === 0 ? 0 : null;
    const estado: IndMeta['estado'] = falta === 0 ? 'cumplida' : aporte_ref <= 0 ? 'sin_aportes'
      : meses_hasta !== null && meses_estimados !== null && meses_estimados > meses_hasta ? 'atrasada' : 'a_tiempo';
    return { nombre: g.nombre, objetivo: g.objetivo, actual: g.actual, falta, aporte_ref, fecha_limite: g.fecha_limite, meses_hasta_limite: meses_hasta, requerido, meses_estimados, fecha_estimada: meses_estimados !== null ? sumarMeses(mesCorte, meses_estimados) : null, estado };
  });

  // I15 deudas activas
  const alias = aliasTerceros(doc);
  const I15: IndDeuda[] = R.deudas.filter((d) => d.activa && d.estado === 'activa' && d.pendiente > 0).map((d) => {
    const abono_ref = ritmo((f) => f.deuda === d.contraparte && f.tipo === 'abono_capital', () => 1);
    const dv = d.vence ? diasEntre(corte, d.vence) : null;
    const pendiente_cop = d.pendiente_cop;
    const alerta: IndDeuda['alerta'] = dv !== null && dv < 0 ? 'VENCIDA' : dv !== null && dv <= 30 && pendiente_cop > abono_ref ? 'VENCE_30' : null;
    return { contraparte: d.contraparte, alias: alias.get(d.contraparte) || 'Persona', tipo: d.tipo, pendiente_cop, vence: d.vence, dias_al_vencimiento: dv, abono_ref, meses_para_saldar: abono_ref > 0 ? Math.ceil(pendiente_cop / abono_ref) : null, alerta };
  });

  // I16 tarjetas (con la tasa máxima legal, no la del extracto)
  const deudaTarjeta = R.cuentas.filter((c) => c.activa && c.tipo === 'tarjeta' && c.saldo_cop < 0).reduce((a, c) => a + Math.abs(c.saldo_cop), 0);
  const tasaMes = usura !== undefined ? Math.pow(1 + usura, 1 / 12) - 1 : null;
  const I16 = deudaTarjeta > 0 && tasaMes !== null ? { saldo: deudaTarjeta, tasa_mensual: tasaMes, costo_ref_mensual: deudaTarjeta * tasaMes } : null;

  // I17 me deben
  const porCobrar = R.deudas.filter((d) => d.activa && d.estado === 'activa' && d.tipo === 'por_cobrar' && d.pendiente > 0);
  const masAntiguo = porCobrar.map((d) => d.primer_movimiento).filter(Boolean).sort()[0] as string | undefined;
  const I17 = R.foto.te_deben > 0 ? {
    te_deben: R.foto.te_deben,
    pct_patrimonio: R.foto.patrimonio > 0 ? R.foto.te_deben / R.foto.patrimonio : null,
    dias_desde_el_mas_antiguo: masAntiguo ? diasEntre(masAntiguo, corte) : null,
  } : null;

  // I18 dólares
  const usd = R.cuentas.filter((c) => c.activa && c.moneda === 'USD');
  const I18 = usd.length ? (() => {
    const valor = usd.reduce((a, c) => a + c.saldo_cop, 0);
    return { saldo_usd: usd.reduce((a, c) => a + c.saldo, 0), valor_cop: valor, pct_cuentas: R.foto.en_cuentas ? valor / R.foto.en_cuentas : null, sensibilidad_10: Math.abs(valor) * 0.1 };
  })() : null;

  // Palancas de ahorro
  const habitos: Omit<Palanca, 'id'>[] = hormiga.slice(0, 3).map((g) => palanca('habito', g.grupo, 0.5, g.mensual));
  const hormigaPorCat = new Map<string, number>();
  hormiga.slice(0, 3).forEach((g) => hormigaPorCat.set(g.categoria, (hormigaPorCat.get(g.categoria) || 0) + g.mensual));
  const categorias: Omit<Palanca, 'id'>[] = I07.filter((c) => c.clase !== 'esencial')
    .map((c) => {
      const baseRecortable = (gastos.filter((f) => (f.categoria || 'Sin categoría') === c.categoria && recortable(f)).reduce((a, f) => a + f.cop, 0) / dias) * FACTOR_MES;
      return { c, resto: baseRecortable - (hormigaPorCat.get(c.categoria) || 0) };
    })
    .filter((x) => x.resto > 1).sort((a, b) => b.resto - a.resto).slice(0, 3)
    .map((x) => palanca('categoria', x.c.categoria, 0.3, x.resto));
  // Un gasto esencial (arriendo, servicios, salud…) nunca es palanca, aunque sea recurrente
  const recurrentes: Omit<Palanca, 'id'>[] = I12.filter((r) => claseCategoria(r.categoria) !== 'esencial').map((r) => ({ ...palanca('recurrente', r.grupo, 1, r.mensual), nota: 'solo si no lo usas' }));
  const P: Palanca[] = [...habitos, ...categorias, ...recurrentes]
    .sort((a, b) => b.ahorro_mensual - a.ahorro_mensual)
    .map((p, i) => ({ ...p, id: 'P' + String(i + 1).padStart(2, '0') }));
  const elegibles = P.filter((p) => p.tipo !== 'recurrente').slice(0, 3);
  const plan = { ids: elegibles.map((p) => p.id), mensual: elegibles.reduce((a, p) => a + p.ahorro_mensual, 0) };

  // I19 escenarios (meses 0 a 12)
  const patrimonio = R.foto.patrimonio;
  const serie = (f: (h: number) => number) => Array.from({ length: 13 }, (_, h) => r1000(f(h)));
  const esc = (id: Escenario['id'], nombre: string, f: (h: number) => number, supuesto: string): Escenario => {
    const s = serie(f);
    return { id, nombre, serie: s, m3: s[3], m6: s[6], m12: s[12], supuesto };
  };
  const escenarios: Escenario[] = [esc('E1', 'Si sigues igual', (h) => patrimonio + h * margen, 'Cada mes entra I01 y sale I04, como hasta hoy')];
  if (I08) escenarios.push(esc('E2', 'Si sigue la tendencia', (h) => patrimonio + h * margen - (I08!.pendiente * h * (h + 1)) / 2, 'El gasto mensual sigue cambiando al ritmo de I08'));
  escenarios.push(esc('E3', 'Si aplicas el plan', (h) => patrimonio + h * margen + h * plan.mensual, `Igual que E1 más el plan sugerido (${plan.ids.join(' + ') || 'sin palancas'})`));

  // Calidad
  const calidad: BanderaCalidad[] = [];
  if (dias < 30) calidad.push('CALIDAD_POCOS_DIAS');
  if (gastos.length / dias < 0.5) calidad.push('CALIDAD_SUBREGISTRO');
  const hace60 = new Date(utc(corte) - 59 * 864e5).toISOString().slice(0, 10);
  if (!todas.some((f) => f.tipo === 'ingreso' && f.dia >= hace60)) calidad.push('SIN_INGRESOS');
  const coherencia = verificarCoherencia(doc);
  if (!coherencia.ok) calidad.push('COHERENCIA_FALLA');

  const ind: Omit<Indicadores, 'graficos'> = {
    corte, inicio_ventana: inicio, dias_obs: dias, meses_cerrados: cerrados, calidad, coherencia,
    I01, I01b, I02, I03, I04, I05, I06, I07, I08, I09, I10, I11, I12, I13, I14, I15, I16, I17, I18,
    I19: { patrimonio, escenarios }, P, plan, referencias: refs,
  };
  return { ...ind, graficos: armarGraficos(doc, ind, alias) };
}

function palanca(tipo: Palanca['tipo'], nombre: string, porcentaje: number, base: number): Omit<Palanca, 'id'> {
  const a = base * porcentaje;
  return { tipo, nombre, porcentaje, base_mensual: base, ahorro_mensual: a, a3: a * 3, a6: a * 6, a12: a * 12 };
}

// ---------------------------------------------------------------------------
// Datos de las gráficas G1–G6 (la IA solo los copia; nunca los escala ni calcula)
// ---------------------------------------------------------------------------
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const etiquetaMes = (m: string) => `${MESES_CORTOS[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}`;

function armarGraficos(doc: DocumentoExport, ind: Omit<Indicadores, 'graficos'>, alias: Map<string, string>): Indicadores['graficos'] {
  const R = doc.resumen;
  const g: Grafico[] = [];
  const ult6 = R.meses.filter((m) => m.mes <= mesDe(ind.corte)).slice(-6);
  if (ult6.length) g.push({ id: 'G1', titulo: 'Entró vs. salió por mes', tipo: 'bar', horizontal: false, etiquetas: ult6.map((m) => etiquetaMes(m.mes)),
    series: [{ nombre: 'Entró', color: 'ingreso', valores: ult6.map((m) => Math.round(m.ingresos)) }, { nombre: 'Salió', color: 'gasto', valores: ult6.map((m) => Math.round(m.gastos)) }] });
  if (ind.I07.length) g.push({ id: 'G2', titulo: '¿En qué se te va? (al mes)', tipo: 'bar', horizontal: true, etiquetas: ind.I07.map((c) => c.categoria),
    series: [{ nombre: 'Mensual', color: 'gasto', valores: ind.I07.map((c) => Math.round(c.mensual)) }] });
  const h8 = ind.I09.grupos.slice(0, 8);
  if (h8.length) g.push({ id: 'G3', titulo: 'Lo que te cuestan los gastos hormiga en un año', tipo: 'bar', horizontal: true, etiquetas: h8.map((x) => x.grupo),
    series: [{ nombre: 'Al año', color: 'gasto', valores: h8.map((x) => Math.round(x.anual)) }] });
  const color: Record<string, Grafico['series'][number]['color']> = { E1: 'neutro', E2: 'tendencia', E3: 'plan' };
  g.push({ id: 'G4', titulo: 'Tu patrimonio en 12 meses según el camino', tipo: 'line', horizontal: false,
    etiquetas: Array.from({ length: 13 }, (_, h) => (h === 0 ? 'Hoy' : `${h} m`)),
    series: ind.I19.escenarios.map((e) => ({ nombre: e.nombre, color: color[e.id], valores: e.serie })) });

  // G5 patrimonio al cierre de cada mes: patrimonio de hoy − flujos posteriores (misma fórmula de /api/resumen (motor/reportes.ts))
  const flujo = (f: FilaMovimiento) => (f.tipo === 'ingreso' ? f.cop : f.tipo === 'gasto' ? -f.cop : f.tipo === 'ajuste' ? f.cop : 0);
  const meses6 = Array.from({ length: 6 }, (_, i) => sumarMeses(mesDe(ind.corte), i - 5)).filter((m) => m >= mesDe(R.desde));
  if (meses6.length) g.push({ id: 'G5', titulo: 'Tu patrimonio en los últimos meses', tipo: 'line', horizontal: false, etiquetas: meses6.map(etiquetaMes),
    series: [{ nombre: 'Patrimonio', color: 'neutro', valores: meses6.map((m) => {
      const c = finDeMes(m) < ind.corte ? finDeMes(m) : ind.corte;
      return Math.round(R.foto.patrimonio - doc.movimientos.filter((f) => f.dia > c).reduce((a, f) => a + flujo(f), 0));
    }) }] });

  const filas = [
    ...ind.I14.map((m) => ({ e: `Meta: ${m.nombre}`, llevas: m.actual, falta: m.falta })),
    ...R.deudas.filter((d) => d.activa && d.estado === 'activa').map((d) => ({
      e: `${d.tipo === 'por_pagar' ? 'Debes a' : 'Te debe'} ${alias.get(d.contraparte)}`,
      // pagado en COP con la misma tasa que el pendiente (el servidor ya lo convirtió)
      llevas: d.pendiente > 0 ? d.pagado * (d.pendiente_cop / d.pendiente) : 0,
      falta: d.pendiente_cop,
    })),
  ];
  if (filas.length) g.push({ id: 'G6', titulo: 'Metas y deudas: cuánto llevas', tipo: 'bar', horizontal: true, etiquetas: filas.map((x) => x.e),
    series: [{ nombre: 'Llevas', color: 'plan', valores: filas.map((x) => Math.round(x.llevas)) }, { nombre: 'Falta', color: 'neutro', valores: filas.map((x) => Math.round(x.falta)) }] });
  return { corte: ind.corte, graficos: g };
}
