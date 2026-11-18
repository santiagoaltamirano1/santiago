// Prueba de punta a punta de la VERSIÓN DE PRUEBA (Starter Tier) contra los EMULADORES de Firebase (sin internet).
// Ejecutar:  npm run prueba:motor
// La app (motor/) escribe en Firestore con el SDK cliente, como cada persona, bajo firestore.rules.
// El servidor solo hace la voz (Gemini, aquí SIMULADO) y las tasas.
// Cubre: registrar, transferir, ajustar, dólares, metas, deudas, repetidos, datos ajenos, permisos de Firestore,
// resumen, exportar, tasas y voz.
process.env.LUMI_NO_ARRANCAR = '1';
process.env.FIREBASE_PROJECT_ID ||= 'demo-lumi';
process.env.TASAS_DESACTIVADAS = '1';
delete process.env.GEMINI_API_KEY;
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { initializeApp as appCliente } from 'firebase/app';
import { getAuth as authCliente, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, collection, getDocs, deleteDoc, type Firestore } from 'firebase/firestore';
import { initializeApp as appAdmin } from 'firebase-admin/app';
import { getFirestore as dbAdmin } from 'firebase-admin/firestore';

const { crearApp } = await import('../server');
const { usarBd } = await import('../motor/bd');
const { usarTasas } = await import('../motor/tasas');
const { ejecutarLocal, esRutaLocal, ErrorNegocio } = await import('../motor/rutas');
const { hoyBogota } = await import('../motor/util');
const { filtrarTrm, armarVigentes } = await import('../server/tasas');
const { usarClienteDePrueba, aEsquemaGemini, aEsquemaOpenApi } = await import('../server/voz/gemini');
const { esquema } = await import('../server/voz/prompt');

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error('Esta prueba solo corre con los emuladores (npm run prueba:motor).'); process.exit(1);
}

let ok = 0, mal = 0;
const caso = (n: string, c: boolean, d: unknown = '') => { if (c) ok++; else { mal++; console.log('  ✗', n, typeof d === 'string' ? d : JSON.stringify(d)); } };

const servidor = crearApp().listen(0);
const base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
const PROYECTO = process.env.FIREBASE_PROJECT_ID!;
const [hostFs, puertoFs] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
usarTasas(() => ({ tasas: { usd: 4100, eur: 4450 }, vigentes: [] }));

// Firestore "de administrador" solo para VERIFICAR lo guardado (en el emulador no pasa por las reglas)
const adm = dbAdmin(appAdmin({ projectId: PROYECTO }));
const col = (uid: string, c: string) => adm.collection('usuarios').doc(uid).collection(c);
const leer = async (uid: string, c: string, id: string) => (await col(uid, c).doc(id).get()).data() as any;

interface Usuario { uid: string; token: string; correo: string; db: Firestore }
async function crearUsuario(correo: string): Promise<Usuario> {
  const app = appCliente({ projectId: PROYECTO, apiKey: 'demo', authDomain: 'demo' }, correo);
  const auth = authCliente(app); connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
  const r = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: correo, password: 'clave-123456', returnSecureToken: true }),
  });
  await r.json();
  const cred = await signInWithEmailAndPassword(auth, correo, 'clave-123456');
  const db = initializeFirestore(app, { ignoreUndefinedProperties: true }); connectFirestoreEmulator(db, hostFs, Number(puertoFs));
  return { uid: cred.user.uid, token: await cred.user.getIdToken(), correo, db };
}
const alServidor = async (token: string | null, metodo: string, ruta: string, cuerpo?: unknown) => {
  const r = await fetch(base + ruta, { method: metodo, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) { const e: any = new Error(j?.error?.message || `HTTP ${r.status}`); e.status = r.status; e.code = j?.error?.code; throw e; }
  return j;
};
/** Igual que src/services/api.ts: lo local va al motor (como esa persona) y lo demás al servidor. Errores → { status, error }. */
const api = (u: Usuario | null) => async (metodo: string, ruta: string, cuerpo?: unknown): Promise<any> => {
  try {
    let j: any;
    if (u && esRutaLocal(metodo, ruta)) {
      usarBd(u.db);
      j = await ejecutarLocal(u.uid, metodo, ruta, cuerpo, (b) => alServidor(u.token, 'POST', '/api/voz/organizar', b));
    } else j = await alServidor(u?.token ?? null, metodo, ruta, cuerpo);
    return Array.isArray(j) ? Object.assign(j, { status: 200 }) : { status: 200, ...j };
  } catch (e: any) {
    if (e instanceof ErrorNegocio) return { status: e.status, error: { code: e.codigo, message: e.message } };
    return { status: e?.status || 500, error: { code: e?.code || 'ERROR', message: e?.message } };
  }
};

// ------------------------------------------------------------------ sesión
const ana = await crearUsuario(`ana.${Date.now()}@prueba.co`);
const beto = await crearUsuario(`beto.${Date.now()}@prueba.co`);
const A = api(ana), B = api(beto);
caso('Servidor: voz sin sesión → 401', (await api(null)('POST', '/api/voz/organizar', { texto: 'hola mundo' })).status === 401);
caso('Servidor: token falso → 401', (await alServidor('x.y.z', 'POST', '/api/voz/organizar', {}).catch((e) => e)).status === 401);
caso('Salud responde (modo: la app escribe; sin IA en la prueba)', ((s) => s.ia?.llave === false && /firestore\.rules/.test(s.firebase?.modo))(await api(null)('GET', '/api/salud')));

// ------------------------------------------------------------------ semilla
caso('Semilla: crea la primera vez', (await A('POST', '/api/semilla', {})).creo === true);
caso('Semilla: no duplica', (await A('POST', '/api/semilla', {})).creo === false);
const cuentas = (await col(ana.uid, 'cuentas').get()).docs.map((d) => d.data());
const cats = (await col(ana.uid, 'categorias').get()).docs.map((d) => d.data());
caso('Semilla: 2 cuentas y 5 categorías, todas en 0', cuentas.length === 2 && cats.length === 5 && cuentas.every((c) => c.saldo_actual === 0));
const efe = cuentas.find((c) => c.nombre === 'Efectivo')!.id, aho = cuentas.find((c) => c.nombre === 'Ahorros Principal')!.id;
const comida = cats.find((c) => c.nombre === 'Comida')!.id, salario = cats.find((c) => c.nombre === 'Salario')!.id;

// ------------------------------------------------------------------ ingreso, gasto, categoría, idempotencia
const hoy = hoyBogota();
const mov = (x: any) => ({ id: randomUUID(), fecha: new Date().toISOString(), fecha_local_str: hoy, ...x });
let r = await A('POST', '/api/movimientos', mov({ tipo: 'ingreso', monto: 100000, cuenta_id: efe, categoria_id: salario, notas: 'Sueldo', categoria_nombre: 'Salario' }));
caso('Ingreso 100.000 → Efectivo 100.000', !!r.id && (await leer(ana.uid, 'cuentas', efe)).saldo_actual === 100000, r);
r = await A('POST', '/api/movimientos', mov({ tipo: 'gasto', monto: 1000, cuenta_id: efe }));
caso('Gasto sin categoría → CATEGORIA_REQUERIDA', r.error?.code === 'CATEGORIA_REQUERIDA' && r.status === 400, r);
r = await A('POST', '/api/movimientos', mov({ tipo: 'gasto', monto: 1000, cuenta_id: efe, categoria_id: salario }));
caso('Gasto con categoría de ingreso → CATEGORIA_INVALIDA', r.error?.code === 'CATEGORIA_INVALIDA', r);
caso('El rechazo no tocó el saldo', (await leer(ana.uid, 'cuentas', efe)).saldo_actual === 100000);
const g1 = mov({ tipo: 'gasto', monto: -25000, cuenta_id: efe, categoria_id: comida, categoria_nombre: 'Comida', notas: 'Almuerzo' });
await A('POST', '/api/movimientos', g1);
r = await A('POST', '/api/movimientos', g1);
caso('Gasto "-25000" se guarda en positivo y repetido no descuenta 2 veces', r.id === g1.id && (await leer(ana.uid, 'cuentas', efe)).saldo_actual === 75000);
const g1doc = await leer(ana.uid, 'movimientos', g1.id);
caso('Movimiento guardado con monto positivo, tasa 1 y nombre de categoría', g1doc.monto === 25000 && g1doc.tasa_cop === 1 && g1doc.categoria_nombre === 'Comida' && g1doc.user_id === ana.uid);
caso('Monto 0 → MONTO_INVALIDO', (await A('POST', '/api/movimientos', mov({ tipo: 'gasto', monto: 0, cuenta_id: efe, categoria_id: comida }))).error?.code === 'MONTO_INVALIDO');
caso('Tipo raro → TIPO_INVALIDO', (await A('POST', '/api/movimientos', mov({ tipo: 'ajuste', monto: 5, cuenta_id: efe }))).error?.code === 'TIPO_INVALIDO');

// ------------------------------------------------------------------ transferencia
r = await A('POST', '/api/movimientos', mov({ tipo: 'transferencia', monto: 20000, cuenta_id: efe, destino_cuenta_id: aho, categoria_id: comida }));
caso('Transferencia 20.000: Efectivo 55.000 · Ahorros 20.000', (await leer(ana.uid, 'cuentas', efe)).saldo_actual === 55000 && (await leer(ana.uid, 'cuentas', aho)).saldo_actual === 20000, r);
caso('Transferencia no guarda categoría', (await leer(ana.uid, 'movimientos', r.id)).categoria_id === null);
caso('Misma cuenta → MISMA_CUENTA', (await A('POST', '/api/movimientos', mov({ tipo: 'transferencia', monto: 1, cuenta_id: efe, destino_cuenta_id: efe }))).error?.code === 'MISMA_CUENTA');
caso('Sin destino → DESTINO_REQUERIDO', (await A('POST', '/api/movimientos', mov({ tipo: 'transferencia', monto: 1, cuenta_id: efe }))).error?.code === 'DESTINO_REQUERIDO');

// ------------------------------------------------------------------ dólares y ajuste de saldo
const usd = randomUUID();
r = await A('POST', '/api/cuentas', { id: usd, nombre: 'Inversión USD', tipo: 'broker', moneda: 'USD', saldo_actual: 999 });
caso('Cuenta nueva nace en 0 aunque pidan 999', r.saldo_actual === 0 && (await leer(ana.uid, 'cuentas', usd)).saldo_actual === 0, r);
caso('Crear la misma cuenta otra vez devuelve la misma', (await A('POST', '/api/cuentas', { id: usd, nombre: 'Otra', tipo: 'broker', moneda: 'USD' })).nombre === 'Inversión USD');
caso('Tipo de cuenta raro → TIPO_INVALIDO', (await A('POST', '/api/cuentas', { nombre: 'X', tipo: 'cripto' })).error?.code === 'TIPO_INVALIDO');
const aj = randomUUID();
r = await A('POST', '/api/ajustar-saldo', { id: aj, cuenta_id: usd, saldo_objetivo: 100, notas: 'Saldo inicial' });
const ajDoc = await leer(ana.uid, 'movimientos', aj);
caso('Ajuste a US$100: diferencia 100 y movimiento "ajuste" con tasa por defecto 4.100', r.diferencia === 100 && ajDoc.tipo === 'ajuste' && ajDoc.tasa_cop === 4100 && ajDoc.saldo_anterior === 0 && ajDoc.saldo_nuevo === 100, r);
r = await A('POST', '/api/ajustar-saldo', { id: aj, cuenta_id: usd, saldo_objetivo: 100 });
caso('Ajuste repetido → repetido=true sin cambiar nada', r.repetido === true && (await leer(ana.uid, 'cuentas', usd)).saldo_actual === 100);
r = await A('POST', '/api/ajustar-saldo', { id: randomUUID(), cuenta_id: usd, saldo_objetivo: 100 });
caso('Ajuste al mismo saldo → diferencia 0 y sin movimiento', r.diferencia === 0 && r.id === null);
r = await A('POST', '/api/movimientos', mov({ tipo: 'transferencia', monto: 10, cuenta_id: usd, destino_cuenta_id: aho }));
caso('Transferir US$10 a cuenta en pesos suma 41.000', (await leer(ana.uid, 'cuentas', aho)).saldo_actual === 61000 && (await leer(ana.uid, 'cuentas', usd)).saldo_actual === 90, r);
caso('…y queda con moneda USD, tasa 4.100 y aplicado 41.000', ((m) => m.moneda === 'USD' && m.tasa_cop === 4100 && m.monto_aplicado === 41000)(await leer(ana.uid, 'movimientos', r.id)));

// ------------------------------------------------------------------ metas
const meta = randomUUID();
await A('POST', '/api/metas', { id: meta, nombre: 'MacBook', monto_objetivo: 1000000, monto_actual: 500 });
caso('Meta nace en 0', (await leer(ana.uid, 'metas', meta)).monto_actual === 0);
caso('Meta con objetivo 0 → MONTO_INVALIDO', (await A('POST', '/api/metas', { nombre: 'X', monto_objetivo: 0 })).error?.code === 'MONTO_INVALIDO');
// disponible = 55.000 (efe) + 61.000 (aho) + 90×4100 = 485.000
r = await A('POST', '/api/movimientos', mov({ tipo: 'aporte_meta', monto: 50000, meta_id: meta }));
caso('Aporte 50.000 → meta 50.000 y 5 %', ((m) => m.monto_actual === 50000 && m.porcentaje === 5)(await leer(ana.uid, 'metas', meta)), r);
r = await A('POST', '/api/movimientos', mov({ tipo: 'aporte_meta', monto: 500000, meta_id: meta }));
caso('Aporte mayor que lo disponible → DISPONIBLE_INSUFICIENTE con el máximo (435.000)', r.error?.code === 'DISPONIBLE_INSUFICIENTE' && r.error.message === 'DISPONIBLE_INSUFICIENTE: 435000', r);
r = await A('POST', '/api/movimientos', mov({ tipo: 'retiro_meta', monto: 60000, meta_id: meta }));
caso('Retiro mayor a lo ahorrado → RETIRO_MAYOR', r.error?.code === 'RETIRO_MAYOR', r);
await A('POST', '/api/movimientos', mov({ tipo: 'retiro_meta', monto: 10000, meta_id: meta }));
caso('Retiro 10.000 → meta 40.000; las cuentas no cambian', (await leer(ana.uid, 'metas', meta)).monto_actual === 40000 && (await leer(ana.uid, 'cuentas', efe)).saldo_actual === 55000);

// ------------------------------------------------------------------ deudas
const deuda = randomUUID();
await A('POST', '/api/deudas', { id: deuda, contraparte: 'Mamá', tipo: 'por_pagar', monto_total: 0, monto_pagado: 7, estado: 'saldada' });
caso('Deuda nace activa y sin pagos', ((d) => d.estado === 'activa' && d.monto_pagado === 0)(await leer(ana.uid, 'deudas', deuda)));
r = await A('POST', '/api/movimientos', mov({ tipo: 'prestamo_capital', monto: 100000, cuenta_id: efe, deuda_id: deuda }));
caso('"Mamá me prestó 100.000": Efectivo 155.000 y deuda total 100.000', (await leer(ana.uid, 'cuentas', efe)).saldo_actual === 155000 && (await leer(ana.uid, 'deudas', deuda)).monto_total === 100000, r);
caso('Abono mayor a lo que debo → SOBREPAGO 100000', ((x) => x.error?.code === 'SOBREPAGO' && x.error.message === 'SOBREPAGO: 100000')(await A('POST', '/api/movimientos', mov({ tipo: 'abono_capital', monto: 150000, cuenta_id: efe, deuda_id: deuda }))));
await A('POST', '/api/movimientos', mov({ tipo: 'abono_capital', monto: 100000, cuenta_id: efe, deuda_id: deuda }));
caso('Abono total: Efectivo 55.000 y deuda saldada', (await leer(ana.uid, 'cuentas', efe)).saldo_actual === 55000 && (await leer(ana.uid, 'deudas', deuda)).estado === 'saldada');
caso('Abonar a deuda saldada → DEUDA_SALDADA', (await A('POST', '/api/movimientos', mov({ tipo: 'abono_capital', monto: 1, cuenta_id: efe, deuda_id: deuda }))).error?.code === 'DEUDA_SALDADA');
caso('Meta y deuda a la vez → META_Y_DEUDA', (await A('POST', '/api/movimientos', mov({ tipo: 'gasto', monto: 1, cuenta_id: efe, categoria_id: comida, meta_id: meta, deuda_id: deuda }))).error?.code === 'META_Y_DEUDA');
const cobro = randomUUID();
await A('POST', '/api/deudas', { id: cobro, contraparte: 'Camilo', tipo: 'por_cobrar', monto_total: 0 });
await A('POST', '/api/movimientos', mov({ tipo: 'prestamo_capital', monto: 30000, cuenta_id: efe, deuda_id: cobro }));
caso('"Le presté 30.000 a Camilo": Efectivo 25.000 y Camilo me debe 30.000', (await leer(ana.uid, 'cuentas', efe)).saldo_actual === 25000 && (await leer(ana.uid, 'deudas', cobro)).monto_total === 30000);
await A('POST', '/api/movimientos', mov({ tipo: 'abono_capital', monto: 10000, cuenta_id: efe, deuda_id: cobro }));
caso('Camilo abona 10.000: Efectivo 35.000 y pagado 10.000', (await leer(ana.uid, 'cuentas', efe)).saldo_actual === 35000 && (await leer(ana.uid, 'deudas', cobro)).monto_pagado === 10000);

// ------------------------------------------------------------------ datos ajenos
await B('POST', '/api/semilla', {});
const catB = (await col(beto.uid, 'categorias').get()).docs.map((d) => d.data()).find((c) => c.tipo === 'gasto')!.id;
caso('Beto no puede gastar desde la cuenta de Ana → CUENTA_AJENA', (await B('POST', '/api/movimientos', mov({ tipo: 'gasto', monto: 1, cuenta_id: efe, categoria_id: catB }))).error?.code === 'CUENTA_AJENA');
caso('Beto no puede abonar a la meta de Ana → META_AJENA', (await B('POST', '/api/movimientos', mov({ tipo: 'aporte_meta', monto: 1, meta_id: meta }))).error?.code === 'META_AJENA');
caso('Beto no puede borrar la cuenta de Ana → 404', (await B('DELETE', `/api/cuentas/${efe}`)).status === 404);
const idAna = g1.id;
r = await B('POST', '/api/movimientos', { ...g1, cuenta_id: (await col(beto.uid, 'cuentas').limit(1).get()).docs[0].id, categoria_id: catB });
caso('El mismo id en otra persona es OTRO movimiento (no pisa el de Ana)', r.id === idAna && (await leer(ana.uid, 'movimientos', idAna)).user_id === ana.uid);

// ------------------------------------------------------------------ permisos de Firestore (firestore.rules)
const intento = async (f: () => Promise<unknown>) => { try { await f(); return 'ok'; } catch (e: any) { return e?.code || 'error'; } };
const anonimo = initializeFirestore(appCliente({ projectId: PROYECTO, apiKey: 'demo' }, 'anonimo'), {}); connectFirestoreEmulator(anonimo, hostFs, Number(puertoFs));
caso('Sin sesión no se lee nada', (await intento(() => getDoc(doc(anonimo, 'usuarios', ana.uid, 'cuentas', efe)))) === 'permission-denied');
caso('Sin sesión no se escribe nada', (await intento(() => setDoc(doc(anonimo, 'usuarios', ana.uid, 'cuentas', 'x'), { a: 1 }))) === 'permission-denied');
caso('Ana lee sus cuentas', (await getDocs(collection(ana.db, 'usuarios', ana.uid, 'cuentas'))).size === 3);
caso('Ana NO lee las cuentas de Beto', (await intento(() => getDocs(collection(ana.db, 'usuarios', beto.uid, 'cuentas')))) === 'permission-denied');
caso('Ana NO escribe en los datos de Beto', (await intento(() => setDoc(doc(ana.db, 'usuarios', beto.uid, 'movimientos', randomUUID()), { monto: 1, user_id: ana.uid }))) === 'permission-denied');
caso('Ana NO crea en su espacio algo a nombre de Beto', (await intento(() => setDoc(doc(ana.db, 'usuarios', ana.uid, 'movimientos', randomUUID()), { monto: 1, user_id: beto.uid }))) === 'permission-denied');
caso('Nada se borra de verdad (delete bloqueado)', (await intento(() => deleteDoc(doc(ana.db, 'usuarios', ana.uid, 'cuentas', efe)))) === 'permission-denied');
caso('Fuera de usuarios/ todo cerrado', (await intento(() => setDoc(doc(ana.db, 'sistema', 'config'), { usd_cop: 1 }))) === 'permission-denied' && (await intento(() => getDocs(collection(ana.db, 'tasas')))) === 'permission-denied');

// ------------------------------------------------------------------ tasas
const ayer = new Date(Date.now() - 864e5 - 5 * 3600e3).toISOString().slice(0, 10);
const manana = new Date(Date.now() + 864e5 - 5 * 3600e3).toISOString().slice(0, 10);
const trm = filtrarTrm([
  { valor: '4000', vigenciadesde: `${ayer}T00:00:00.000`, vigenciahasta: `${hoy}T00:00:00.000` },
  { valor: '4010', vigenciadesde: `${manana}T00:00:00.000`, vigenciahasta: `${manana}T00:00:00.000` },
  { valor: '400', vigenciadesde: '2020-01-01T00:00:00.000' },
]);
caso('TRM: descarta valores raros (400)', trm.length === 2 && trm[0].valor === 4000);
const tv = armarVigentes(trm, 1.1, ayer, hoy);
caso('Tasas vigentes: USD 4.000, EUR 4.400 (1,1 × 4.000) y la próxima TRM 4.010', tv.length === 3 && tv.find((x) => x.moneda === 'USD' && !x.proxima)?.cop_por_unidad === 4000 && tv.find((x) => x.moneda === 'EUR')?.cop_por_unidad === 4400 && tv.find((x) => x.proxima)?.cop_por_unidad === 4010, tv);
caso('GET /api/tasas responde sin sesión (lista)', Array.isArray(await api(null)('GET', '/api/tasas')));
usarTasas(() => ({ tasas: { usd: 4000, eur: 4400 }, vigentes: tv.filter((x) => !x.proxima) }));
r = await A('POST', '/api/movimientos', mov({ tipo: 'transferencia', monto: 10, cuenta_id: usd, destino_cuenta_id: aho }));
caso('Con la tasa nueva, US$10 = 40.000', ((m) => m.tasa_cop === 4000 && m.monto_aplicado === 40000)(await leer(ana.uid, 'movimientos', r.id)));

// ------------------------------------------------------------------ resumen y exportar
const rs = await A('GET', '/api/resumen?meses=3');
const mesHoy = rs.meses?.[rs.meses.length - 1];
caso('Resumen: 3 meses, este mes ingresos 100.000 y gastos 25.000', rs.meses?.length === 3 && mesHoy?.ingresos === 100000 && mesHoy?.gastos === 25000, rs.meses);
caso('Resumen: Comida 25.000 en categorías', rs.categorias?.[0]?.nombre === 'Comida' && rs.categorias[0].total === 25000);
// patrimonio hoy = 35.000 + 101.000 (aho) + 80 USD×4000 + te deben 20.000 = 476.000
caso('Resumen: patrimonio de hoy 476.000', rs.patrimonio?.[rs.patrimonio.length - 1]?.valor === 476000, rs.patrimonio);
const ex = await A('GET', '/api/exportar');
caso('Exportar: filas = total de movimientos', ex.filas?.length === ex.resumen?.totales?.movimientos && ex.filas.length > 10, { filas: ex.filas?.length, total: ex.resumen?.totales?.movimientos });
caso('Exportar: foto (disponible = en cuentas − metas)', ex.resumen?.foto?.disponible === ex.resumen.foto.en_cuentas - 40000 && ex.resumen.foto.te_deben === 20000, ex.resumen?.foto);
caso('Exportar: sin ids en los detalles y con efecto en cuenta', ex.filas.every((f: any) => !/[0-9a-f]{8}-[0-9a-f]{4}/.test(f.detalle || '')) && ex.filas.find((f: any) => f.tipo === 'gasto')?.efecto_cuenta === -1);
caso('Exportar: categorías, metas y deudas', ex.resumen.categorias.length === 5 && ex.resumen.metas[0].aportes === 50000 && ex.resumen.deudas.length === 2);
caso('Registrar exportación', (await A('POST', '/api/exportaciones', { formato: 'ia', desde: hoy, hasta: hoy, secciones: ['D1'], filas: 3 })).ok === true);

// ------------------------------------------------------------------ voz
r = await A('POST', '/api/voz/interpretar', { texto: 'gasté 25 mil en almuerzo' });
caso('Voz sin llave de Gemini → error amable y captura en "error"', r.status === 502 && r.error?.code === 'IA_FALLO', r);
const capId = randomUUID();
await col(ana.uid, 'capturas').doc(capId).set({ id: capId, user_id: ana.uid, texto: 'x', estado: 'interpretada', creado_en: new Date().toISOString(), cerrada_en: null, metricas: {}, respuesta: { validados: [{ tipo: 'gasto', monto: 25000, cuenta_id: efe, categoria_id: comida }, { tipo: 'gasto', monto: 8000 }] } });
caso('Movimiento de una captura con origen "manual" → ORIGEN_INVALIDO', (await A('POST', '/api/movimientos', mov({ tipo: 'gasto', monto: 26000, cuenta_id: efe, categoria_id: comida, captura_id: capId }))).error?.code === 'ORIGEN_INVALIDO');
caso('Captura de otra persona → CAPTURA_AJENA', (await B('POST', '/api/movimientos', mov({ tipo: 'gasto', monto: 1, cuenta_id: (await col(beto.uid, 'cuentas').limit(1).get()).docs[0].id, categoria_id: catB, origen: 'ia_voz', captura_id: capId }))).error?.code === 'CAPTURA_AJENA');
r = await A('POST', '/api/movimientos', mov({ tipo: 'gasto', monto: 26000, cuenta_id: efe, categoria_id: comida, origen: 'ia_voz', captura_id: capId }));
caso('Movimiento de voz: queda con captura y la captura pasa a "confirmada"', (await leer(ana.uid, 'movimientos', r.id)).captura_id === capId && (await leer(ana.uid, 'capturas', capId)).estado === 'confirmada');
r = await A('POST', '/api/voz/cerrar', { captura_id: capId, confirmados: [{ i: 0, incluido: true, tipo: 'gasto', monto: 26000, cuenta_id: efe, categoria_id: comida }, { i: 1, incluido: false }, { i: null, incluido: true }] });
const cap = await leer(ana.uid, 'capturas', capId);
caso('Cerrar captura: monto corregido, uno quitado y uno agregado', r.correcciones === 3 && cap.correcciones.some((c: any) => c.campo === 'monto' && c.ia === 25000 && c.persona === 26000) && cap.correcciones.some((c: any) => c.campo === 'quitado') && cap.correcciones.some((c: any) => c.campo === 'agregado'), cap.correcciones);
caso('Cerrar otra vez → ya_cerrada', (await A('POST', '/api/voz/cerrar', { captura_id: capId, confirmados: [] })).ya_cerrada === true);
caso('Cerrar la captura de otra persona → 403', (await B('POST', '/api/voz/cerrar', { captura_id: capId, confirmados: [] })).status === 403);
caso('Evaluar voz apagado por defecto → 404', (await A('POST', '/api/dev/evaluar-voz', {})).status === 404);


// ------------------------------------------------------------------ voz con Gemini SIMULADO (sin internet)
const sinTiposLista = (x: any): boolean => !x || typeof x !== 'object' || (!Array.isArray(x.type) && Object.values(x).every(sinTiposLista));
const eg = aEsquemaGemini(esquema('voz-v2').schema);
const itemG = eg.properties.movimientos.items;
caso('Esquema Gemini: sin "type" en lista, nulos como anyOf y orden fijo', sinTiposLista(eg) && itemG.properties.cuenta_id.anyOf?.some((t: any) => t.type === 'null') && itemG.propertyOrdering?.[0] === 'tipo');
const eo = aEsquemaOpenApi(esquema('voz-v2').schema);
const itemO = eo.properties.movimientos.items;
caso('Esquema clásico: tipos en mayúscula y nullable', eo.type === 'OBJECT' && itemO.properties.cuenta_id.type === 'STRING' && itemO.properties.cuenta_id.nullable === true && itemO.properties.tipo.enum?.includes('gasto') && !('additionalProperties' in itemO));
const llamadas: any[] = [];
const respuestaFalsa = (movs: any[]) => ({ text: JSON.stringify({ aclaracion: null, movimientos: movs }), usageMetadata: { promptTokenCount: 2900, cachedContentTokenCount: 2600, candidatesTokenCount: 120 } });
const movTaxi = { tipo: 'gasto', monto: 8000, moneda: 'COP', descripcion: 'Taxi', cuenta_id: null, destino_cuenta_id: null, categoria_id: null, meta_id: null, deuda_id: null, fecha: null, confianza: 0.9, dudas: [], texto_fuente: '8 mil en un taxi', nota: null, contraparte: null, cuenta_dicha: null, destino_dicho: null };
const cats2 = (await col(ana.uid, 'categorias').get()).docs.map((d) => d.data());
const transp = cats2.find((c) => c.nombre === 'Transporte')!.id;
usarClienteDePrueba({ models: { generateContent: async (req: any) => {
  llamadas.push(req);
  if (llamadas.length === 1) throw new Error('400 INVALID_ARGUMENT: thinking budget is not supported by this model');
  if (llamadas.length === 2) throw new Error('400 INVALID_ARGUMENT: Invalid JSON payload: response_json_schema');
  return respuestaFalsa([{ ...movTaxi, categoria_id: transp }]);
} } } as any);
r = await A('POST', '/api/voz/interpretar', { texto: 'gasté 8 mil en un taxi', cuenta_por_defecto: efe, texto_dictado: 'gasté ocho mil en un taxi', transcriptor: 'web_speech' });
caso('Gemini: si no deja "sin pensar", repite pensando; si rechaza el esquema, usa el clásico', llamadas.length === 3 && !llamadas[1].config.thinkingConfig && !!llamadas[2].config.responseSchema && !llamadas[2].config.responseJsonSchema, llamadas.map((l) => Object.keys(l.config)));
caso('Voz: devuelve el gasto con cuenta por defecto, categoría y fuente ubicada', r.movimientos?.length === 1 && r.movimientos[0].cuenta_id === efe && r.movimientos[0].categoria_id === transp && r.movimientos[0].fuente?.inicio === 6 && r.version_prompt === 'voz-v2', r);
const capV = await leer(ana.uid, 'capturas', r.captura_id);
caso('Voz: captura guardada con dictado original, modelo y métricas', capV.estado === 'interpretada' && capV.texto_dictado === 'gasté ocho mil en un taxi' && capV.modelo === 'gemini-2.5-flash' && capV.metricas.tokens_entrada === 2900 && capV.metricas.fuentes_ubicadas === 1, capV);
caso('Voz: el prompt va como instrucción del sistema con las cuentas de Ana', String(llamadas[2].config.systemInstruction).includes('Efectivo') && llamadas[2].contents[0].parts[0].text === 'gasté 8 mil en un taxi');
usarClienteDePrueba({ models: { generateContent: async () => respuestaFalsa([{ ...movTaxi, cuenta_dicha: 'Daviplata', cuenta_id: null, categoria_id: transp }]) } } as any);
r = await A('POST', '/api/voz/interpretar', { texto: 'pagué 8 mil de taxi con Daviplata', cuenta_por_defecto: efe });
caso('Voz: cuenta que no existe NO se cambia en silencio (duda con el nombre)', r.movimientos?.[0]?.cuenta_id === null && r.movimientos[0].dudas.some((d: any) => d.campo === 'cuenta' && d.pregunta.includes('Daviplata')), r.movimientos?.[0]);
usarClienteDePrueba({ models: { generateContent: async () => { throw new Error('API key not valid'); } } } as any);
caso('Voz: llave inválida → error amable', (await A('POST', '/api/voz/interpretar', { texto: 'gasté 5 mil' })).error?.code === 'IA_FALLO');
process.env.EVAL_VOZ = '1';
usarClienteDePrueba({ models: { generateContent: async () => respuestaFalsa([]) } } as any);
const ev = await A('POST', '/api/dev/evaluar-voz', { intentos: 1 });
caso('Medir voz (EVAL_VOZ=1): corre las 30 frases y califica (aquí reprueba a propósito)', ev.filas?.length === 30 && ev.veredicto?.aprobada === false && Array.isArray(ev.veredicto.reglas), { filas: ev.filas?.length, v: ev.veredicto?.aprobada });
delete process.env.EVAL_VOZ;
usarClienteDePrueba(null);

// ------------------------------------------------------------------ borrado suave
caso('Borrar meta: queda is_active=false', (await A('DELETE', `/api/metas/${meta}`)).ok === true && (await leer(ana.uid, 'metas', meta)).is_active === false);
caso('Colección no permitida → COLECCION_INVALIDA', (await A('DELETE', `/api/movimientos/${g1.id}`)).error?.code === 'COLECCION_INVALIDA');

servidor.close();

console.log(`\nprueba-motor-firebase: ${ok} OK, ${mal} fallas`);
process.exit(mal ? 1 : 0);
