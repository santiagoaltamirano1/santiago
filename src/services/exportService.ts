// Iteración 2 · F3 · Trae TODOS los datos para Exportar desde el servidor.
// No usa el store ni el tiempo real: GET /api/exportar devuelve el resumen y TODAS las filas (server/reportes.ts).
import { api } from './api';
import { DocumentoExport, normalizarDocumento } from '../ia/tipos';

export interface OpcionesExport {
  desde?: string | null; // AAAA-MM-DD
  hasta?: string | null;
  onProgreso?: (filas: number) => void;
}

/** Devuelve el documento completo o lanza un error. Nunca entrega un documento a medias. */
export async function obtenerDocumento({ desde = null, hasta = null, onProgreso }: OpcionesExport = {}): Promise<DocumentoExport> {
  const q = new URLSearchParams({ ...(desde ? { desde } : {}), ...(hasta ? { hasta } : {}) });
  let resumen: any, filas: any[];
  try {
    ({ resumen, filas } = await api<{ resumen: any; filas: any[] }>('GET', `/api/exportar?${q}`));
  } catch (e: any) {
    throw new Error(e?.message || 'No se pudo leer el resumen para exportar');
  }
  if (!resumen || !Array.isArray(filas)) throw new Error('No se pudo leer el resumen para exportar');
  onProgreso?.(filas.length);

  if (filas.length !== Number(resumen.totales?.movimientos ?? filas.length)) {
    // Alguien guardó un movimiento mientras exportábamos: mejor repetir que entregar cifras que no cuadran
    throw new Error('Los datos cambiaron mientras se exportaban. Intenta de nuevo.');
  }
  return normalizarDocumento(resumen, filas);
}

/** Registro opcional de cuándo y qué se exportó (nunca el contenido). Si falla, no bloquea la exportación. */
export async function registrarExportacion(formato: 'md' | 'pdf' | 'ia', desde: string, hasta: string, secciones: string[], filas: number): Promise<void> {
  await api('POST', '/api/exportaciones', { formato, desde, hasta, secciones, filas }).then(() => undefined, () => undefined);
}
