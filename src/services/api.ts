// Lumi Finance · Llamadas de la app al servidor propio (/api/*) con la sesión de Firebase.
// Los errores de negocio llegan como { error: { code, message: "CODIGO: detalle" } } y se lanzan con ese mensaje,
// para que utils/reglas.ts (errorDesdeServidor) los traduzca sin cambios.
import { auth } from './firebase';

export class ErrorApi extends Error {
  constructor(message: string, public code: string, public status: number) { super(message); }
}

export async function api<T = any>(metodo: 'GET' | 'POST' | 'DELETE', ruta: string, cuerpo?: unknown): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new ErrorApi('Tu sesión se cerró. Entra de nuevo.', 'SIN_SESION', 401);
  const r = await fetch(ruta, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });
  const j: any = await r.json().catch(() => null);
  if (!r.ok) throw new ErrorApi(j?.error?.message || `Error ${r.status}`, j?.error?.code || `HTTP_${r.status}`, r.status);
  return j as T;
}
