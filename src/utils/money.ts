// Formato único de dinero (iteración de diseño 2026-11-17).
// Reglas: signo menos real "−" (U+2212) antes del símbolo y sin espacio; punto de miles;
// COP sin decimales; USD y EUR con 2 decimales y coma decimal.

export type SignoMonto = 'gasto' | 'ingreso' | 'neutro' | 'auto';

const MENOS = '−';

export function simboloMoneda(moneda?: string): string {
  if (moneda === 'USD') return 'US$';
  if (moneda === 'EUR') return '€';
  return '$';
}

export function decimalesMoneda(moneda?: string): number {
  return !moneda || moneda === 'COP' ? 0 : 2;
}

/** Agrupa una parte entera con punto de miles (determinista, no depende del navegador). */
function agrupar(entero: string): string {
  return entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Formatea un monto.
 * - 'gasto'   → siempre "−"
 * - 'ingreso' → siempre "+"
 * - 'neutro'  → sin signo (transferencias)
 * - 'auto'    → "−" solo si el valor es negativo (saldos y totales)
 */
export function formatMonto(valor: number, moneda: string = 'COP', signo: SignoMonto = 'auto'): string {
  const dec = decimalesMoneda(moneda);
  const abs = Math.abs(Number.isFinite(valor) ? valor : 0);
  const [ent, frac] = abs.toFixed(dec).split('.');
  const numero = agrupar(ent) + (frac ? ',' + frac : '');
  let s = '';
  if (signo === 'gasto') s = MENOS;
  else if (signo === 'ingreso') s = '+';
  else if (signo === 'auto' && valor < 0) s = MENOS;
  return s + simboloMoneda(moneda) + numero;
}

/**
 * Normaliza lo que la usuaria escribe en el campo de monto a un número canónico en texto
 * ("5000", "12.5"). Los puntos que se ven en pantalla son separadores de miles y se ignoran;
 * la coma es el separador decimal (solo si la moneda usa decimales). Máx. 12 dígitos enteros.
 */
export function limpiarEntrada(texto: string, conDecimales: boolean): string {
  let s = texto.replace(/[^\d,]/g, '');
  if (!conDecimales) {
    s = s.replace(/,/g, '');
  } else {
    const i = s.indexOf(',');
    if (i >= 0) s = s.slice(0, i) + '.' + s.slice(i + 1).replace(/,/g, '').slice(0, 2);
  }
  const partes = s.split('.');
  let ent = partes[0].replace(/^0+(?=\d)/, '').slice(0, 12);
  if (partes.length > 1) return `${ent || '0'}.${partes[1]}`;
  return ent;
}

/** Texto que se muestra dentro del campo a partir del número canónico ("5000" → "5.000"). */
export function formatEntrada(entrada: string): string {
  if (!entrada) return '';
  const [ent, dec] = entrada.split('.');
  const grupo = agrupar(ent || '0');
  return dec !== undefined ? `${grupo},${dec}` : grupo;
}
