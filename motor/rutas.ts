// Lumi Finance · Rutas LOCALES del motor (versión de prueba, Starter Tier).
// La app sigue llamando "/api/..." como siempre (src/services/api.ts). Estas rutas se resuelven aquí, en el navegador,
// contra Firestore. Las que necesitan llave o internet (voz con Gemini, tasas, medir la voz) van al servidor.
import { ErrorNegocio, falla } from './util';
import { registrarMovimiento, ajustarSaldo } from './dinero';
import { crearCuenta, crearCategoria, crearMeta, crearDeuda, borrarSuave, sembrarSiVacio, registrarExportacion } from './altas';
import { resumen, exportar } from './reportes';
import { interpretar, cerrarCaptura, type RespuestaOrganizar } from './voz';

export { ErrorNegocio };
export const esRutaLocal = (metodo: string, ruta: string) =>
  !/^\/api\/(tasas|salud|voz\/organizar|dev\/)/.test(ruta.split('?')[0]) && ruta.startsWith('/api/') && !!metodo;

export async function ejecutarLocal(uid: string, metodo: string, ruta: string, cuerpo: any, organizar: (b: unknown) => Promise<RespuestaOrganizar>): Promise<unknown> {
  if (!uid) falla('NO_AUTENTICADO', 'inicia sesión de nuevo', 401);
  const [camino, q = ''] = ruta.split('?');
  const consulta = new URLSearchParams(q);
  const b = cuerpo ?? {};
  const clave = `${metodo} ${camino}`;
  switch (clave) {
    case 'POST /api/semilla': return { creo: await sembrarSiVacio(uid, b.correo ?? null) };
    case 'POST /api/movimientos': return { id: await registrarMovimiento(uid, b) };
    case 'POST /api/ajustar-saldo': return ajustarSaldo(uid, b.id, b.cuenta_id, b.saldo_objetivo, b.notas);
    case 'POST /api/cuentas': return crearCuenta(uid, b);
    case 'POST /api/categorias': return crearCategoria(uid, b);
    case 'POST /api/metas': return crearMeta(uid, b);
    case 'POST /api/deudas': return crearDeuda(uid, b);
    case 'GET /api/resumen': return resumen(uid, consulta.get('mes'), Number(consulta.get('meses')) || 6);
    case 'GET /api/exportar': return exportar(uid, consulta.get('desde'), consulta.get('hasta'));
    case 'POST /api/exportaciones': await registrarExportacion(uid, b); return { ok: true };
    case 'POST /api/voz/interpretar': return interpretar(uid, b, organizar);
    case 'POST /api/voz/cerrar': return cerrarCaptura(uid, String(b.captura_id || ''), b.confirmados);
  }
  const borrar = /^\/api\/([a-z]+)\/([^/]+)$/.exec(camino);
  if (metodo === 'DELETE' && borrar) { await borrarSuave(uid, borrar[1], decodeURIComponent(borrar[2])); return { ok: true }; }
  return falla('NO_EXISTE', 'ruta desconocida', 404);
}
