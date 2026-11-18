// Lumi Finance · SERVIDOR (Express). En AI Studio corre en Cloud Run; en desarrollo sirve la app con Vite.
// Versión de prueba (Starter Tier): el servidor NO toca Firestore. Solo hace lo que necesita una llave o internet:
//   · la voz con Gemini (secreto GEMINI_API_KEY)  · las tasas TRM/BCE en vivo  · medir la voz (EVAL_VOZ=1)
// El dinero lo maneja la app con motor/ (Firestore protegido por firestore.rules).
//
//   npm run dev     → servidor + Vite (http://localhost:3000)
//   npm run build   → compila la app a dist/
//   npm start       → servidor en producción sirviendo dist/
import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { usuarioDelToken, leerConfigFirebase } from './server/firebase';
import { ErrorNegocio } from './motor/util';
import { tasasVigentes } from './server/tasas';
import { organizar, evaluarVoz } from './server/voz/capturas';
import { modelos } from './server/voz/gemini';

export function crearApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '300kb' }));

  // ------------------------------------------------------------------ sin sesión
  app.get('/api/salud', (_req, res) => {
    const cfg = leerConfigFirebase();
    res.json({
      ok: !!cfg && !!process.env.GEMINI_API_KEY,
      firebase: { config: !!cfg, proyecto: cfg?.projectId ?? process.env.FIREBASE_PROJECT_ID ?? null, base: cfg?.firestoreDatabaseId ?? '(default)', modo: 'la app lee y escribe Firestore (firestore.rules)' },
      ia: { llave: !!process.env.GEMINI_API_KEY, modelos: modelos() },
      evaluacion_voz: process.env.EVAL_VOZ === '1',
    });
  });
  const ruta = (fn: (req: Request) => Promise<unknown>) => async (req: Request, res: Response) => {
    try {
      res.json((await fn(req)) ?? { ok: true });
    } catch (e: any) {
      if (e instanceof ErrorNegocio) return res.status(e.status).json({ error: { code: e.codigo, message: e.message } });
      console.error(`[api] ${req.method} ${req.path}`, e);
      res.status(500).json({ error: { code: 'ERROR_SERVIDOR', message: 'No se pudo completar. Intenta otra vez.' } });
    }
  };
  app.get('/api/tasas', ruta(() => tasasVigentes()));

  // ------------------------------------------------------------------ con sesión (gastan saldo de la IA)
  app.use('/api', async (req: Request, res: Response, next: NextFunction) => {
    const uid = await usuarioDelToken(req.headers.authorization);
    if (!uid) return res.status(401).json({ error: { code: 'NO_AUTENTICADO', message: 'NO_AUTENTICADO: inicia sesión de nuevo' } });
    next();
  });
  app.post('/api/voz/organizar', ruta((req) => organizar(req.body)));
  app.post('/api/dev/evaluar-voz', ruta((req) => evaluarVoz(req.body?.version, Number(req.body?.intentos) || 1)));
  app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'NO_EXISTE', message: 'NO_EXISTE: ruta desconocida' } }));
  return app;
}

async function arrancar() {
  const app = crearApp();
  const produccion = process.env.NODE_ENV === 'production';
  if (!produccion) {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const dist = path.join(process.cwd(), 'dist');
    if (existsSync(dist)) app.use(express.static(dist));
    app.get('/healthz', (_req, res) => res.send('OK'));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  const puerto = Number(process.env.PORT) || 3000;
  app.listen(puerto, '0.0.0.0', () => console.log(`Lumi Finance en http://localhost:${puerto} (${produccion ? 'producción' : 'desarrollo'})`));
}

if (process.env.LUMI_NO_ARRANCAR !== '1') arrancar();
