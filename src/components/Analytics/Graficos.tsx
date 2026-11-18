import React, { useState } from 'react';

// Gráficos SVG propios (Fase 6), según la guía dataviz:
// marcas finas (barras ≤ 24 px con punta redondeada de 4 px, línea de 2 px, punto ≥ 8 px con anillo del fondo),
// cuadrícula de 1 px tenue, una sola escala, leyenda con ≥ 2 series, texto en tokens de tinta (nunca del color de la serie),
// tooltip al pasar/tocar y tabla equivalente para lectores de pantalla.

const abreviar = (v: number) => {
  const a = Math.abs(v);
  const s = v < 0 ? '−' : '';
  if (a >= 1e9) return `${s}$${(a / 1e9).toLocaleString('es-CO', { maximumFractionDigits: 1 })} mil M`;
  if (a >= 1e6) return `${s}$${(a / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M`;
  if (a >= 1e3) return `${s}$${Math.round(a / 1e3).toLocaleString('es-CO')} mil`;
  return `${s}$${Math.round(a).toLocaleString('es-CO')}`;
};
const pesos = (v: number) => (v < 0 ? '−' : '') + '$' + Math.round(Math.abs(v)).toLocaleString('es-CO');

/** Escala "bonita" de 0 al máximo con 3 o 4 marcas. */
function marcas(max: number): number[] {
  if (max <= 0) return [0];
  const paso0 = max / 3;
  const pot = Math.pow(10, Math.floor(Math.log10(paso0)));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * pot).find((p) => p >= paso0) || pot * 10;
  const out = [];
  for (let v = 0; v <= max + paso * 0.001; v += paso) out.push(v);
  if (out[out.length - 1] < max) out.push(out[out.length - 1] + paso);
  return out;
}

// ---------------------------------------------------------------------------
// Barras horizontales ordenadas (una serie: magnitud) — "¿En qué se fue?"
// ---------------------------------------------------------------------------
export const BarrasHorizontales: React.FC<{ filas: { nombre: string; valor: number; detalle?: string }[]; oculto?: boolean; color?: string }> = ({ filas, oculto, color = 'var(--chart-expense)' }) => {
  const max = Math.max(1, ...filas.map((f) => f.valor));
  return (
    <ul className="space-y-3" aria-label="Gastos por categoría">
      {filas.map((f) => (
        <li key={f.nombre} title={oculto ? f.nombre : `${f.nombre}: ${pesos(f.valor)}${f.detalle ? ' · ' + f.detalle : ''}`}>
          <div className="flex justify-between text-sm mb-1 gap-2">
            <span className="text-[#0a0a0a] truncate">{f.nombre}</span>
            <span className="tabular-nums font-medium text-[#0a0a0a] shrink-0">{oculto ? '••••' : pesos(f.valor)}</span>
          </div>
          <div className="h-3 w-full" aria-hidden="true">
            <div className="h-full rounded-r-[4px]" style={{ width: `${Math.max(2, (f.valor / max) * 100)}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
};

// ---------------------------------------------------------------------------
// Columnas pareadas (2 series: ingresos y gastos por mes) — "Tendencia"
// ---------------------------------------------------------------------------
export interface PuntoMes { etiqueta: string; ingresos: number; gastos: number }
export const ColumnasPareadas: React.FC<{ datos: PuntoMes[]; oculto?: boolean }> = ({ datos, oculto }) => {
  const [foco, setFoco] = useState<number | null>(null);
  const W = 340, H = 180, izq = 46, abajo = 22, arriba = 8;
  const max = Math.max(1, ...datos.flatMap((d) => [d.ingresos, d.gastos]));
  const ticks = marcas(max);
  const tope = ticks[ticks.length - 1] || 1;
  const banda = (W - izq) / datos.length;
  const ancho = Math.min(14, banda / 3);
  const y = (v: number) => arriba + (H - abajo - arriba) * (1 - v / tope);
  const columna = (x: number, v: number, color: string) => {
    const alto = Math.max(0, H - abajo - y(v));
    if (alto <= 0) return null;
    const r = Math.min(4, alto, ancho / 2);
    // punta redondeada arriba, base cuadrada
    const yt = H - abajo - alto;
    return <path d={`M${x},${H - abajo} V${yt + r} Q${x},${yt} ${x + r},${yt} H${x + ancho - r} Q${x + ancho},${yt} ${x + ancho},${yt + r} V${H - abajo} Z`} fill={color} />;
  };
  const d = foco !== null ? datos[foco] : null;
  return (
    <div className="relative">
      <div className="flex gap-4 text-xs text-[#737373] mb-2" aria-hidden="true">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: 'var(--chart-income)' }} />Ingresos</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: 'var(--chart-expense)' }} />Gastos</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Ingresos y gastos de los últimos meses" onMouseLeave={() => setFoco(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={izq} x2={W} y1={y(t)} y2={y(t)} stroke="var(--hairline)" strokeWidth={1} />
            <text x={izq - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="var(--mid-gray)">{oculto ? '•' : abreviar(t)}</text>
          </g>
        ))}
        {datos.map((p, i) => {
          const x0 = izq + i * banda + (banda - (ancho * 2 + 2)) / 2;
          return (
            <g key={p.etiqueta}>
              {foco === i && <rect x={izq + i * banda} y={arriba} width={banda} height={H - abajo - arriba} fill="var(--hairline)" opacity={0.5} />}
              {columna(x0, p.ingresos, 'var(--chart-income)')}
              {columna(x0 + ancho + 2, p.gastos, 'var(--chart-expense)')}
              <text x={izq + i * banda + banda / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--mid-gray)">{p.etiqueta}</text>
              {/* zona de toque más grande que la marca */}
              <rect x={izq + i * banda} y={0} width={banda} height={H} fill="transparent" onMouseEnter={() => setFoco(i)} onClick={() => setFoco(foco === i ? null : i)} />
            </g>
          );
        })}
      </svg>
      {d && !oculto && (
        <div className="absolute top-6 right-0 bg-white border border-[#e5e5e5] rounded-[12px] shadow-md px-3 py-2 text-xs pointer-events-none" role="status">
          <p className="font-semibold text-[#0a0a0a] mb-0.5">{d.etiqueta}</p>
          <p className="text-[#0a0a0a] tabular-nums">Ingresos {pesos(d.ingresos)}</p>
          <p className="text-[#0a0a0a] tabular-nums">Gastos {pesos(d.gastos)}</p>
          <p className="text-[#737373] tabular-nums">Diferencia {(d.ingresos - d.gastos >= 0 ? '+' : '') + pesos(d.ingresos - d.gastos)}</p>
        </div>
      )}
      <TablaAccesible titulo="Ingresos y gastos por mes" columnas={['Mes', 'Ingresos', 'Gastos']} filas={datos.map((p) => [p.etiqueta, oculto ? '••••' : pesos(p.ingresos), oculto ? '••••' : pesos(p.gastos)])} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Línea con área tenue (1 serie: patrimonio en el tiempo)
// ---------------------------------------------------------------------------
export const LineaTiempo: React.FC<{ datos: { etiqueta: string; valor: number }[]; oculto?: boolean; nombre: string }> = ({ datos, oculto, nombre }) => {
  const [foco, setFoco] = useState<number | null>(null);
  const W = 340, H = 150, izq = 8, der = 8, abajo = 22, arriba = 22;
  if (datos.length === 0) return null;
  const vals = datos.map((d) => d.valor);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (max === min) { max += Math.abs(max) * 0.05 || 1; min -= Math.abs(min) * 0.05 || 1; }
  const x = (i: number) => izq + (datos.length === 1 ? (W - izq - der) / 2 : (i * (W - izq - der)) / (datos.length - 1));
  const y = (v: number) => arriba + (H - abajo - arriba) * (1 - (v - min) / (max - min));
  const linea = datos.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.valor)}`).join(' ');
  const area = `${linea} L${x(datos.length - 1)},${H - abajo} L${x(0)},${H - abajo} Z`;
  const ult = datos.length - 1;
  const f = foco ?? ult;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`${nombre} en los últimos meses`} onMouseLeave={() => setFoco(null)}>
        <line x1={izq} x2={W - der} y1={H - abajo} y2={H - abajo} stroke="var(--hairline)" strokeWidth={1} />
        <path d={area} fill="var(--ink)" opacity={0.08} />
        <path d={linea} fill="none" stroke="var(--ink)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {foco !== null && <line x1={x(f)} x2={x(f)} y1={arriba - 6} y2={H - abajo} stroke="var(--mid-gray)" strokeWidth={1} />}
        <circle cx={x(f)} cy={y(datos[f].valor)} r={5} fill="var(--ink)" stroke="var(--paper)" strokeWidth={2} />
        {!oculto && (
          <text x={Math.min(Math.max(x(f), 40), W - 40)} y={Math.max(12, y(datos[f].valor) - 10)} textAnchor="middle" fontSize="11" fontWeight={600} fill="var(--ink)">
            {abreviar(datos[f].valor)}
          </text>
        )}
        {datos.map((d, i) => (
          <g key={d.etiqueta}>
            <text x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === ult ? 'end' : 'middle'} fontSize="10" fill="var(--mid-gray)">{d.etiqueta}</text>
            <rect x={x(i) - (W / datos.length) / 2} y={0} width={W / datos.length} height={H} fill="transparent" onMouseEnter={() => setFoco(i)} onClick={() => setFoco(i)} />
          </g>
        ))}
      </svg>
      <TablaAccesible titulo={nombre} columnas={['Mes', nombre]} filas={datos.map((d) => [d.etiqueta, oculto ? '••••' : pesos(d.valor)])} />
    </div>
  );
};

/** Tabla equivalente al gráfico (oculta a la vista; la leen los lectores de pantalla). */
const TablaAccesible: React.FC<{ titulo: string; columnas: string[]; filas: string[][] }> = ({ titulo, columnas, filas }) => (
  <table className="sr-only">
    <caption>{titulo}</caption>
    <thead><tr>{columnas.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
    <tbody>{filas.map((f, i) => <tr key={i}>{f.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}</tr>)}</tbody>
  </table>
);
