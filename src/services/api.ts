// Lumi Finance · Llamadas de la app a "/api/...".
// Versión de prueba (Starter Tier): casi todo se resuelve EN EL NAVEGADOR con el motor (motor/rutas.ts) contra Firestore.
// Solo van al servidor: /api/tasas, /api/salud, /api/voz/organizar (Gemini) y /api/dev/* (medir la voz).
// Los errores de negocio se lanzan con mensaje "CODIGO: detalle" para que utils/reglas.ts (errorDesdeServidor) los traduzca.
import { auth } from './firebase';
import { ejecutarLocal, esRutaLocal, ErrorNegocio } from '../../motor/rutas';

export class ErrorApi extends Error {
  constructor(message: string, public code: string, public status: number) { super(message); }
}

async function alServidor<T>(metodo: 'GET' | 'POST' | 'DELETE', ruta: string, cuerpo?: unknown): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch(ruta, {
    method: metodo,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });
  const j: any = await r.json().catch(() => null);
  if (!r.ok) throw new ErrorApi(j?.error?.message || `Error ${r.status}`, j?.error?.code || `HTTP_${r.status}`, r.status);
  return j as T;
}

export async function api<T = any>(metodo: 'GET' | 'POST' | 'DELETE', ruta: string, cuerpo?: unknown): Promise<T> {
  if (!esRutaLocal(metodo, ruta)) return alServidor<T>(metodo, ruta, cuerpo);
  const uid = auth.currentUser?.uid;
  if (!uid) throw new ErrorApi('Tu sesión se cerró. Entra de nuevo.', 'SIN_SESION', 401);
  try {
    return (await ejecutarLocal(uid, metodo, ruta, cuerpo, (b) => alServidor('POST', '/api/voz/organizar', b))) as T;
  } catch (e: any) {
    if (e instanceof ErrorNegocio) throw new ErrorApi(e.message, e.codigo, e.status);
    // Sin internet o Firestore no responde: error pasajero (la cola de emergencia reintenta)
    throw new ErrorApi(String(e?.message || 'No se pudo completar. Intenta otra vez.').replace(/^([A-Z_]+):/, 'Error $1 -'), String(e?.code || 'ERROR_RED'), 503);
  }
}
