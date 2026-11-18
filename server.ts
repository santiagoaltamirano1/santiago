// Lumi Finance · SERVIDOR (Express). En AI Studio corre en Cloud Run; en desarrollo sirve la app con Vite.
// Toda escritura de dinero pasa por aquí. La app solo LEE Firestore (firestore.rules) y llama a /api/*.
//
//   npm run dev     → servidor + Vite (http://localhost:3000)
//   npm run build   → compila la app a dist/
//   npm start       → servidor en producción sirviendo dist/
import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { firebase, usuarioDelToken, leerConfigFirebase, docConfig } from './server/firebase';
import { ErrorNegocio } from './server/util';
import { registrarMovimiento, ajustarSaldo } from './server/dinero';
import { crearCuenta, crearCategoria, crearMeta, crearDeuda, borrarSuave, sembrarSiVacio, registrarExportacion } from './server/altas';
import { tasasVigentes, asegurarTasasFrescas } from './server/tasas';
import { resumen, exportar } from './server/reportes';
import { interpretar, cerrarCaptura, evaluarVoz } from './server/voz/capturas';
import { modelos } from './server/voz/gemini';

export function crearApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '200kb' }));

  // ------------------------------------------------------------------ salud (sin sesión)
  app.get('/api/salud', async (_req, res) => {
    const cfg = leerConfigFirebase();
    let firestore = 'ok';
    try { await docConfig().get(); } catch (e: any) { firestore = String(e?.message || e).slice(0, 200); }
    res.json({
      ok: firestore === 'ok' && !!process.env.GEMINI_API_KEY,
      firebase: { config: !!cfg, proyecto: cfg?.projectId ?? process.env.FIREBASE_PROJECT_ID ?? null, base: cfg?.firestoreDatabaseId ?? '(default)', firestore },
      ia: { llave: !!process.env.GEMINI_API_KEY, modelos: modelos() },
      evaluacion_voz: process.env.EVAL_VOZ === '1',
    });
  });

  // ------------------------------------------------------------------ sesión obligatoria
  app.use('/api', async (req: Request, res: Response, next: NextFunction) => {
    const uid = await usuarioDelToken(req.headers.authorization);
    if (!uid) return res.status(401).json({ error: { code: 'NO_AUTENTICADO', message: 'NO_AUTENTICADO: inicia sesión de nuevo' } });
    (req as any).uid = uid;
    next();
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
  const uid = (req: Request) => (req as any).uid as string;

  app.post('/api/semilla', ruta(async (req) => ({ creo: await sembrarSiVacio(uid(req), req.body?.correo ?? null) })));

  app.get('/api/tasas', ruta(async () => {
    // Si hace más de 1 h que no se consultan, se actualizan (máximo 8 s de espera; si no, se responde con lo guardado).
    await Promise.race([asegurarTasasFrescas(), new Promise((r) => setTimeout(r, 8000))]);
    return tasasVigentes();
  }));

  app.post('/api/movimientos', ruta(async (req) => {
    asegurarTasasFrescas().catch(() => undefined); // en segundo plano
    return { id: await registrarMovimiento(uid(req), req.body || {}) };
  }));
  app.post('/api/ajustar-saldo', ruta((req) => ajustarSaldo(uid(req), req.body?.id, req.body?.cuenta_id, req.body?.saldo_objetivo, req.body?.notas)));

  app.post('/api/cuentas', ruta((req) => crearCuenta(uid(req), req.body)));
  app.post('/api/categorias', ruta((req) => crearCategoria(uid(req), req.body)));
  app.post('/api/metas', ruta((req) => crearMeta(uid(req), req.body)));
  app.post('/api/deudas', ruta((req) => crearDeuda(uid(req), req.body)));
  app.delete('/api/:coleccion/:id', ruta(async (req) => { await borrarSuave(uid(req), req.params.coleccion, req.params.id); return { ok: true }; }));

  app.get('/api/resumen', ruta((req) => resumen(uid(req), req.query.mes as string, Number(req.query.meses) || 6)));
  app.get('/api/exportar', ruta((req) => exportar(uid(req), req.query.desde as string, req.query.hasta as string)));
  app.post('/api/exportaciones', ruta(async (req) => { await registrarExportacion(uid(req), req.body); return { ok: true }; }));

  app.post('/api/voz/interpretar', ruta((req) => interpretar(uid(req), req.body)));
  app.post('/api/voz/cerrar', ruta((req) => cerrarCaptura(uid(req), String(req.body?.captura_id || ''), req.body?.confirmados)));
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
  app.listen(puerto, '0.0.0.0', () => {
    console.log(`Lumi Finance en http://localhost:${puerto} (${produccion ? 'producción' : 'desarrollo'})`);
    try { firebase(); } catch (e: any) { console.error('[firebase]', e.message); }
  });
}

if (process.env.LUMI_NO_ARRANCAR !== '1') arrancar();
