// Lumi Finance · Conexión de la APP con Firebase (Auth con correo y contraseña + lectura de Firestore).
// La configuración la crea AI Studio al activar Firebase: firebase-applet-config.json (en la raíz).
// Versión de prueba (Starter Tier): la app lee aquí y escribe con el motor (motor/), protegida por firestore.rules.
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';
import { usarBd } from '../../motor/bd';

// Si el archivo aún no existe (Firebase sin activar), la app muestra un aviso en vez de romperse.
const archivos = import.meta.glob('../../firebase-applet-config.json', { eager: true, import: 'default' });
const config = Object.values(archivos)[0] as Record<string, string> | undefined;
const emuladores = import.meta.env.VITE_USAR_EMULADORES === '1'; // solo para pruebas locales (npm run prueba:ui)
export const firebaseConfigurado = emuladores || (!!config?.projectId && !String(config.projectId).startsWith('PON-AQUI'));
const app: FirebaseApp = initializeApp(config?.projectId && !emuladores ? config : { projectId: 'demo-lumi', apiKey: 'demo', authDomain: 'demo' });
export const auth: Auth = getAuth(app);
const base = config?.firestoreDatabaseId;
export const db: Firestore = initializeFirestore(app, { ignoreUndefinedProperties: true }, base && base !== '(default)' ? base : undefined);
usarBd(db);

if (emuladores) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
