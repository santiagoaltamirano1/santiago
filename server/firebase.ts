// Lumi Finance · El SERVIDOR solo usa Firebase para verificar la sesión (token de Firebase Auth).
// Versión de prueba (Starter Tier de AI Studio): el servidor NO lee ni escribe Firestore.
// verifyIdToken solo necesita el id del proyecto (de firebase-applet-config.json); no pide permisos de IAM.
import { readFileSync, existsSync } from 'node:fs';
import { initializeApp, getApps, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export interface ConfigFirebase { projectId: string; firestoreDatabaseId?: string; [k: string]: unknown }

export function leerConfigFirebase(): ConfigFirebase | null {
  const ruta = process.env.FIREBASE_CONFIG_PATH || 'firebase-applet-config.json';
  if (!existsSync(ruta)) return null;
  try {
    const c = JSON.parse(readFileSync(ruta, 'utf8'));
    return c?.projectId ? c : null;
  } catch {
    return null;
  }
}

let app: App | null = null;
function firebaseApp(): App {
  if (app) return app;
  const projectId = process.env.FIREBASE_PROJECT_ID || leerConfigFirebase()?.projectId;
  if (!projectId) throw new Error('FIREBASE_SIN_CONFIGURAR: falta firebase-applet-config.json (activa Firebase en AI Studio)');
  app = getApps()[0] || initializeApp({ projectId });
  return app;
}

/** Verifica el token que manda la app ("Authorization: Bearer <idToken>"). Devuelve el uid o null. */
export async function usuarioDelToken(cabecera: string | undefined): Promise<string | null> {
  const token = (cabecera || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  try {
    return (await getAuth(firebaseApp()).verifyIdToken(token)).uid;
  } catch {
    return null;
  }
}
