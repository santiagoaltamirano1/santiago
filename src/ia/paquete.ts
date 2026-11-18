// Iteración 2 · F4 · Paquete "Copiar para mi IA": [A] instrucciones + [B] perfil + referencias + [C] datos + [D] solicitud.
// Función PURA. Todo lo variable sale del DocumentoExport de la persona; nada de nombre, correo, ids ni capturas de voz.
import type { DocumentoExport } from './tipos';
import { aMarkdown, anonimizarTexto, estimarTokens, MUESTRA_IA } from './markdown';
import { aliasTerceros, calcularIndicadores, diasEntre, Indicadores } from './indicadores';
import { REFERENCIAS, REFERENCIAS_VERSION, Referencia } from './referencias';
import { bloqueInstrucciones, Foco, LINEA_ENTRADA, solicitud, VERSION_AGENTE } from './agenteAnalista';
import { formatMonto } from '../utils/money';

export const TOKENS_META = 20000;
export const TOKENS_TOPE = 40000;

// ---------------------------------------------------------------------------
// [B] Perfil
// ---------------------------------------------------------------------------
export interface Perfil {
  origen: 'onboarding' | 'inferido';
  objetivos: string[];
  fuentes_ingreso: string[];
  situacion_ingresos: string;
  cuentas: string[];
  gastos_principales?: string[];
  meta_principal?: string | null;
}

/** Perfil deducido de los datos cuando no hay onboarding (MESA_AGENTE_ANALISTA_v1.md §1.2). Nunca pregunta nada. */
export function inferirPerfil(doc: DocumentoExport, ind: Indicadores): Perfil {
  const R = doc.resumen;
  const hace90 = new Date(Date.UTC(+ind.corte.slice(0, 4), +ind.corte.slice(5, 7) - 1, +ind.corte.slice(8, 10)) - 89 * 864e5).toISOString().slice(0, 10);
  const fuentes = [...new Set(doc.movimientos.filter((f) => f.tipo === 'ingreso' && f.dia >= hace90 && f.categoria).map((f) => f.categoria as string))];
  const objetivos: string[] = [];
  if (R.metas.some((g) => g.activa)) objetivos.push('Ahorrar');
  if (R.deudas.some((d) => d.activa && d.estado === 'activa' && d.tipo === 'por_pagar')) objetivos.push('Salir de deudas');
  if (R.deudas.some((d) => d.activa && d.estado === 'activa' && d.tipo === 'por_cobrar')) objetivos.push('Cobrar lo que me deben');
  if (!objetivos.length) objetivos.push('Saber en qué se me va la plata');
  const activas = R.cuentas.filter((c) => c.activa);
  const meta = R.metas.filter((g) => g.activa).sort((a, b) => b.objetivo - a.objetivo)[0];
  return {
    origen: 'inferido',
    objetivos,
    fuentes_ingreso: fuentes,
    situacion_ingresos: ind.calidad.includes('SIN_INGRESOS') ? 'sin ingresos en 60 días' : ind.I03?.irregular ? 'irregulares' : ind.I03 ? 'estables' : 'aún no se sabe (menos de 3 meses)',
    cuentas: [...new Set(activas.map((c) => `${c.tipo}${c.moneda !== 'COP' ? ' en ' + c.moneda : ''}`))],
    meta_principal: meta?.nombre ?? null,
  };
}

export function perfilATexto(p: Perfil): string {
  const l = [
    `objetivos: ${p.objetivos.join('; ') || '—'}`,
    `fuentes_ingreso: ${p.fuentes_ingreso.join('; ') || '—'}`,
    `situacion_ingresos: ${p.situacion_ingresos}`,
    `cuentas: ${p.cuentas.join('; ') || '—'}`,
  ];
  if (p.gastos_principales?.length) l.push(`gastos_principales: ${p.gastos_principales.join('; ')}`);
  l.push(`meta_principal: ${p.meta_principal || '—'}`);
  return `<perfil origen="${p.origen}" version="1">\n${l.join('\n')}\n</perfil>`;
}

export function referenciasATexto(refs: Referencia[]): string {
  return `<referencias version="${REFERENCIAS_VERSION}">\n${refs.map((r) => `${r.id} ${r.texto} (${r.fuente})${r.verificar ? ' — verificar: ' + r.verificar : ''}`).join('\n')}\n</referencias>`;
}

// ---------------------------------------------------------------------------
// [C] Indicadores en texto: cada cifra con su ID
// ---------------------------------------------------------------------------
const $ = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : formatMonto(Math.round(v), 'COP', 'auto'));
const pct = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : (v * 100).toFixed(1).replace('.', ',') + ' %');
const dec = (v: number | null | undefined, d = 1) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toFixed(d).replace('.', ','));
const fila = (c: (string | number)[]) => `| ${c.join(' | ')} |`;

export function indicadoresATexto(ind: Indicadores, doc: DocumentoExport): string {
  const F = doc.resumen.foto;
  const o: string[] = [];
  o.push(`<indicadores corte="${ind.corte}" desde="${ind.inicio_ventana}" dias_obs="${ind.dias_obs}" meses_cerrados="${ind.meses_cerrados.length}">`);
  o.push('| ID | Indicador | Valor |', '|---|---|---|');
  o.push(fila(['Q', 'Calidad', ind.calidad.length ? ind.calidad.map((q) => q === 'CALIDAD_POCOS_DIAS' ? `${q} (${ind.dias_obs} días)` : q === 'CALIDAD_SUBREGISTRO' ? `${q} (${dec(doc.movimientos.filter((f) => f.tipo === 'gasto' && f.dia >= ind.inicio_ventana).length / ind.dias_obs, 2)} gastos por día)` : q).join(' · ') : 'Sin alertas']));
  o.push(fila(['F01', 'Disponible (cuentas que no son tarjeta − apartado en metas)', $(F.disponible)]));
  o.push(fila(['F02', 'En tus cuentas', $(F.en_cuentas)]));
  o.push(fila(['F03', 'Apartado en metas', $(F.apartado_metas)]));
  o.push(fila(['F04', 'Debes', $(F.debes)]));
  o.push(fila(['F05', 'Te deben', $(F.te_deben)]));
  o.push(fila(['F06', 'Patrimonio (cuentas + te deben − debes)', $(F.patrimonio)]));
  o.push(fila(['I01', `Ingreso mensual de referencia${ind.I01.estimado ? ' (ESTIMADO: mes en curso, sin meses cerrados)' : ` (promedio de ${ind.meses_cerrados.length} meses cerrados)`}`, $(ind.I01.valor)]));
  o.push(fila(['I01b', 'Ingreso semanal', $(ind.I01b)]));
  o.push(fila(['I02', 'Ingreso base conservador (peor mes)', $(ind.I02)]));
  o.push(fila(['I03', 'Variación del ingreso (CV)', ind.I03 ? `${dec(ind.I03.cv, 2)}${ind.I03.irregular ? ' · IRREGULAR' : ' · estable'}` : '— (menos de 3 meses cerrados)']));
  o.push(fila(['I04', 'Gasto mensual de referencia', $(ind.I04)]));
  o.push(fila(['I05', 'Gasto diario promedio', $(ind.I05)]));
  o.push(fila(['I06', 'Margen mensual · tasa de ahorro', `${$(ind.I06.margen)} · ${pct(ind.I06.tasa_ahorro)}`]));
  o.push(fila(['I08', 'Tendencia del gasto por mes', ind.I08 ? `${$(ind.I08.pendiente)} por mes (${pct(ind.I08.pct)})` : '— (menos de 3 meses cerrados)']));
  o.push(fila(['I11', 'Gasto en sábado y domingo', pct(ind.I11.pct_fin_de_semana)]));
  o.push(fila(['I13', 'Meses de colchón (F01 / I04)', `${dec(ind.I13.meses)} · objetivos: 1 mes ${$(ind.I13.objetivos[0].monto)} (faltan ${$(ind.I13.objetivos[0].falta)}), 3 meses ${$(ind.I13.objetivos[1].monto)} (faltan ${$(ind.I13.objetivos[1].falta)}), 6 meses ${$(ind.I13.objetivos[2].monto)} (faltan ${$(ind.I13.objetivos[2].falta)})`]));
  o.push(fila(['I16', 'Tarjetas: saldo · costo de referencia al mes con la tasa máxima legal R02 (no es su tasa real)', ind.I16 ? `${$(ind.I16.saldo)} · ${$(ind.I16.costo_ref_mensual)} (${pct(ind.I16.tasa_mensual)} al mes)` : '— (sin saldo en tarjetas)']));
  o.push(fila(['I17', 'Te deben · % del patrimonio · días desde el préstamo más antiguo', ind.I17 ? `${$(ind.I17.te_deben)} · ${pct(ind.I17.pct_patrimonio)} · ${ind.I17.dias_desde_el_mas_antiguo ?? '—'}` : '—']));
  o.push(fila(['I18', 'Dólares: saldo · en COP · % de tus cuentas · si la TRM se mueve 10 %', ind.I18 ? `US$${dec(ind.I18.saldo_usd, 2)} · ${$(ind.I18.valor_cop)} · ${pct(ind.I18.pct_cuentas)} · ±${$(ind.I18.sensibilidad_10)}` : '— (sin cuentas en USD)']));
  o.push('');

  o.push('I07 Gasto por categoría', fila(['Categoría', 'Clase', 'Mensual', '% de lo que entra', '% del gasto', 'Nº', 'Ticket', 'Barra']), '|---|---|---|---|---|---|---|---|');
  if (!ind.I07.length) o.push('| — | — | — | — | — | — | — | — |');
  ind.I07.forEach((c) => o.push(fila([c.categoria, c.clase, $(c.mensual), pct(c.pct_ingreso), pct(c.pct_gasto), c.movimientos, $(c.ticket), c.barra || '·'])));
  o.push('');

  o.push(`I09 Gastos hormiga (compras de ${$(ind.I09.umbral)} o menos en categorías opcionales o mixtas) · total ${$(ind.I09.total_mensual)} al mes · ${$(ind.I09.total_anual)} al año · ${pct(ind.I04 > 0 ? ind.I09.total_mensual / ind.I04 : null)} de tu gasto mensual`,
    fila(['Grupo', 'Nº', 'Por semana', 'Mensual', 'Anual']), '|---|---|---|---|---|');
  if (!ind.I09.grupos.length) o.push('| — | — | — | — | — |');
  ind.I09.grupos.slice(0, 15).forEach((g) => o.push(fila([g.grupo, g.movimientos, dec(g.por_semana, 2), $(g.mensual), $(g.anual)])));
  o.push('');

  o.push('I10 Top de detalles (todos los gastos)', fila(['Grupo', 'Categoría', 'Nº', 'Mensual']), '|---|---|---|---|');
  ind.I10.forEach((g) => o.push(fila([g.grupo, g.categoria, g.movimientos, $(g.mensual)])));
  o.push('');

  o.push(`I12 Recurrentes${ind.I12.length ? '' : ': — (ninguno detectado o menos de 2 meses cerrados)'}`);
  ind.I12.forEach((r) => o.push(`- ${r.grupo} (${r.categoria}): ${$(r.mensual)} al mes, visto en ${r.meses} meses`));
  o.push('');

  o.push(`I14 Metas${ind.I14.length ? '' : ': — (sin metas activas)'}`);
  ind.I14.forEach((m) => o.push(`- "${m.nombre}": objetivo ${$(m.objetivo)} · llevas ${$(m.actual)} · falta ${$(m.falta)} · aporte_ref ${$(m.aporte_ref)} al mes · ${m.fecha_limite ? `requerido ${$(m.requerido)} al mes (${m.meses_hasta_limite} meses hasta ${m.fecha_limite})${m.requerido !== null && m.requerido > m.aporte_ref ? ` · te faltan ${$(m.requerido - m.aporte_ref)} al mes sobre lo que ya apartas` : ''}` : 'sin fecha límite'} · ${m.meses_estimados !== null ? `${m.meses_estimados} meses al ritmo actual (fecha estimada ${m.fecha_estimada})` : 'sin fecha estimada'} · estado ${m.estado.toUpperCase()}`));
  o.push('');

  o.push(`I15 Deudas${ind.I15.length ? '' : ': — (sin deudas activas)'}`);
  ind.I15.forEach((d) => o.push(`- ${d.alias} (${d.tipo === 'por_pagar' ? 'le debes' : 'te debe'}): pendiente ${$(d.pendiente_cop)} · ${!d.vence ? 'sin fecha' : d.dias_al_vencimiento! < 0 ? `venció el ${d.vence} (hace ${-d.dias_al_vencimiento!} días)` : `vence ${d.vence} (en ${d.dias_al_vencimiento} días)`} · abono_ref ${$(d.abono_ref)} al mes · ${d.meses_para_saldar !== null ? `${d.meses_para_saldar} meses para saldar` : 'sin abonos recientes'} · alerta ${d.alerta || 'ninguna'}`));
  o.push('');

  o.push(`Palancas de ahorro${ind.P.length ? '' : ': — (no hay gastos recortables registrados)'}`);
  ind.P.forEach((p) => o.push(`${p.id} ${p.nombre} (${p.tipo === 'habito' ? 'hábito' : p.tipo}, −${Math.round(p.porcentaje * 100)} %${p.nota ? ', ' + p.nota : ''}): ${$(p.ahorro_mensual)} al mes · ${$(p.a3)} en 3 meses · ${$(p.a6)} en 6 meses · ${$(p.a12)} en 12 meses · meta: que "${p.nombre}" quede en ${$(p.base_mensual - p.ahorro_mensual)} al mes o menos (hoy ${$(p.base_mensual)})`));
  o.push(`Plan sugerido = ${ind.plan.ids.join(' + ') || 'ninguno'} = ${$(ind.plan.mensual)} al mes`, '');

  o.push('I19 Patrimonio proyectado', fila(['Escenario', '3 m', '6 m', '12 m', 'Supuesto']), '|---|---|---|---|---|');
  ind.I19.escenarios.forEach((e) => o.push(fila([`${e.id} ${e.nombre}`, $(e.m3), $(e.m6), $(e.m12), e.supuesto])));
  if (!ind.I19.escenarios.some((e) => e.id === 'E2')) o.push(fila(['E2 Si sigue la tendencia', 'No disponible (menos de 3 meses cerrados)', '', '', '']));
  o.push('</indicadores>');
  return o.join('\n');
}

// ---------------------------------------------------------------------------
// Paquete completo
// ---------------------------------------------------------------------------
export interface OpcionesPaquete {
  perfil?: Perfil | null;     // del onboarding; si falta, se deduce
  foco?: Foco;
  anonimizar?: boolean;       // por defecto SÍ en el paquete para IA (decisión 6 recomendada)
  referencias?: Referencia[];
  corte?: string;
}

export interface Paquete {
  texto: string;
  tokens: number;
  compacto: boolean;
  version: string;
  indicadores: Indicadores;
  graficos: Indicadores['graficos'];  // ya anonimizados: los usa también "Descargar mis gráficas"
  perfil: Perfil;
}

export function armarPaquete(doc: DocumentoExport, op: OpcionesPaquete = {}): Paquete {
  const anonimizar = op.anonimizar !== false;
  const ind = calcularIndicadores(doc, op.referencias || REFERENCIAS, op.corte);
  const alias = aliasTerceros(doc);
  const limpiar = (t: string) => (anonimizar ? anonimizarTexto(t, alias) : t);

  // ¿La muestra de movimientos queda recortada?
  const enMuestra = doc.movimientos.filter((f) => diasEntre(f.dia, doc.resumen.hasta) < MUESTRA_IA.dias).length;
  if (Math.min(enMuestra, MUESTRA_IA.filas) < doc.movimientos.length && !ind.calidad.includes('MUESTRA_RECORTADA')) ind.calidad.push('MUESTRA_RECORTADA');

  const perfil = op.perfil || inferirPerfil(doc, ind);
  const graficos = JSON.parse(limpiar(JSON.stringify(ind.graficos))) as Indicadores['graficos'];

  const armar = (compacto: boolean) => {
    const documento = aMarkdown(doc, { modo: 'ia', anonimizar, secciones: compacto ? [1, 2, 3, 4, 5, 6, 8, 10, 11] : undefined });
    const datos = [
      '<datos>',
      limpiar(indicadoresATexto(ind, doc)),
      '',
      `<graficos_json>${JSON.stringify(graficos)}</graficos_json>`,
      '',
      '<documento>',
      compacto ? '(Modo compacto: el paquete era muy grande y se quitó la muestra de movimientos. Los indicadores usan todos.)\n' : '',
      documento.trim(),
      '</documento>',
      '</datos>',
    ].join('\n');
    return [LINEA_ENTRADA, bloqueInstrucciones(), limpiar(perfilATexto(perfil)), referenciasATexto(ind.referencias), datos, solicitud(op.foco || 'todo', ind.corte)].join('\n\n') + '\n';
  };

  let texto = armar(false);
  let compacto = false;
  if (estimarTokens(texto) > TOKENS_TOPE) { texto = armar(true); compacto = true; }
  return { texto, tokens: estimarTokens(texto), compacto, version: VERSION_AGENTE, indicadores: ind, graficos, perfil };
}

/** "Descargar mis gráficas" sin IA: la misma plantilla con los datos ya puestos (decisión 9 recomendada). */
export function htmlGraficas(paquete: Paquete, claves: string[], plantilla: string): string {
  return plantilla
    .replace(/^const DATOS = .*;$/m, `const DATOS = ${JSON.stringify(paquete.graficos).replace(/</g, '\\u003c')};`)
    .replace(/^const CLAVES = .*;$/m, `const CLAVES = ${JSON.stringify(claves).replace(/</g, '\\u003c')};`);
}

/** Las 3 frases de "Descargar mis gráficas" sin IA: solo cifras calculadas por Lumi, con su código. */
export function clavesLumi(p: Paquete): string[] {
  const i = p.indicadores;
  const c: string[] = [];
  c.push(i.I06.margen >= 0
    ? `Te queda un margen de ${$(i.I06.margen)} al mes [I06]: entra ${$(i.I01.valor)} [I01] y sale ${$(i.I04)} [I04].`
    : `Sale más de lo que entra: ${$(i.I06.margen)} al mes [I06].`);
  const urgente = i.I15.find((d) => d.alerta && d.tipo === 'por_pagar');
  const meta = i.I14.find((m) => m.estado === 'atrasada');
  if (urgente) c.push(`Tu deuda con ${urgente.alias} ${urgente.alerta === 'VENCIDA' ? 'ya venció' : `vence en ${urgente.dias_al_vencimiento} días`}: pendiente ${$(urgente.pendiente_cop)} [I15].`);
  else if (meta) c.push(`Tu meta "${meta.nombre}" va atrasada: necesitas ${$(meta.requerido)} al mes [I14].`);
  else c.push(`Tu colchón alcanza para ${dec(i.I13.meses)} meses de gasto [I13].`);
  const p1 = i.P[0];
  c.push(p1 ? `Tu mayor palanca: ${p1.nombre}, ${$(p1.ahorro_mensual)} al mes y ${$(p1.a12)} en un año [${p1.id}].` : `Registra tus gastos unas semanas para encontrar dónde ahorrar.`);
  return c;
}
