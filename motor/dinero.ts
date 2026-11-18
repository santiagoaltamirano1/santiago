// Lumi Finance · REGLAS DE DINERO (la fuente de verdad del motor).
// Traducción fiel de las funciones SQL de Supabase:
//   wf_commit_transaccion + wf_commit_nucleo + disparador wf_validar_categoria → registrarMovimiento()
//   wf_ajustar_saldo → ajustarSaldo()     wf_disponible_cop → disponibleCop()
// ESPEJO en la app: src/utils/reglas.ts (calcularEfecto). Si cambias una regla, cambia LAS DOS.
// Versión de prueba (Starter Tier): corre en el navegador (motor/bd.ts). Todo va en una transacción de Firestore.
// ESPEJO para la pantalla: src/utils/reglas.ts (calcularEfecto). Si cambias una regla, cambia LAS DOS.
import { col, transaccion, nuevoId, type Tx, type Foto } from './bd';
import { tasasConfig } from './tasas';
import { falla, r2, r4, convertir, tasaDe, hoyBogota, type Tasas, esUuid, texto } from './util';
export { tasasConfig };

export const TIPOS_MOVIMIENTO = ['ingreso', 'gasto', 'transferencia', 'aporte_meta', 'retiro_meta', 'prestamo_capital', 'abono_capital'] as const;
const ORIGENES = ['manual', 'ia_voz', 'recuperada'] as const;

/** = wf_disponible_cop: lo que hay en cuentas (sin tarjetas), en COP, menos lo apartado en metas activas. */
export async function disponibleCop(uid: string, t: Tasas, tx?: Tx): Promise<number> {
  const q1 = col(uid, 'cuentas').where('is_active', '==', true);
  const q2 = col(uid, 'metas').where('is_active', '==', true);
  const [cu, me] = tx ? await Promise.all([tx.get(q1), tx.get(q2)]) : await Promise.all([q1.get(), q2.get()]);
  const enCuentas = cu.docs.map((d) => d.data()).filter((a) => a.tipo !== 'tarjeta')
    .reduce((s, a) => s + convertir(Number(a.saldo_actual || 0), a.moneda || 'COP', 'COP', t), 0);
  const apartado = me.docs.reduce((s, d) => s + Number(d.data().monto_actual || 0), 0);
  return enCuentas - apartado;
}

export interface PayloadMovimiento {
  id?: string; tipo?: string; monto?: number; cuenta_id?: string | null; destino_cuenta_id?: string | null;
  categoria_id?: string | null; meta_id?: string | null; deuda_id?: string | null; operacion_deuda?: string | null;
  fecha?: string | null; fecha_local_str?: string | null; notas?: string | null; cuenta_nombre?: string | null;
  categoria_nombre?: string | null; supercategoria?: string | null; origen?: string | null; captura_id?: string | null;
}

const vacio = (v: unknown) => (v === undefined || v === null || v === '' ? null : String(v));

/** Registra un movimiento. Idempotente por id: si ya existe, devuelve el mismo id sin tocar nada. */
export async function registrarMovimiento(uid: string, p: PayloadMovimiento): Promise<string> {
  const id = vacio(p.id) || nuevoId();
  if (!esUuid(id)) falla('ID_INVALIDO', 'el id del movimiento no es válido');
  const monto = r2(Math.abs(Number(p.monto) || 0));
  const tipo = vacio(p.tipo);
  const cuentaId = vacio(p.cuenta_id), destId = vacio(p.destino_cuenta_id), metaId = vacio(p.meta_id), deudaId = vacio(p.deuda_id);
  const op = vacio(p.operacion_deuda);
  const origen = vacio(p.origen) || 'manual';
  let catId = vacio(p.categoria_id);
  const capturaId = vacio(p.captura_id);

  // Validaciones sin leer la base (mismo orden que wf_commit_nucleo)
  if (!(monto > 0)) falla('MONTO_INVALIDO', 'el monto debe ser mayor que 0');
  if (!tipo || !(TIPOS_MOVIMIENTO as readonly string[]).includes(tipo)) falla('TIPO_INVALIDO', tipo || '(vacío)');
  if (!(ORIGENES as readonly string[]).includes(origen)) falla('ORIGEN_INVALIDO', origen);
  if (op && op !== 'abono' && op !== 'incremento') falla('OPERACION_INVALIDA', op);
  if (metaId && deudaId) falla('META_Y_DEUDA', 'un movimiento no puede ir a una meta y a una deuda a la vez');
  if (cuentaId && cuentaId === destId) falla('MISMA_CUENTA', 'origen y destino no pueden ser iguales');
  if (['ingreso', 'gasto', 'transferencia', 'prestamo_capital', 'abono_capital'].includes(tipo!) && !cuentaId) falla('CUENTA_REQUERIDA', 'elige una cuenta');
  if (tipo === 'transferencia' && !destId) falla('DESTINO_REQUERIDO', 'elige la cuenta que recibe');
  if ((tipo === 'aporte_meta' || tipo === 'retiro_meta') && !metaId) falla('META_REQUERIDA', 'elige una meta');
  if ((tipo === 'prestamo_capital' || tipo === 'abono_capital') && !deudaId) falla('DEUDA_REQUERIDA', 'elige una deuda');
  if (capturaId && origen !== 'ia_voz') falla('ORIGEN_INVALIDO', 'un movimiento de una captura de voz debe tener origen ia_voz');
  let fecha = new Date().toISOString();
  if (p.fecha) {
    const f = new Date(p.fecha);
    if (Number.isNaN(f.getTime())) falla('FECHA_INVALIDA', String(p.fecha));
    fecha = f.toISOString();
  }

  const t = await tasasConfig();
  return transaccion(async (tx) => {
    // ---------- LECTURAS (Firestore exige leer todo antes de escribir) ----------
    const refMov = col(uid, 'movimientos').doc(id);
    if ((await tx.get(refMov)).exists) return id; // idempotencia
    const refCap = capturaId ? col(uid, 'capturas').doc(capturaId) : null;
    if (refCap && !(await tx.get(refCap)).exists) falla('CAPTURA_AJENA', 'la captura de voz no existe o no es tuya');
    const leer = async (c: 'cuentas' | 'metas' | 'deudas' | 'categorias', docId: string | null): Promise<Foto | null> =>
      (docId ? await tx.get(col(uid, c).doc(docId)) : null);
    const sCuenta = await leer('cuentas', cuentaId);
    if (cuentaId && !sCuenta!.exists) falla('CUENTA_AJENA', 'cuenta de origen ajena o inexistente');
    const sDest = tipo === 'transferencia' ? await leer('cuentas', destId) : null;
    if (tipo === 'transferencia' && !sDest!.exists) falla('DESTINO_AJENO', 'cuenta destino ajena o inexistente');
    const sMeta = await leer('metas', metaId);
    if (metaId && !sMeta!.exists) falla('META_AJENA', 'meta ajena o inexistente');
    const sDeuda = await leer('deudas', deudaId);
    if (deudaId && !sDeuda!.exists) falla('DEUDA_AJENA', 'deuda ajena o inexistente');
    // Categoría (= disparador wf_validar_categoria)
    let catNombre = vacio(p.categoria_nombre), superCat = vacio(p.supercategoria);
    if (tipo === 'ingreso' || tipo === 'gasto') {
      if (!catId) falla('CATEGORIA_REQUERIDA', 'elige una categoría');
      const sCat = await leer('categorias', catId);
      if (!sCat!.exists) falla('CATEGORIA_AJENA', 'categoría ajena o inexistente');
      const tc = sCat!.data()!.tipo;
      if (tc !== tipo) falla('CATEGORIA_INVALIDA', `la categoría es de ${tc}, no de ${tipo}`);
    } else { catId = null; catNombre = null; superCat = null; }
    const disponible = tipo === 'aporte_meta' ? await disponibleCop(uid, t, tx) : 0;

    // ---------- CÁLCULO ----------
    const cuenta = sCuenta?.data();
    const monedaOrigen: string = cuenta?.moneda || 'COP';
    const tasa = r4(tasaDe(monedaOrigen, t));
    let aplicado = monto;
    const cambiosCuenta = new Map<string, number>(); // id → delta
    const sumarCuenta = (cid: string, delta: number) => cambiosCuenta.set(cid, (cambiosCuenta.get(cid) || 0) + delta);
    let nuevaMeta: { monto_actual: number; porcentaje: number } | null = null;
    let nuevaDeuda: Record<string, unknown> | null = null;
    const meta = sMeta?.data();
    const deuda = sDeuda?.data();
    const porcentaje = (actual: number) => Math.min(100, Math.round((actual / (Number(meta!.monto_objetivo) || Infinity)) * 100));

    if (tipo === 'ingreso' || tipo === 'gasto' || tipo === 'transferencia') {
      sumarCuenta(cuentaId!, tipo === 'ingreso' ? monto : -monto);
      if (tipo === 'transferencia') {
        aplicado = r2(convertir(monto, monedaOrigen, sDest!.data()!.moneda || 'COP', t));
        sumarCuenta(destId!, aplicado);
      }
      if (meta) {
        aplicado = r2(convertir(monto, monedaOrigen, 'COP', t));
        const nuevo = r2(Number(meta.monto_actual || 0) + aplicado);
        nuevaMeta = { monto_actual: nuevo, porcentaje: porcentaje(nuevo) };
      }
      if (deuda) {
        const delta = r2(convertir(monto, monedaOrigen, deuda.moneda || 'COP', t));
        const total = Number(deuda.monto_total), pagado = Number(deuda.monto_pagado);
        if (op === 'incremento') {
          aplicado = delta;
          nuevaDeuda = { monto_total: r2(total + delta), estado: pagado >= total + delta ? 'saldada' : 'activa' };
        } else {
          const restante = Math.max(0, total - pagado);
          if (restante <= 0) falla('DEUDA_SALDADA', 'esta deuda ya está saldada');
          aplicado = Math.min(delta, restante);
          nuevaDeuda = { monto_pagado: r2(pagado + aplicado), estado: pagado + aplicado >= total ? 'saldada' : 'activa' };
        }
      }
    } else if (tipo === 'aporte_meta' || tipo === 'retiro_meta') {
      aplicado = r2(convertir(monto, monedaOrigen, 'COP', t));
      const actual = Number(meta!.monto_actual || 0);
      let nuevo: number;
      if (tipo === 'aporte_meta') {
        if (aplicado > disponible) falla('DISPONIBLE_INSUFICIENTE', String(Math.max(0, Math.round(disponible))));
        nuevo = r2(actual + aplicado);
      } else {
        if (aplicado > actual) falla('RETIRO_MAYOR', String(actual));
        nuevo = r2(actual - aplicado);
      }
      nuevaMeta = { monto_actual: nuevo, porcentaje: porcentaje(nuevo) };
    } else {
      // prestamo_capital / abono_capital
      const delta = r2(convertir(monto, monedaOrigen, deuda!.moneda || 'COP', t));
      const total = Number(deuda!.monto_total), pagado = Number(deuda!.monto_pagado);
      let signo: number;
      if (tipo === 'prestamo_capital') {
        signo = deuda!.tipo === 'por_cobrar' ? -1 : 1;
        nuevaDeuda = { monto_total: r2(total + delta), estado: pagado >= total + delta ? 'saldada' : 'activa' };
        aplicado = delta;
      } else {
        signo = deuda!.tipo === 'por_pagar' ? -1 : 1;
        const restante = Math.max(0, total - pagado);
        if (restante <= 0) falla('DEUDA_SALDADA', 'esta deuda ya está saldada');
        if (delta > restante + 0.01) falla('SOBREPAGO', String(r2(restante)));
        aplicado = Math.min(delta, restante);
        nuevaDeuda = { monto_pagado: r2(pagado + aplicado), estado: pagado + aplicado >= total ? 'saldada' : 'activa' };
      }
      sumarCuenta(cuentaId!, signo * monto);
    }

    // ---------- ESCRITURAS ----------
    const saldos = new Map<string, number>([[cuentaId || '', Number(cuenta?.saldo_actual || 0)], [destId || '', Number(sDest?.data()?.saldo_actual || 0)]]);
    for (const [cid, delta] of cambiosCuenta) tx.update(col(uid, 'cuentas').doc(cid), { saldo_actual: r2((saldos.get(cid) || 0) + delta) });
    if (nuevaMeta) tx.update(col(uid, 'metas').doc(metaId!), nuevaMeta);
    if (nuevaDeuda) tx.update(col(uid, 'deudas').doc(deudaId!), nuevaDeuda);
    tx.set(refMov, {
      id, user_id: uid, cuenta_id: cuentaId, destino_cuenta_id: destId, categoria_id: catId, meta_id: metaId, deuda_id: deudaId,
      operacion_deuda: op, monto, moneda: monedaOrigen, tipo, fecha,
      fecha_local_str: vacio(p.fecha_local_str), notas: texto(p.notas, 500) || '',
      cuenta_nombre: vacio(p.cuenta_nombre), categoria_nombre: catId ? catNombre : null, supercategoria: catId ? superCat : null,
      is_active: true, created_at: new Date().toISOString(), origen, monto_aplicado: r2(aplicado), tasa_cop: tasa,
      saldo_anterior: null, saldo_nuevo: null, captura_id: capturaId,
    });
    if (refCap) tx.update(refCap, { estado: 'confirmada' });
    return id;
  });
}

/** = wf_ajustar_saldo: deja la cuenta en el saldo que dice la persona y registra la diferencia como 'ajuste'. */
export async function ajustarSaldo(uid: string, id: string, cuentaId: string, objetivo: number, notas?: string | null) {
  if (!id || !cuentaId || objetivo === null || objetivo === undefined || !Number.isFinite(Number(objetivo))) falla('DATOS_INCOMPLETOS', 'faltan datos del ajuste');
  if (!esUuid(id)) falla('ID_INVALIDO', 'el id del ajuste no es válido');
  const t = await tasasConfig();
  return transaccion(async (tx) => {
    const refMov = col(uid, 'movimientos').doc(id);
    const previo = await tx.get(refMov);
    if (previo.exists) {
      const t = previo.data()!;
      return { id, diferencia: r2(t.saldo_nuevo - t.saldo_anterior), saldo_nuevo: t.saldo_nuevo, repetido: true };
    }
    const refCuenta = col(uid, 'cuentas').doc(cuentaId);
    const sc = await tx.get(refCuenta);
    if (!sc.exists) falla('CUENTA_AJENA', 'cuenta ajena o inexistente');
    const a = sc.data()!;
    const obj = r2(Number(objetivo));
    const anterior = Number(a.saldo_actual || 0);
    const dif = r2(obj - anterior);
    if (dif === 0) return { id: null, diferencia: 0, saldo_nuevo: anterior, repetido: false };
    const ahora = new Date();
    tx.update(refCuenta, { saldo_actual: obj });
    tx.set(refMov, {
      id, user_id: uid, cuenta_id: cuentaId, destino_cuenta_id: null, categoria_id: null, meta_id: null, deuda_id: null,
      operacion_deuda: null, monto: Math.abs(dif), moneda: a.moneda || 'COP', tipo: 'ajuste', fecha: ahora.toISOString(),
      fecha_local_str: hoyBogota(ahora), notas: texto(notas, 500) || 'Ajuste de saldo', cuenta_nombre: a.nombre,
      categoria_nombre: null, supercategoria: null, is_active: true, created_at: ahora.toISOString(),
      origen: 'ajuste', monto_aplicado: dif, tasa_cop: r4(tasaDe(a.moneda || 'COP', t)), saldo_anterior: anterior, saldo_nuevo: obj, captura_id: null,
    });
    return { id, diferencia: dif, saldo_nuevo: obj, repetido: false };
  });
}
