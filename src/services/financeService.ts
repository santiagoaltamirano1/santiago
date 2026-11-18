import { collection, getDocs, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, auth } from './firebase';
import { api } from './api';
import { Transaccion, Cuenta, Categoria, Meta, Deuda } from '../types';

// ---------------------------------------------------------------------------
// Datos en Firestore: usuarios/{uid}/cuentas|categorias|metas|deudas|movimientos (solo lectura para la app).
// Escrituras (versión demo): el motor (motor/, en el navegador) aplica las reglas de dinero en una transacción de Firestore.
// ---------------------------------------------------------------------------
const C = {
  accounts: 'cuentas',
  categories: 'categorias',
  goals: 'metas',
  debts: 'deudas',
  transactions: 'movimientos',
} as const;
const coleccion = (uid: string, c: string) => collection(db, 'usuarios', uid, c);
const uidActual = () => auth.currentUser?.uid || '';

export const EMERGENCY_STORAGE_KEY = 'WEALTHFLOW_EMERGENCY_QUEUE';

// [E42] La cola de emergencia es por usuario: 'WEALTHFLOW_EMERGENCY_QUEUE:<user_id>'.
let usuarioCola = '';
const claveCola = () => (usuarioCola ? `${EMERGENCY_STORAGE_KEY}:${usuarioCola}` : EMERGENCY_STORAGE_KEY);
export function setUsuarioCola(userId: string): void {
  usuarioCola = userId;
  if (!userId) return;
  // Migra los pendientes de la llave vieja (compartida) que sean de este usuario.
  try {
    const viejo = localStorage.getItem(EMERGENCY_STORAGE_KEY);
    if (!viejo) return;
    const items: EmergencyQueueItem[] = JSON.parse(viejo);
    const mios = items.filter((i) => i.transaccion?.user_id === userId);
    const otros = items.filter((i) => i.transaccion?.user_id !== userId);
    if (mios.length) {
      const actual: EmergencyQueueItem[] = JSON.parse(localStorage.getItem(claveCola()) || '[]');
      localStorage.setItem(claveCola(), JSON.stringify([...actual, ...mios.filter((m) => !actual.some((a) => a.id === m.id))]));
    }
    if (otros.length) localStorage.setItem(EMERGENCY_STORAGE_KEY, JSON.stringify(otros));
    else localStorage.removeItem(EMERGENCY_STORAGE_KEY);
  } catch (e) {
    console.error('[Storage] Error migrando cola de emergencia:', e);
  }
}

export interface EmergencyQueueItem {
  id: string;
  transaccion: Transaccion;
  timestamp: number;
}

export interface CommitTransactionPayload {
  userId?: string;
  origen?: 'manual' | 'ia_voz' | 'recuperada';
  transaccion: Transaccion;
  cuentaNombre?: string;
  categoriaNombre?: string;
  supercategoria?: string;
}

// ---------------------------------------------------------------------------
// MÓDULO 1: COMMIT TRANSACCIONAL (servidor: POST /api/movimientos → motor/dinero.ts registrarMovimiento)
// El cliente NO decide user_id ni toca saldos. Los errores se PROPAGAN.
// ---------------------------------------------------------------------------
export async function executeIdempotentTransaction(payload: CommitTransactionPayload): Promise<void> {
  const { transaccion } = payload;
  // Movimientos sin categoría (transferencia, metas, capital de deudas) no envían nombres de categoría (E31).
  const sinCategoria = !['ingreso', 'gasto'].includes(transaccion.tipo);

  const p = {
    id: transaccion.id,
    cuenta_id: transaccion.cuenta_id || null,
    destino_cuenta_id: transaccion.destino_cuenta_id || null,
    categoria_id: sinCategoria ? null : transaccion.categoria_id || null,
    meta_id: transaccion.meta_id || null,
    deuda_id: transaccion.deuda_id || null,
    operacion_deuda: transaccion.operacion_deuda || null,
    monto: Math.abs(transaccion.monto),
    tipo: transaccion.tipo,
    fecha: transaccion.fecha,
    fecha_local_str: transaccion.fecha_local_str || null,
    notas: transaccion.notas || '',
    cuenta_nombre: payload.cuentaNombre || transaccion.cuenta_nombre || null,
    categoria_nombre: sinCategoria ? null : payload.categoriaNombre || transaccion.categoria_nombre || null,
    supercategoria: sinCategoria ? null : payload.supercategoria || transaccion.supercategoria || null,
    origen: payload.origen || transaccion.origen || 'manual',
    captura_id: transaccion.captura_id || null, // Fase 5: captura de voz que originó el movimiento
  };

  try {
    await api('POST', '/api/movimientos', p);
  } catch (error: any) {
    // Propagar: la UI debe poder marcar la tx como NO sincronizada y reintentar.
    console.error('[Servidor] commit falló:', error?.code, error?.message);
    throw error; // se mantiene en la cola de emergencia para reintento
  }
  removeFromEmergencyQueue(transaccion.id);
}

export interface BatchTransactionPayload {
  transaccion: Transaccion;
  cuentaNombre?: string;
  categoriaNombre?: string;
  supercategoria?: string;
}

export async function executeTransactionBatch(payload: BatchTransactionPayload): Promise<void> {
  await executeIdempotentTransaction({
    transaccion: payload.transaccion,
    cuentaNombre: payload.cuentaNombre,
    categoriaNombre: payload.categoriaNombre,
    supercategoria: payload.supercategoria,
  });
}

// ---------------------------------------------------------------------------
// MÓDULO 2: COLA DE EMERGENCIA (resiliencia offline, igual que el original)
// ---------------------------------------------------------------------------
export const persistToEmergencyQueue = (transaccion: Transaccion): void => {
  try {
    const raw = localStorage.getItem(claveCola());
    const queue: EmergencyQueueItem[] = raw ? JSON.parse(raw) : [];
    const idx = queue.findIndex((i) => i.id === transaccion.id);
    const item: EmergencyQueueItem = { id: transaccion.id, transaccion, timestamp: Date.now() };
    if (idx >= 0) queue[idx] = item; else queue.push(item);
    localStorage.setItem(claveCola(), JSON.stringify(queue));
  } catch (e) {
    console.error('[Storage] Error persistiendo cola de emergencia:', e);
  }
};

export const removeFromEmergencyQueue = (transaccionId: string): void => {
  try {
    const raw = localStorage.getItem(claveCola());
    if (!raw) return;
    const queue: EmergencyQueueItem[] = JSON.parse(raw);
    localStorage.setItem(claveCola(), JSON.stringify(queue.filter((i) => i.id !== transaccionId)));
  } catch (e) {
    console.error('[Storage] Error limpiando cola de emergencia:', e);
  }
};

export const getEmergencyQueue = (): EmergencyQueueItem[] => {
  try {
    const raw = localStorage.getItem(claveCola());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

/** [N4] ¿El servidor rechazó por una regla (no vale la pena reintentar)? Reglas del negocio ("CÓDIGO: …", HTTP 4xx).
 *  Lo demás (sin red, sesión vencida, error 5xx) se reintenta. */
export const esRechazoDefinitivo = (e: any): boolean =>
  /^[A-Z_]+:/.test(String(e?.message || '')) && !/^(NO_AUTENTICADO|SIN_SESION|ERROR_SERVIDOR)/.test(String(e?.code || '')) && Number(e?.status || 400) < 500;
/** [N2] El mismo id ya existía en el servidor: el movimiento SÍ quedó guardado. (El servidor es idempotente: responde OK.) */
export const esYaGuardado = (_e: any): boolean => false;

// Reintenta transacciones huérfanas; solo las que logran subir (o ya estaban) se eliminan.
export const recoverPendingTransactions = async (userId: string, soloCuenta?: string): Promise<{ recuperados: number; descartados: Transaccion[]; pendientes: number }> => {
  const queue = getEmergencyQueue().filter((i) => !soloCuenta || i.transaccion.cuenta_id === soloCuenta || i.transaccion.destino_cuenta_id === soloCuenta);
  const r = { recuperados: 0, descartados: [] as Transaccion[], pendientes: 0 };
  if (!userId || queue.length === 0) return r;
  for (const item of queue) {
    try {
      const origen = item.transaccion.origen === 'ia_voz' ? 'ia_voz' : 'recuperada';
      await executeIdempotentTransaction({ userId, transaccion: item.transaccion, origen });
      r.recuperados++;
    } catch (e: any) {
      if (esYaGuardado(e)) { removeFromEmergencyQueue(item.id); r.recuperados++; }
      else if (esRechazoDefinitivo(e)) { removeFromEmergencyQueue(item.id); r.descartados.push(item.transaccion); }
      else r.pendientes++; // [N4] error pasajero: se queda en la cola
    }
  }
  return r;
};

// ---------------------------------------------------------------------------
// MÓDULO 3: LECTURA / HIDRATACIÓN desde Firestore (las reglas solo dejan leer lo propio)
// ---------------------------------------------------------------------------
export interface HydratedData {
  cuentas: Cuenta[];
  categorias: Categoria[];
  metas: Meta[];
  deudas: Deuda[];
  transacciones: Transaccion[];
}

const datos = (s: { docs: { data: () => any }[] }) => s.docs.map((d) => d.data());

export async function fetchAllData(): Promise<HydratedData> {
  const uid = uidActual();
  if (!uid) throw new Error('Sin sesión');
  const activos = (c: string) => getDocs(query(coleccion(uid, c), where('is_active', '==', true)));
  // Movimientos: los 200 más recientes activos (se piden 300 por si hay borrados; orden por fecha ISO)
  const [acc, cat, goals, debts, tx] = await Promise.all([
    activos(C.accounts), activos(C.categories), activos(C.goals), activos(C.debts),
    getDocs(query(coleccion(uid, C.transactions), orderBy('fecha', 'desc'), limit(300))),
  ]);
  return {
    cuentas: datos(acc) as Cuenta[],
    categorias: datos(cat) as Categoria[],
    metas: datos(goals) as Meta[],
    deudas: datos(debts) as Deuda[],
    transacciones: (datos(tx) as Transaccion[]).filter((t) => t.is_active !== false).slice(0, 200),
  };
}

// Altas por el servidor (nace en 0, idempotente por id); devuelven el documento creado.
export async function insertAccount(row: Partial<Cuenta> & { user_id: string }): Promise<Cuenta> {
  return api<Cuenta>('POST', '/api/cuentas', row);
}
// [E37] Ajuste de saldo: el servidor calcula la diferencia y deja un movimiento 'ajuste' (idempotente por id).
export interface ResultadoAjuste { id: string | null; diferencia: number; saldo_nuevo: number; repetido: boolean }
export async function ajustarSaldo(id: string, cuentaId: string, saldoObjetivo: number, notas?: string): Promise<ResultadoAjuste> {
  const r = await api<any>('POST', '/api/ajustar-saldo', { id, cuenta_id: cuentaId, saldo_objetivo: saldoObjetivo, notas: notas ?? null });
  return { id: r.id, diferencia: Number(r.diferencia), saldo_nuevo: Number(r.saldo_nuevo), repetido: !!r.repetido };
}

export async function insertCategory(row: Partial<Categoria> & { user_id: string }): Promise<Categoria> {
  return api<Categoria>('POST', '/api/categorias', row);
}
export async function insertGoal(row: Partial<Meta> & { user_id: string }): Promise<Meta> {
  return api<Meta>('POST', '/api/metas', row);
}
export async function insertDebt(row: Partial<Deuda> & { user_id: string }): Promise<Deuda> {
  return api<Deuda>('POST', '/api/deudas', { moneda: 'COP', ...row });
}

// Semilla inicial para un usuario nuevo (2 cuentas y 5 categorías, solo si no tiene). La hace el servidor.
export async function seedDefaultsIfEmpty(_userId: string): Promise<boolean> {
  const r = await api<{ creo: boolean }>('POST', '/api/semilla', { correo: auth.currentUser?.email ?? null });
  return r.creo;
}

// Soft delete (is_active=false) por el servidor
export async function softDeleteEntity(collectionName: string, docId: string): Promise<void> {
  try {
    await api('DELETE', `/api/${collectionName}/${encodeURIComponent(docId)}`);
  } catch (e: any) {
    console.warn(`[Servidor] borrado ${collectionName}/${docId}:`, e?.message);
  }
}

// ---------------------------------------------------------------------------
// MÓDULO 4: TIEMPO REAL (onSnapshot de Firestore). Ante cualquier cambio, la app se re-hidrata.
// ---------------------------------------------------------------------------
export function subscribeToAll(userId: string, onChange: () => void) {
  if (!userId) return () => {};
  let espera: ReturnType<typeof setTimeout> | null = null;
  const avisar = () => { if (espera) clearTimeout(espera); espera = setTimeout(onChange, 300); };
  const bajas = Object.values(C).map((c) => {
    let primera = true; // el primer aviso trae lo que ya existe: no hace falta recargar
    const q = c === C.transactions ? query(coleccion(userId, c), orderBy('fecha', 'desc'), limit(1)) : coleccion(userId, c);
    return onSnapshot(q, () => { if (primera) { primera = false; return; } avisar(); }, (e) => console.warn('[Firestore] tiempo real:', e.message));
  });
  return () => { if (espera) clearTimeout(espera); bajas.forEach((b) => b()); };
}

// ---------------------------------------------------------------------------
// MÓDULO 5: RESUMEN DEL DASHBOARD. Calculado en el servidor sobre TODOS los movimientos (E25).
// ---------------------------------------------------------------------------
export interface ResumenMes { mes: string; ingresos: number; gastos: number; ajustes: number; movimientos: number }
export interface Resumen {
  mes: string;
  hoy: string;
  meses: ResumenMes[];
  patrimonio: { mes: string; valor: number }[];
  categorias: { id: string; nombre: string; total: number; movimientos: number }[];
}
export async function fetchResumen(mes?: string, meses = 6): Promise<Resumen> {
  const q = new URLSearchParams({ meses: String(meses), ...(mes ? { mes } : {}) });
  return api<Resumen>('GET', `/api/resumen?${q}`);
}
