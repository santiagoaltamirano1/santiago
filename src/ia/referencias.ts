// Iteración 2 · F3 · Cifras de referencia de Colombia (FIJAS con fecha; se revisan el día 1 de cada mes).
// La IA debe usar estas, nunca las que "recuerde". Si una está vencida (> 60 días después de vigente_hasta), se omite.

export interface Referencia {
  id: string;
  texto: string;
  valor: number;
  fuente: string;
  vigente_desde: string;
  vigente_hasta: string;
  verificar?: string;
}

export const REFERENCIAS_VERSION = '2026-11';

export const REFERENCIAS: Referencia[] = [
  {
    id: 'R01', texto: 'Salario mínimo 2026: $1.750.905 + auxilio de transporte $249.095', valor: 1750905 + 249095,
    fuente: 'Decretos 1469 y 1470 de 2025', vigente_desde: '2026-01-01', vigente_hasta: '2026-12-31',
    verificar: 'Tuvo una suspensión provisional y luego un decreto transitorio que lo mantiene',
  },
  {
    id: 'R02', texto: 'Tasa de usura, consumo y ordinario, noviembre de 2026: 28,34 % E.A.', valor: 0.2834,
    fuente: 'Superintendencia Financiera', vigente_desde: '2026-11-01', vigente_hasta: '2026-11-30',
  },
  {
    id: 'R03', texto: 'Inflación anual a octubre de 2026: 6,30 %', valor: 0.063,
    fuente: 'DANE', vigente_desde: '2026-11-05', vigente_hasta: '2026-12-05',
  },
  {
    id: 'R04', texto: 'Gasto hormiga en Lumi v1: compra de $25.000 o menos en categoría opcional o mixta', valor: 25000,
    fuente: 'Regla de Lumi', vigente_desde: '2026-11-18', vigente_hasta: '2099-12-31',
  },
];

const diasEntre = (a: string, b: string) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 864e5);

/** Referencias utilizables en la fecha de corte (las vencidas hace más de 60 días se omiten). */
export function referenciasVigentes(corte: string, refs: Referencia[] = REFERENCIAS): Referencia[] {
  return refs.filter((r) => diasEntre(r.vigente_hasta, corte) <= 60);
}

export const valorRef = (id: string, refs: Referencia[]) => refs.find((r) => r.id === id)?.valor;

// ---------------------------------------------------------------------------
// Clase de cada categoría: esencial, mixta u opcional (por palabras del nombre; lo que no se reconoce es mixta).
// ---------------------------------------------------------------------------
export type ClaseCategoria = 'esencial' | 'mixta' | 'opcional';

const sinTildes = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const OPCIONAL = ['tinto', 'antojo', 'cafe', 'snack', 'dulce', 'salida', 'rumba', 'fiesta', 'trago', 'licor', 'cerveza', 'entreten', 'cine', 'concierto',
  'suscrip', 'streaming', 'netflix', 'spotify', 'juego', 'videojuego', 'apuesta', 'ropa', 'moda', 'compras', 'regalo', 'gusto', 'hobby', 'viaje', 'paseo', 'belleza', 'uñas', 'peluqueria'];
const ESENCIAL = ['almuerzo', 'corrientazo', 'transmilenio', 'sitp', 'drogueria', 'vivienda', 'arriendo', 'hipoteca', 'credito', 'pension', 'guarderia', 'cuidado', 'alquiler', 'renta', 'servicio', 'agua', 'luz', 'energia', 'gas', 'internet', 'mercado', 'supermercado', 'transporte', 'bus', 'metro',
  'pasaje', 'gasolina', 'salud', 'medic', 'farmacia', 'eps', 'educacion', 'universidad', 'colegio', 'matricula', 'estudio', 'ayudo en la casa', 'casa', 'hogar',
  'cuota', 'deuda', 'seguro', 'administracion'];

// Cada clave debe ser el INICIO de una palabra ("gas" no atrapa "Otros gastos"; "servicio" sí atrapa "Servicios").
// Las claves de 3 letras o menos deben ser la palabra completa.
const coincide = (n: string, k: string) => {
  const palabras = n.split(/[^a-zñ]+/).filter(Boolean);
  if (k.includes(' ')) return n.includes(k);
  return palabras.some((p) => (k.length <= 3 ? p === k : p.startsWith(k)));
};

export function claseCategoria(nombre: string | null | undefined): ClaseCategoria {
  const n = sinTildes(nombre || '');
  if (OPCIONAL.some((k) => coincide(n, k))) return 'opcional';
  if (ESENCIAL.some((k) => coincide(n, k))) return 'esencial';
  return 'mixta';
}
