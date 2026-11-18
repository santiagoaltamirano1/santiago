import React from 'react';

// Iteración 2 · F5 · Vista para imprimir / "Guardar como PDF" (window.print, sin librerías).
// Convierte el Markdown de Exportar (solo títulos, tablas y párrafos) en elementos de React: nunca se usa
// innerHTML, así que el texto de una nota no puede inyectar nada.

type Bloque =
  | { tipo: 'h'; nivel: number; texto: string }
  | { tipo: 'p'; texto: string }
  | { tipo: 'tabla'; cabecera: string[]; filas: string[][] };

const celdas = (linea: string) =>
  linea.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));

export function bloquesDe(md: string): Bloque[] {
  const out: Bloque[] = [];
  const lineas = md.split('\n');
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    if (!l.trim()) continue;
    const h = l.match(/^(#{1,4})\s+(.*)$/);
    if (h) { out.push({ tipo: 'h', nivel: h[1].length, texto: h[2] }); continue; }
    if (l.startsWith('|') && /^\|(\s*-+\s*\|)+\s*$/.test(lineas[i + 1] || '')) {
      const cabecera = celdas(l);
      const filas: string[][] = [];
      i += 2;
      while (i < lineas.length && lineas[i].startsWith('|')) { filas.push(celdas(lineas[i])); i++; }
      i--;
      out.push({ tipo: 'tabla', cabecera, filas });
      continue;
    }
    out.push({ tipo: 'p', texto: l });
  }
  return out;
}

export const DocumentoImprimible: React.FC<{ markdown: string }> = ({ markdown }) => (
  <div id="lumi-imprimible" className="lumi-imprimible" aria-hidden="true">
    {bloquesDe(markdown).map((b, k) => {
      if (b.tipo === 'h') {
        const Tag = (['h1', 'h2', 'h3', 'h4'] as const)[b.nivel - 1];
        return <Tag key={k}>{b.texto}</Tag>;
      }
      if (b.tipo === 'p') return <p key={k}>{b.texto}</p>;
      return (
        <table key={k}>
          <thead><tr>{b.cabecera.map((c, j) => <th key={j}>{c}</th>)}</tr></thead>
          <tbody>{b.filas.map((f, j) => <tr key={j}>{f.map((c, m) => <td key={m}>{c}</td>)}</tr>)}</tbody>
        </table>
      );
    })}
    <p className="lumi-imprimible-pie">Generado por Lumi Finance. Las cifras salen de tus registros.</p>
  </div>
);
