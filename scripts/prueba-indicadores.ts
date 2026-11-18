// Iteración 2 · F3 · Prueba de los indicadores del agente analista.
// T1 = ejemplo verificado a mano por la mesa (§4). T2 = perfil sintético grande (8 meses, ~900 movimientos, USD, tarjeta).
// Ejecutar:  npx tsx scripts/prueba-indicadores.ts
import { calcularIndicadores, normalizarDetalle, verificarCoherencia } from '../src/ia/indicadores';
import { claseCategoria, referenciasVigentes } from '../src/ia/referencias';
import type { DocumentoExport, FilaMovimiento } from '../src/ia/tipos';
import { T1 } from './datos-prueba-ia/t1-estudiante';

let ok = 0, mal = 0;
const caso = (nombre: string, cond: boolean, detalle = '') => { if (cond) ok++; else { mal++; console.log('  ✗', nombre, detalle); } };
const cerca = (a: number | null | undefined, b: number, tol = 1) => a !== null && a !== undefined && Math.abs(a - b) <= tol;

// ---------------------------------------------------------------- T1
const i = calcularIndicadores(T1);
caso('T1 dias_obs = 18', i.dias_obs === 18, String(i.dias_obs));
caso('T1 sin meses cerrados', i.meses_cerrados.length === 0);
caso('T1 I01 = 400.000 ESTIMADO', i.I01.valor === 400000 && i.I01.estimado);
caso('T1 I01b = 92.379', cerca(i.I01b, 92379));
caso('T1 I02 = I01 (n < 2)', i.I02 === 400000);
caso('T1 I03 null (n < 3)', i.I03 === null);
caso('T1 I04 = 126.667', cerca(i.I04, 126667), String(i.I04));
caso('T1 I05 = 4.167', cerca(i.I05, 4167));
caso('T1 I06 margen 273.333 · 68,3 %', cerca(i.I06.margen, 273333) && cerca((i.I06.tasa_ahorro || 0) * 1000, 683, 1));
const com = i.I07.find((c) => c.categoria === 'Comida y domicilios')!;
const tin = i.I07.find((c) => c.categoria === 'Tinto y antojos')!;
caso('T1 I07 Comida 101.333 · 25,3 % · 80 % · 2 · ticket 30.000 · mixta', cerca(com.mensual, 101333) && cerca(com.pct_ingreso! * 1000, 253, 1) && cerca(com.pct_gasto * 100, 80, 0.01) && com.movimientos === 2 && com.ticket === 30000 && com.clase === 'mixta' && com.barra.length === 10);
// La mesa escribió "██" (2); 10 × 25.333/101.333 = 2,5 y Math.round da 3. Se deja la regla de redondeo estándar.
caso('T1 I07 Tinto 25.333 · 20 % · ticket 5.000 · opcional · barra 3', cerca(tin.mensual, 25333) && cerca(tin.pct_gasto * 100, 20, 0.01) && tin.ticket === 5000 && tin.clase === 'opcional' && tin.barra.length === 3, tin.barra);
caso('T1 I08 null', i.I08 === null);
const tinto = i.I09.grupos.find((g) => g.grupo === 'tinto')!, emp = i.I09.grupos.find((g) => g.grupo === 'empanada')!;
caso('T1 I09 solo tinto y empanada (domicilios > $25.000 no son hormiga)', i.I09.grupos.length === 2);
caso('T1 I09 tinto 2 · 0,78/sem · 15.200/mes · 182.500/año', tinto.movimientos === 2 && cerca(tinto.por_semana * 100, 78, 1) && cerca(tinto.mensual, 15200) && cerca(tinto.anual, 182500));
caso('T1 I09 empanada 10.133/mes · 121.667/año', cerca(emp.mensual, 10133) && cerca(emp.anual, 121667));
caso('T1 I09 total anual 304.167', cerca(i.I09.total_anual, 304167));
caso('T1 I12 sin recurrentes (n < 2)', i.I12.length === 0);
caso('T1 I13 disponible 225.000 · 1,78 meses', i.I13.disponible === 225000 && cerca(i.I13.meses! * 100, 178, 1));
const meta = i.I14[0];
caso('T1 I14 falta 1.200.000 · aporte 100.000 · requerido 171.429 · 12 meses · 2027-11 · atrasada',
  meta.falta === 1200000 && meta.aporte_ref === 100000 && meta.meses_hasta_limite === 7 && cerca(meta.requerido, 171429) && meta.meses_estimados === 12 && meta.fecha_estimada === '2027-11' && meta.estado === 'atrasada', JSON.stringify(meta));
const deu = i.I15[0];
caso('T1 I15 Persona A · 150.000 · 27 días · abono 50.000 · 3 meses · VENCE_30',
  deu.alias === 'Persona A' && deu.pendiente_cop === 150000 && deu.dias_al_vencimiento === 27 && deu.abono_ref === 50000 && deu.meses_para_saldar === 3 && deu.alerta === 'VENCE_30', JSON.stringify(deu));
caso('T1 I16, I17, I18 no aplican', i.I16 === null && i.I17 === null && i.I18 === null);
caso('T1 palancas P01 Comida 30.400 · P02 tinto 7.600 · P03 empanada 5.067',
  i.P.length === 3 && i.P[0].nombre === 'Comida y domicilios' && cerca(i.P[0].ahorro_mensual, 30400) && cerca(i.P[0].a12, 364800)
  && i.P[1].nombre === 'tinto' && cerca(i.P[1].ahorro_mensual, 7600) && i.P[2].nombre === 'empanada' && cerca(i.P[2].ahorro_mensual, 5067) && cerca(i.P[2].a12, 60800), JSON.stringify(i.P.map((p) => [p.nombre, p.ahorro_mensual])));
caso('T1 plan = P01 + P02 + P03 = 43.067', i.plan.ids.join() === 'P01,P02,P03' && cerca(i.plan.mensual, 43067));
const e = Object.fromEntries(i.I19.escenarios.map((x) => [x.id, x]));
caso('T1 E1 995.000 · 1.815.000 · 3.455.000', e.E1.m3 === 995000 && e.E1.m6 === 1815000 && e.E1.m12 === 3455000, JSON.stringify(e.E1));
caso('T1 E2 no disponible', !e.E2);
caso('T1 E3 1.124.000 · 2.073.000 · 3.972.000', e.E3.m3 === 1124000 && e.E3.m6 === 2073000 && e.E3.m12 === 3972000, JSON.stringify(e.E3));
caso('T1 serie de 13 puntos y arranca en el patrimonio', e.E1.serie.length === 13 && e.E1.serie[0] === 175000);
caso('T1 calidad: pocos días y subregistro, sí hay ingresos', i.calidad.includes('CALIDAD_POCOS_DIAS') && i.calidad.includes('CALIDAD_SUBREGISTRO') && !i.calidad.includes('SIN_INGRESOS') && !i.calidad.includes('COHERENCIA_FALLA'));
const ids = i.graficos.graficos.map((g) => g.id).join();
caso('T1 gráficas G1–G6', ids === 'G1,G2,G3,G4,G5,G6', ids);
const g4 = i.graficos.graficos.find((g) => g.id === 'G4')!;
caso('T1 G4 = escenarios (E1 y E3)', g4.series.length === 2 && g4.series[1].valores[12] === 3972000);
const g6 = i.graficos.graficos.find((g) => g.id === 'G6')!;
caso('T1 G6 sin nombres de terceros', !JSON.stringify(g6).includes('Camilo') && g6.etiquetas.includes('Debes a Persona A'));
caso('T1 gráficas sin nombres de terceros', !JSON.stringify(i.graficos).includes('Camilo'));
caso('T1 G5 patrimonio de noviembre = 175.000', i.graficos.graficos.find((g) => g.id === 'G5')!.series[0].valores.at(-1) === 175000);
caso('T1 coherencia OK', verificarCoherencia(T1).ok);

// ---------------------------------------------------------------- reglas auxiliares
caso('normalizarDetalle: tildes, números y 2 palabras', normalizarDetalle('Café Juan Valdez 2x', 'X') === 'cafe juan');
caso('normalizarDetalle: vacío → categoría', normalizarDetalle('', 'Transporte') === 'transporte');
caso('normalizarDetalle: nota automática → categoría', normalizarDetalle('Gasto Comida', 'Comida') === 'comida' && normalizarDetalle('Aporte a meta: Viaje', null) === 'sin categoría' && normalizarDetalle('gasto en tinto', 'Antojos') === 'gasto tinto');
caso('clase: "Otros gastos" es mixta (no esencial por "gas"), "Gas natural" sí', claseCategoria('Otros gastos') === 'mixta' && claseCategoria('Gas natural') === 'esencial' && claseCategoria('Servicios públicos') === 'esencial' && claseCategoria('Tinto y antojos') === 'opcional');
caso('clase: Vivienda y Salud esenciales', claseCategoria('Vivienda') === 'esencial' && claseCategoria('Salud') === 'esencial');
caso('normalizarDetalle: sin palabras vacías', normalizarDetalle('pan y café', 'X') === 'pan cafe' && normalizarDetalle('almuerzo de la casa', 'X') === 'almuerzo casa');
caso('normalizarDetalle: [id] no cuenta', normalizarDetalle('[id] taxi', 'X') === 'taxi');
caso('clase: Arriendo esencial, Netflix opcional, Comida mixta', claseCategoria('Arriendo') === 'esencial' && claseCategoria('Suscripciones') === 'opcional' && claseCategoria('Comida') === 'mixta');
caso('referencias: la usura de noviembre se omite en febrero (> 60 días)', !referenciasVigentes('2027-02-15').some((r) => r.id === 'R02') && referenciasVigentes('2026-11-18').some((r) => r.id === 'R02'));
const malo: DocumentoExport = { ...T1, resumen: { ...T1.resumen, totales: { ...T1.resumen.totales, gastos: 99999 } } };
caso('coherencia: detecta totales que no cuadran', !verificarCoherencia(malo).ok && calcularIndicadores(malo).calidad.includes('COHERENCIA_FALLA'));

// ---------------------------------------------------------------- T2 sintético (independiente con USD y tarjeta)
import { t2 } from './datos-prueba-ia/t2-freelancer';
const j = calcularIndicadores(t2());
caso('T2 ventana: 6 meses cerrados (may–oct)', j.meses_cerrados.join() === '2026-05,2026-06,2026-07,2026-08,2026-09,2026-10', j.meses_cerrados.join());
const ing6 = [1200000, 4500000, 900000, 3800000, 2500000, 2100000];
caso('T2 I01 = promedio de 6 meses cerrados', cerca(j.I01.valor, ing6.reduce((a, b) => a + b) / 6) && !j.I01.estimado);
caso('T2 I02 = peor mes (900.000)', j.I02 === 900000);
caso('T2 I03 irregular (CV > 0,25)', !!j.I03 && j.I03.irregular && j.I03.cv > 0.25);
caso('T2 I08 pendiente +100.000/mes', !!j.I08 && cerca(j.I08.pendiente, 100000, 0.01), JSON.stringify(j.I08));
caso('T2 E2 existe y queda por debajo de E1', (() => { const e1 = j.I19.escenarios.find((x) => x.id === 'E1')!, e2 = j.I19.escenarios.find((x) => x.id === 'E2'); return !!e2 && e2.m12 < e1.m12; })());
caso('T2 I12 detecta Netflix (38.900) y arriendo como recurrentes', j.I12.some((r) => r.grupo === 'netflix plan' && r.mensual === 38900) && j.I12.some((r) => r.grupo === 'arriendo'), JSON.stringify(j.I12));
caso('T2 el tinto diario NO es recurrente (100 por mes)', !j.I12.some((r) => r.grupo === 'tinto'), JSON.stringify(j.I12.map((r) => r.grupo)));
// Todo el tinto es hormiga (≤ $25.000, opcional): va como palanca de HÁBITO y no se repite como categoría (sin doble conteo)
caso('T2 tinto = palanca de hábito, no de categoría', j.P.some((p) => p.tipo === 'habito' && p.nombre === 'tinto') && !j.P.some((p) => p.tipo === 'categoria' && p.nombre === 'Tinto y antojos'));
caso('T2 recurrentes fuera del plan', j.plan.ids.every((id) => j.P.find((p) => p.id === id)!.tipo !== 'recurrente'));
caso('T2 arriendo esencial: no es palanca de categoría', !j.P.some((p) => p.tipo === 'categoria' && p.nombre === 'Arriendo'));
caso('T2 I16 tarjeta 1.800.000 · costo de referencia ≈ 2,10 %/mes', !!j.I16 && j.I16.saldo === 1800000 && cerca(j.I16.tasa_mensual * 10000, 210, 1), JSON.stringify(j.I16));
caso('T2 I17 te deben 1.000.000 · 31,3 % · 109 días', !!j.I17 && cerca(j.I17.pct_patrimonio! * 1000, 313, 1) && j.I17.dias_desde_el_mas_antiguo === 109, JSON.stringify(j.I17));
caso('T2 I18 USD 600 · sensibilidad 200.000', !!j.I18 && j.I18.saldo_usd === 600 && cerca(j.I18.sensibilidad_10, 200000));
caso('T2 sin banderas de pocos días ni subregistro', !j.calidad.includes('CALIDAD_POCOS_DIAS') && !j.calidad.includes('CALIDAD_SUBREGISTRO'), j.calidad.join());
caso('T2 coherencia OK con ~700 filas', j.coherencia.ok, j.coherencia.detalle);

// ---------------------------------------------------------------- vacío
const vacio: DocumentoExport = { resumen: { ...T1.resumen, foto: { disponible: 0, en_cuentas: 0, apartado_metas: 0, debes: 0, te_deben: 0, patrimonio: 0 }, totales: { movimientos: 0, ingresos: 0, gastos: 0, ajustes: 0, primer_dia: null, ultimo_dia: null }, metas: [], deudas: [], cuentas: [], meses: [] }, movimientos: [] };
const v = calcularIndicadores(vacio);
caso('Vacío: no falla, SIN_INGRESOS, sin NaN', v.calidad.includes('SIN_INGRESOS') && !JSON.stringify(v).includes('NaN') && !JSON.stringify(v).includes('null,"barra"'));

console.log(`\nprueba-indicadores: ${ok} OK, ${mal} fallas`);
if (mal) process.exit(1);
