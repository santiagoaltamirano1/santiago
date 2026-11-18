// Lumi Finance · Altas y bajas de cuentas, categorías, metas y deudas (antes: inserts directos con RLS en Supabase).
// Reglas que se conservan:
//  · Todo nace en cero (= disparador wf_nace_en_cero): saldo 0, meta en 0 %, deuda sin pagos y activa.
//    El saldo inicial de una cuenta entra después como movimiento de 'ajuste' (lo hace la app).
//  · Idempotente por id: si la app reintenta con el mismo id, devuelve lo que ya existe.
//  · Borrar es "borrado suave": is_active = false. Nunca se borra un documento.
import { col, docUsuario, transaccion, nuevoId } from './bd';
import { falla, r2, esUuid, texto, MONEDAS } from './util';

const TIPOS_CUENTA = ['ahorro', 'bolsillo', 'broker', 'efectivo', 'corriente', 'tarjeta'];

async function crear(uid: string, c: 'cuentas' | 'categorias' | 'metas' | 'deudas', idPedido: unknown, datos: Record<string, unknown>) {
  const id = typeof idPedido === 'string' && idPedido ? idPedido : nuevoId();
  if (!esUuid(id)) falla('ID_INVALIDO', 'id no válido');
  const ref = col(uid, c).doc(id);
  return transaccion(async (tx) => {
    const previo = await tx.get(ref);
    if (previo.exists) return previo.data();
    const doc = { id, user_id: uid, is_active: true, ...datos };
    tx.set(ref, doc);
    return doc;
  });
}

const moneda = (v: unknown) => {
  const m = typeof v === 'string' && v ? v : 'COP';
  if (!(MONEDAS as readonly string[]).includes(m)) falla('MONEDA_INVALIDA', m);
  return m;
};
const fechaOpcional = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

export function crearCuenta(uid: string, b: any) {
  const nombre = texto(b?.nombre, 80);
  if (!nombre) falla('NOMBRE_REQUERIDO', 'ponle un nombre a la cuenta');
  if (!TIPOS_CUENTA.includes(b?.tipo)) falla('TIPO_INVALIDO', String(b?.tipo));
  return crear(uid, 'cuentas', b?.id, {
    nombre, tipo: b.tipo, moneda: moneda(b?.moneda), saldo_actual: 0,
    mascara: texto(b?.mascara, 30), color_badge: texto(b?.color_badge, 30), created_at: new Date().toISOString(),
  });
}

export function crearCategoria(uid: string, b: any) {
  const nombre = texto(b?.nombre, 60);
  if (!nombre) falla('NOMBRE_REQUERIDO', 'ponle un nombre a la categoría');
  if (b?.tipo !== 'ingreso' && b?.tipo !== 'gasto') falla('TIPO_INVALIDO', String(b?.tipo));
  return crear(uid, 'categorias', b?.id, { nombre, tipo: b.tipo, supercategoria: texto(b?.supercategoria, 60), icono: texto(b?.icono, 60) });
}

export function crearMeta(uid: string, b: any) {
  const nombre = texto(b?.nombre, 80);
  const objetivo = r2(Number(b?.monto_objetivo));
  if (!nombre) falla('NOMBRE_REQUERIDO', 'ponle un nombre a la meta');
  if (!(objetivo > 0)) falla('MONTO_INVALIDO', 'el objetivo debe ser mayor que 0');
  return crear(uid, 'metas', b?.id, {
    nombre, monto_objetivo: objetivo, monto_actual: 0, porcentaje: 0, color: texto(b?.color, 30), fecha_limite: fechaOpcional(b?.fecha_limite),
  });
}

export function crearDeuda(uid: string, b: any) {
  const contraparte = texto(b?.contraparte, 80);
  const total = r2(Number(b?.monto_total) || 0);
  if (!contraparte) falla('NOMBRE_REQUERIDO', 'escribe con quién es la deuda');
  if (b?.tipo !== 'por_cobrar' && b?.tipo !== 'por_pagar') falla('TIPO_INVALIDO', String(b?.tipo));
  if (total < 0) falla('MONTO_INVALIDO', 'el total no puede ser negativo');
  return crear(uid, 'deudas', b?.id, {
    contraparte, concepto: texto(b?.concepto, 120), tipo: b.tipo, moneda: moneda(b?.moneda),
    monto_total: total, monto_pagado: 0, estado: 'activa', detalles_pago: texto(b?.detalles_pago, 120), fecha_vencimiento: fechaOpcional(b?.fecha_vencimiento),
  });
}

const BORRABLES: Record<string, 'cuentas' | 'categorias' | 'metas' | 'deudas'> = {
  cuentas: 'cuentas', categorias: 'categorias', metas: 'metas', deudas: 'deudas',
  // nombres viejos que usa la app (financeService.softDeleteEntity)
  accounts: 'cuentas', categories: 'categorias', goals: 'metas', debts: 'deudas',
};
export async function borrarSuave(uid: string, coleccion: string, id: string) {
  const c = BORRABLES[coleccion];
  if (!c) falla('COLECCION_INVALIDA', coleccion);
  const ref = col(uid, c).doc(id);
  const s = await ref.get();
  if (!s.exists) falla('NO_EXISTE', 'no existe o no es tuyo', 404);
  await ref.update({ is_active: false });
}

/** Semilla para una persona nueva: 2 cuentas y 5 categorías, solo si no tiene ninguna (= seedDefaultsIfEmpty). */
export async function sembrarSiVacio(uid: string, correo?: string | null): Promise<boolean> {
  return transaccion(async (tx) => {
    const perfil = docUsuario(uid);
    const [p, cu, ca] = await Promise.all([tx.get(perfil), tx.get(col(uid, 'cuentas').limit(1)), tx.get(col(uid, 'categorias').limit(1))]);
    if (!p.exists) tx.set(perfil, { id: uid, nombre: correo || null, moneda_principal: 'COP', created_at: new Date().toISOString() });
    let creo = false;
    const nuevo = (c: 'cuentas' | 'categorias', datos: Record<string, unknown>) => {
      const id = nuevoId();
      tx.set(col(uid, c).doc(id), { id, user_id: uid, is_active: true, ...datos });
    };
    if (cu.empty) {
      const ahora = new Date().toISOString();
      nuevo('cuentas', { nombre: 'Ahorros Principal', tipo: 'ahorro', moneda: 'COP', saldo_actual: 0, color_badge: '#facc15', created_at: ahora });
      nuevo('cuentas', { nombre: 'Efectivo', tipo: 'efectivo', moneda: 'COP', saldo_actual: 0, color_badge: '#09bf49', created_at: ahora });
      creo = true;
    }
    if (ca.empty) {
      for (const [nombre, supercategoria, tipo, icono] of [
        ['Comida', 'Gastos Diarios', 'gasto', 'restaurant'],
        ['Transporte', 'Movilidad', 'gasto', 'directions_bus'],
        ['Otros gastos', 'Gastos Varios', 'gasto', 'receipt_long'],
        ['Salario', 'Ingresos', 'ingreso', 'payments'],
        ['Otros ingresos', 'Ingresos', 'ingreso', 'add_card'],
      ]) nuevo('categorias', { nombre, supercategoria, tipo, icono });
      creo = true;
    }
    return creo;
  });
}

/** Registro de cuándo y qué se exportó (nunca el contenido). */
export async function registrarExportacion(uid: string, b: any) {
  const formato = ['md', 'pdf', 'ia'].includes(b?.formato) ? b.formato : falla('FORMATO_INVALIDO', String(b?.formato));
  const id = nuevoId();
  await col(uid, 'exportaciones').doc(id).set({
    id, creado_en: new Date().toISOString(), formato, desde: fechaOpcional(b?.desde), hasta: fechaOpcional(b?.hasta),
    secciones: Array.isArray(b?.secciones) ? b.secciones.slice(0, 20).map(String) : [], filas: Math.max(0, Number(b?.filas) || 0),
  });
}
