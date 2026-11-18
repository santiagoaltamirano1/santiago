// Lumi Finance · Resumen del tablero y exportación (antes: wf_resumen, wf_exportar, wf_exportar_movimientos).
// Se calcula sobre TODOS los movimientos de la persona, en el servidor, con la tasa guardada en cada movimiento.
import { col } from './firebase';
import { tasasConfig, disponibleCop } from './dinero';
import { tasasVigentes } from './tasas';
import {
  redondear as rd, convertir, copMovimiento, diaMovimiento, horaBogota, hoyBogota, mesDe, sumarMeses, ultimoDiaMes, sinIds, type Tasas,
} from './util';

interface Datos { cuentas: any[]; categorias: any[]; metas: any[]; deudas: any[]; movimientos: any[]; capturas: any[] }

async function cargar(uid: string, conCapturas = false): Promise<Datos> {
  const leer = async (c: any) => (await col(uid, c).get()).docs.map((d) => d.data());
  const [cuentas, categorias, metas, deudas, movimientos, capturas] = await Promise.all([
    leer('cuentas'), leer('categorias'), leer('metas'), leer('deudas'), leer('movimientos'), conCapturas ? leer('capturas') : Promise.resolve([]),
  ]);
  return { cuentas, categorias, metas, deudas, movimientos, capturas };
}

const conDia = (movs: any[], t: Tasas) =>
  movs.filter((m) => m.is_active !== false).map((m) => ({ ...m, dia: diaMovimiento(m.fecha_local_str, m.fecha), cop: copMovimiento(m, t) }));

const sumaSi = (l: any[], f: (m: any) => boolean) => l.reduce((s, m) => (f(m) ? s + m.cop : s), 0);
const porTexto = (a: string, b: string) => a.localeCompare(b, 'es');

function flujoMensual(meses: string[], tx: any[]) {
  return meses.map((m) => {
    const del = tx.filter((x) => mesDe(x.dia) === m);
    return {
      m,
      ingresos: sumaSi(del, (x) => x.tipo === 'ingreso'),
      gastos: sumaSi(del, (x) => x.tipo === 'gasto'),
      ajustes: sumaSi(del, (x) => x.tipo === 'ajuste'),
      movimientos: del.filter((x) => x.tipo === 'ingreso' || x.tipo === 'gasto').length,
    };
  });
}

// ---------------------------------------------------------------------------------------------- wf_resumen
export async function resumen(uid: string, mesPedido?: string | null, mesesPedidos = 6) {
  const t = await tasasConfig();
  const d = await cargar(uid);
  const hoy = hoyBogota();
  const mesSel = /^\d{4}-\d{2}/.test(mesPedido || '') ? mesPedido!.slice(0, 7) : mesDe(hoy);
  const n = Math.max(1, Math.min(Number(mesesPedidos) || 6, 24));
  const meses = Array.from({ length: n }, (_, i) => sumarMeses(mesSel, i - (n - 1)));
  const tx = conDia(d.movimientos, t);
  const flujo = flujoMensual(meses, tx);
  const activa = (x: any) => x.is_active !== false;
  const pendiente = (x: any) => convertir(Number(x.monto_total) - Number(x.monto_pagado), x.moneda || 'COP', 'COP', t);
  const patrimonioHoy =
    d.cuentas.filter(activa).reduce((s, a) => s + convertir(Number(a.saldo_actual), a.moneda || 'COP', 'COP', t), 0)
    + d.deudas.filter((x) => activa(x) && x.estado === 'activa' && x.tipo === 'por_cobrar').reduce((s, x) => s + pendiente(x), 0)
    - d.deudas.filter((x) => activa(x) && x.estado === 'activa' && x.tipo === 'por_pagar').reduce((s, x) => s + pendiente(x), 0);
  const patrimonio = meses.map((m) => {
    const corte = [ultimoDiaMes(m), hoy].sort()[0];
    const despues = tx.filter((x) => x.dia > corte).reduce((s, x) => s + (x.tipo === 'ingreso' ? x.cop : x.tipo === 'gasto' ? -x.cop : x.tipo === 'ajuste' ? x.cop : 0), 0);
    return { mes: `${m}-01`, valor: rd(patrimonioHoy - despues) };
  });
  const nombreCat = new Map(d.categorias.map((c) => [c.id, c.nombre]));
  const cats = new Map<string, { id: string; nombre: string; total: number; movimientos: number }>();
  for (const x of tx) {
    if (x.tipo !== 'gasto' || mesDe(x.dia) !== mesSel || !nombreCat.has(x.categoria_id)) continue;
    const c = cats.get(x.categoria_id) || { id: x.categoria_id, nombre: nombreCat.get(x.categoria_id), total: 0, movimientos: 0 };
    c.total += x.cop; c.movimientos++; cats.set(x.categoria_id, c);
  }
  return {
    mes: `${mesSel}-01`,
    hoy,
    meses: flujo.map((f) => ({ mes: `${f.m}-01`, ingresos: rd(f.ingresos), gastos: rd(f.gastos), ajustes: rd(f.ajustes), movimientos: f.movimientos })),
    patrimonio,
    categorias: [...cats.values()].sort((a, b) => b.total - a.total).map((c) => ({ ...c, total: rd(c.total) })),
  };
}

// ---------------------------------------------------------------------------------------------- wf_exportar (+ filas)
export async function exportar(uid: string, desdePedido?: string | null, hastaPedido?: string | null) {
  const t = await tasasConfig();
  const d = await cargar(uid, true);
  const hoy = hoyBogota();
  const fecha = (v: any) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const todo = conDia(d.movimientos, t);
  const desde = fecha(desdePedido) || todo.map((x) => x.dia).sort()[0] || hoy;
  const hasta = fecha(hastaPedido) || hoy;
  const tx = todo.filter((x) => x.dia >= desde && x.dia <= hasta);
  const meses: string[] = [];
  for (let m = mesDe(desde); m <= mesDe(hasta); m = sumarMeses(m, 1)) meses.push(m);

  const activa = (x: any) => x.is_active !== false;
  const cuentas = d.cuentas.map((a) => ({ ...a, saldo_cop: convertir(Number(a.saldo_actual), a.moneda || 'COP', 'COP', t) }));
  const deudas = d.deudas.map((x) => ({ ...x, pendiente_cop: convertir(Number(x.monto_total) - Number(x.monto_pagado), x.moneda || 'COP', 'COP', t) }));
  const cuentasCop = cuentas.filter(activa).reduce((s, a) => s + a.saldo_cop, 0);
  const apartado = d.metas.filter(activa).reduce((s, g) => s + Number(g.monto_actual || 0), 0);
  const debes = deudas.filter((x) => activa(x) && x.estado === 'activa' && x.tipo === 'por_pagar').reduce((s, x) => s + x.pendiente_cop, 0);
  const teDeben = deudas.filter((x) => activa(x) && x.estado === 'activa' && x.tipo === 'por_cobrar').reduce((s, x) => s + x.pendiente_cop, 0);
  const nombreCat = new Map(d.categorias.map((c) => [c.id, c.nombre]));
  const dias = tx.map((x) => x.dia).sort();

  // categorias_mes
  const cm = new Map<string, any>();
  for (const x of tx) {
    if (x.tipo !== 'gasto' && x.tipo !== 'ingreso') continue;
    const categoria = nombreCat.get(x.categoria_id) || x.categoria_nombre || 'Sin categoría';
    const k = `${mesDe(x.dia)}|${x.tipo}|${categoria}`;
    const v = cm.get(k) || { mes: mesDe(x.dia), tipo: x.tipo, categoria, total: 0, movimientos: 0 };
    v.total += x.cop; v.movimientos++; cm.set(k, v);
  }
  const deMeta = (id: string, tipo?: string) => tx.filter((x) => x.meta_id === id && (!tipo || x.tipo === tipo));
  const deDeuda = (id: string, tipo?: string) => tx.filter((x) => x.deuda_id === id && (!tipo || x.tipo === tipo));
  const suma = (l: any[]) => l.reduce((s, x) => s + x.cop, 0);
  const minMax = (l: string[], max = false) => (l.length ? [...l].sort()[max ? l.length - 1 : 0] : null);
  const capturasRango = d.capturas
    .map((k) => ({ ...k, dia: hoyBogota(new Date(k.creado_en)) }))
    .filter((k) => k.dia >= desde && k.dia <= hasta)
    .sort((a, b) => String(b.creado_en).localeCompare(String(a.creado_en))).slice(0, 200);

  const resumenDoc = {
    version: 1,
    generado_en: new Date().toISOString(),
    zona_horaria: 'America/Bogota',
    hoy, desde, hasta,
    tasas: (await tasasVigentes()).filter((x) => !x.proxima).sort((a, b) => a.moneda.localeCompare(b.moneda))
      .map((x) => ({ moneda: x.moneda, cop_por_unidad: x.cop_por_unidad, vigente_desde: x.vigente_desde, fuente: x.fuente })),
    foto: {
      disponible: rd(await disponibleCop(uid, t)),
      en_cuentas: rd(cuentasCop), apartado_metas: rd(apartado), debes: rd(debes), te_deben: rd(teDeben), patrimonio: rd(cuentasCop + teDeben - debes),
    },
    totales: {
      movimientos: tx.length,
      ingresos: rd(sumaSi(tx, (x) => x.tipo === 'ingreso')), gastos: rd(sumaSi(tx, (x) => x.tipo === 'gasto')), ajustes: rd(sumaSi(tx, (x) => x.tipo === 'ajuste')),
      primer_dia: dias[0] ?? null, ultimo_dia: dias[dias.length - 1] ?? null,
    },
    meses: flujoMensual(meses, tx).map((f) => ({ mes: f.m, ingresos: rd(f.ingresos), gastos: rd(f.gastos), ajustes: rd(f.ajustes), movimientos: f.movimientos })),
    categorias_mes: [...cm.values()].sort((a, b) => a.mes.localeCompare(b.mes) || b.total - a.total).map((v) => ({ ...v, total: rd(v.total) })),
    cuentas: cuentas.sort((a, b) => Number(activa(b)) - Number(activa(a)) || b.saldo_cop - a.saldo_cop)
      .map((a) => ({ nombre: a.nombre, tipo: a.tipo, moneda: a.moneda, saldo: Number(a.saldo_actual), saldo_cop: rd(a.saldo_cop), activa: activa(a) })),
    metas: [...d.metas].sort((a, b) => Number(activa(b)) - Number(activa(a)) || porTexto(a.nombre, b.nombre)).map((g) => ({
      nombre: g.nombre, objetivo: Number(g.monto_objetivo), actual: Number(g.monto_actual), fecha_limite: g.fecha_limite ?? null, activa: activa(g),
      aportes: rd(suma(deMeta(g.id, 'aporte_meta'))), retiros: rd(suma(deMeta(g.id, 'retiro_meta'))), movimientos: deMeta(g.id).length,
      ultimo_movimiento: minMax(todo.filter((x) => x.meta_id === g.id).map((x) => x.dia), true),
    })),
    deudas: deudas.sort((a, b) => Number(activa(b)) - Number(activa(a)) || String(a.fecha_vencimiento || '9999').localeCompare(String(b.fecha_vencimiento || '9999'))).map((x) => ({
      contraparte: x.contraparte, concepto: x.concepto ?? null, tipo: x.tipo, moneda: x.moneda || 'COP',
      total: Number(x.monto_total), pagado: Number(x.monto_pagado), pendiente: Number(x.monto_total) - Number(x.monto_pagado), pendiente_cop: rd(x.pendiente_cop),
      estado: x.estado, vence: x.fecha_vencimiento ?? null, activa: activa(x),
      primer_movimiento: minMax(todo.filter((m) => m.deuda_id === x.id).map((m) => m.dia)),
      prestado: rd(suma(deDeuda(x.id, 'prestamo_capital'))), abonado: rd(suma(deDeuda(x.id, 'abono_capital'))), movimientos: deDeuda(x.id).length,
    })),
    categorias: [...d.categorias].sort((a, b) => porTexto(a.tipo, b.tipo) || porTexto(a.nombre, b.nombre)).map((c) => ({
      nombre: c.nombre, tipo: c.tipo, grupo: c.supercategoria ?? null, activa: activa(c), movimientos: tx.filter((x) => x.categoria_id === c.id).length,
    })),
    capturas_voz: capturasRango.map((k) => ({
      fecha: k.dia, texto: sinIds(k.texto), estado: k.estado,
      movimientos: d.movimientos.filter((m) => m.captura_id === k.id && m.is_active !== false).length,
    })),
  };

  // Filas (= wf_exportar_movimientos), ordenadas por fecha e id
  const porId = (l: any[]) => new Map(l.map((x) => [x.id, x]));
  const mC = porId(d.cuentas), mM = porId(d.metas), mD = porId(d.deudas);
  const filas = [...tx].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || String(a.id).localeCompare(String(b.id))).map((p) => {
    const deuda = p.deuda_id ? mD.get(p.deuda_id) : null;
    const efecto = !p.cuenta_id ? 0
      : p.tipo === 'ajuste' ? (Number(p.monto_aplicado || 0) < 0 ? -1 : 1)
      : p.tipo === 'ingreso' ? 1 : p.tipo === 'gasto' ? -1
      : p.tipo === 'prestamo_capital' ? (deuda?.tipo === 'por_pagar' ? 1 : -1)
      : p.tipo === 'abono_capital' ? (deuda?.tipo === 'por_pagar' ? -1 : 1) : 0;
    return {
      dia: p.dia, hora: horaBogota(p.fecha), tipo: p.tipo,
      cuenta_como: p.tipo === 'ingreso' ? 'Ingreso' : p.tipo === 'gasto' ? 'Gasto' : 'No cuenta',
      categoria: nombreCat.get(p.categoria_id) ?? p.categoria_nombre ?? null, detalle: sinIds(p.notas),
      cuenta: mC.get(p.cuenta_id)?.nombre ?? p.cuenta_nombre ?? null, destino: mC.get(p.destino_cuenta_id)?.nombre ?? null,
      meta: mM.get(p.meta_id)?.nombre ?? null, deuda: deuda?.contraparte ?? null, operacion_deuda: p.operacion_deuda ?? null,
      monto: Number(p.monto), moneda: p.moneda, tasa_cop: p.tasa_cop ?? null, cop: rd(p.cop), efecto_cuenta: efecto,
      saldo_anterior: p.saldo_anterior ?? null, saldo_nuevo: p.saldo_nuevo ?? null, origen: p.origen,
    };
  });
  return { resumen: resumenDoc, filas };
}
