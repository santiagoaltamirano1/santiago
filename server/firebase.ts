// Lumi Finance · Conexión del SERVIDOR con Firebase (Admin SDK).
// El servidor es el único que escribe en Firestore: la app solo lee (ver firestore.rules).
//
// Credenciales, en este orden:
//  1. Secreto FIREBASE_SERVICE_ACCOUNT (JSON completo de una cuenta de servicio) → se usa tal cual.
//  2. Credenciales por defecto del entorno (Cloud Run / AI Studio) → applicationDefault().
// El proyecto y la base salen de firebase-applet-config.json (lo crea AI Studio al activar Firebase).
import { readFileSync, existsSync } from 'node:fs';
import { initializeApp, cert, applicationDefault, getApps, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
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
let db: Firestore | null = null;

export function firebase(): { app: App; db: Firestore } {
  if (app && db) return { app, db };
  const cfg = leerConfigFirebase();
  const projectId = process.env.FIREBASE_PROJECT_ID || cfg?.projectId;
  if (!projectId) throw new Error('FIREBASE_SIN_CONFIGURAR: falta firebase-applet-config.json (activa Firebase en AI Studio)');
  const cuenta = process.env.FIREBASE_SERVICE_ACCOUNT;
  const credencial = cuenta ? cert(JSON.parse(cuenta)) : process.env.FIRESTORE_EMULATOR_HOST ? null : applicationDefault();
  app = getApps()[0] || initializeApp({ projectId, ...(credencial ? { credential: credencial } : {}) });
  const base = process.env.FIRESTORE_DATABASE_ID || cfg?.firestoreDatabaseId;
  db = base && base !== '(default)' ? getFirestore(app, base) : getFirestore(app);
  db.settings({ ignoreUndefinedProperties: true });
  return { app, db };
}

/** Verifica el token de Firebase Auth que manda la app ("Authorization: Bearer <idToken>"). Devuelve el uid. */
export async function usuarioDelToken(cabecera: string | undefined): Promise<string | null> {
  const token = (cabecera || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  try {
    const d = await getAuth(firebase().app).verifyIdToken(token);
    return d.uid;
  } catch {
    return null;
  }
}

// Rutas de las colecciones. Todo lo de una persona vive bajo usuarios/{uid}/...
export const COL = {
  cuentas: 'cuentas',
  categorias: 'categorias',
  metas: 'metas',
  deudas: 'deudas',
  movimientos: 'movimientos',
  capturas: 'capturas',
  exportaciones: 'exportaciones',
} as const;
export type Coleccion = (typeof COL)[keyof typeof COL];

export const col = (uid: string, c: Coleccion) => firebase().db.collection('usuarios').doc(uid).collection(c);
export const docConfig = () => firebase().db.collection('sistema').doc('config');
export const docEstadoTasas = () => firebase().db.collection('sistema').doc('tasas_estado');
export const colTasas = () => firebase().db.collection('tasas');
