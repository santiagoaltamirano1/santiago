// Iteración 2 · F6 · Normalizador del dictado (antes de enviarlo a la IA).
// Conservador: solo convierte números dichos en palabras que van PEGADOS a una palabra de dinero
// ("dos palos" → "2 palos", "veinticinco mil" → "25 mil", "media luca" → "500", "una gamba" → "100 mil").
// No toca nada más. Lo que la persona dijo tal cual se guarda aparte (texto_dictado) para auditoría.

const UNIDADES: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
  veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
};
const DECENAS: Record<string, number> = { treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 };
const CENTENAS: Record<string, number> = {
  cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300, cuatrocientos: 400, cuatrocientas: 400,
  quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600, setecientos: 700, setecientas: 700,
  ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900,
};
const DINERO = '(mil|lucas?|luquitas?|barras?|palos?|millones|mill[oó]n|mel[oó]n(?:es)?|pesos|d[oó]lares|euros|k)';

const sinTilde = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** "ciento veinticinco" → 125; null si no es un número en palabras (0–999). */
export function palabrasANumero(frase: string): number | null {
  const p = sinTilde(frase).split(/\s+/).filter((w) => w && w !== 'y');
  if (!p.length) return null;
  let total = 0, visto = false;
  for (const w of p) {
    if (w in CENTENAS) { total += CENTENAS[w]; visto = true; }
    else if (w in DECENAS) { total += DECENAS[w]; visto = true; }
    else if (w in UNIDADES) { total += UNIDADES[w]; visto = true; }
    else return null;
  }
  return visto && total < 1000 ? total : null;
}

const PALABRA_NUM = '(?:cero|un[oa]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieci[a-zé]+|veinti[a-zéú]+|veinte|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|[a-z]+cient[oa]s|quinient[oa]s|y)';

export function normalizarDictado(texto: string): { texto: string; cambio: boolean } {
  let t = texto;
  // Expresiones fijas
  t = t.replace(/\bmedia\s+luca\b/gi, '500');
  t = t.replace(/\buna\s+gamba\b/gi, '100 mil');
  t = t.replace(/\b(un|1)\s+palo\s+y\s+medio\b/gi, '1,5 palos');
  // Número en palabras + palabra de dinero ("veinticinco mil", "dos palos", "trescientos pesos")
  const re = new RegExp(`\\b((?:${PALABRA_NUM}\\s+)*${PALABRA_NUM})\\s+${DINERO}\\b`, 'gi');
  t = t.replace(re, (todo, palabras: string, unidad: string) => {
    const n = palabrasANumero(palabras.replace(/^y\s+|\s+y$/gi, ''));
    return n === null ? todo : `${n} ${unidad}`;
  });
  return { texto: t, cambio: t !== texto };
}
