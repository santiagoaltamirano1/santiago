import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFinanceStore } from '../../store/useFinanceStore';
import { useDictado } from '../../hooks/useDictado';
import { interpretarTexto, cerrarCaptura, hoyBogota, type MovimientoIA, type DudaIA, type ConfirmadoIA } from '../../services/ia';
import { normalizarDictado } from '../../utils/normalizarDictado';
import { detectarDuplicados } from '../../utils/duplicados';
import { formatMonto, formatEntrada, limpiarEntrada } from '../../utils/money';
import { convertir } from '../../utils/fx';
import type { Moneda } from '../../types';

// Fase 5 · Registro por voz (o texto) con IA.
// Dictar → (editar) → la IA ORGANIZA → revisar o "Enviar de una vez" → se guarda por el canal normal
// (reglas, 5 s para deshacer, servidor) con origen 'ia_voz' y la captura enlazada. La IA nunca guarda sola:
// "Enviar de una vez" solo guarda lo que no tiene dudas ni parece repetido; lo demás se pregunta.

type Item = MovimientoIA & {
  key: string;
  idx: number;                // posición en la respuesta de la IA (para cerrar la captura con lo corregido)
  entrada: string;            // monto canónico editable
  incluir: boolean;
  duplicado: 'ya_anotado' | 'repetido_en_dictado' | null;
  montoConfirmado: boolean;   // la duda de monto se resuelve tocando "Sí, es…" o editando
  error?: string;
  guardado?: boolean;
};

const NOMBRE: Record<MovimientoIA['tipo'], string> = {
  gasto: 'Gasto', ingreso: 'Ingreso', transferencia: 'Transferencia', aporte_meta: 'Apartar en meta',
  retiro_meta: 'Sacar de meta', abono_capital: 'Abono a deuda', prestamo_capital: 'Préstamo',
};
const COLOR: Record<MovimientoIA['tipo'], string> = {
  gasto: 'text-expense border-expense', ingreso: 'text-income border-income', transferencia: 'text-transfer border-transfer',
  aporte_meta: 'text-transfer border-transfer', retiro_meta: 'text-transfer border-transfer',
  abono_capital: 'text-transfer border-transfer', prestamo_capital: 'text-transfer border-transfer',
};
const usaCuenta = (t: MovimientoIA['tipo']) => t !== 'aporte_meta' && t !== 'retiro_meta';
const usaCategoria = (t: MovimientoIA['tipo']) => t === 'gasto' || t === 'ingreso';

export const CapturaVoz: React.FC<{ onCerrar: () => void }> = ({ onCerrar }) => {
  const { cuentas, categorias, metas, deudas, transacciones, calculator, fx, addTransaccion, privacyHidden } = useFinanceStore();
  const [texto, setTexto] = useState('');
  const [fase, setFase] = useState<'dictar' | 'procesando' | 'revisar'>('dictar');
  const [error, setError] = useState<string | null>(null);
  const [aclaracion, setAclaracion] = useState<string | null>(null);
  const [capturaId, setCapturaId] = useState<string>('');
  const [items, setItems] = useState<Item[]>([]);
  const [resumen, setResumen] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  // F6: ¿la persona habló o escribió? y qué guardó al final de cada movimiento de la IA
  const usoVoz = useRef(false);
  const totalIA = useRef(0);
  const confirmados = useRef(new Map<number, ConfirmadoIA>());
  const capturaRef = useRef('');
  const cerrada = useRef(false);
  const cerrarLaCaptura = () => {
    if (cerrada.current || !capturaRef.current || totalIA.current === 0) return;
    cerrada.current = true;
    const lista: ConfirmadoIA[] = Array.from({ length: totalIA.current }, (_, i) => confirmados.current.get(i) ?? { i, incluido: false });
    void cerrarCaptura(capturaRef.current, lista);
  };

  const dictado = useDictado((final) => {
    const limpio = final.trim();
    if (!limpio) return;
    usoVoz.current = true;
    setTexto((t) => (t ? t.replace(/\s+$/, '') + ' ' : '') + limpio);
  });

  // Empieza a escuchar al abrir (la persona tocó el micrófono). Escape cierra.
  useEffect(() => {
    if (dictado.soportado) dictado.empezar(); else areaRef.current?.focus();
    // [U8] En la revisión, Escape no descarta lo que ya organizó la IA (se cierra con ✕ o Volver)
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape' && faseRef.current !== 'revisar') cerrar(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // [U7] Si la hoja se cierra mientras la IA procesa, no se guarda nada al volver la respuesta
  const viva = useRef(true);
  const faseRef = useRef(fase);
  faseRef.current = fase;
  const cerrar = () => { viva.current = false; dictado.detener(); cerrarLaCaptura(); onCerrar(); };
  const escuchando = dictado.estado === 'escuchando';
  const hoy = hoyBogota();
  const cuentaDefecto = cuentas.some((c) => c.id === calculator.selectedAccountId) ? calculator.selectedAccountId : cuentas[0]?.id;

  // ---------- Qué le falta a un movimiento para poder guardarse ----------
  const pendientes = (it: Item): { campo: DudaIA['campo']; texto: string }[] => {
    const p: { campo: DudaIA['campo']; texto: string }[] = [];
    if (!(parseFloat(it.entrada) > 0)) p.push({ campo: 'monto', texto: '¿Cuánto fue?' });
    else if (!it.montoConfirmado && it.dudas.some((d) => d.campo === 'monto')) p.push({ campo: 'monto', texto: it.dudas.find((d) => d.campo === 'monto')!.pregunta });
    if (usaCuenta(it.tipo) && !it.cuenta_id) p.push({ campo: 'cuenta', texto: 'Elige la cuenta.' });
    if (it.tipo === 'transferencia' && (!it.destino_cuenta_id || it.destino_cuenta_id === it.cuenta_id)) p.push({ campo: 'destino', texto: 'Elige la cuenta que recibe.' });
    if (usaCategoria(it.tipo) && !categorias.some((c) => c.id === it.categoria_id && c.tipo === it.tipo)) p.push({ campo: 'categoria', texto: it.tipo === 'gasto' ? '¿En qué se fue?' : '¿De dónde vino?' });
    if ((it.tipo === 'aporte_meta' || it.tipo === 'retiro_meta') && !it.meta_id) p.push({ campo: 'meta', texto: '¿Cuál meta?' });
    if ((it.tipo === 'abono_capital' || it.tipo === 'prestamo_capital') && !it.deuda_id) p.push({ campo: 'deuda', texto: '¿Cuál deuda?' });
    return p;
  };

  const monedaDe = (it: Item): Moneda => (usaCuenta(it.tipo) ? cuentas.find((c) => c.id === it.cuenta_id)?.moneda || 'COP' : 'COP');

  /** Guarda un movimiento por el canal normal. Devuelve el mensaje de error o null.
   *  `id` = captura; se pasa explícito justo después de recibir la respuesta (el estado aún no se actualizó). */
  const guardar = (it: Item, id: string = capturaId): string | null => {
    const destino = monedaDe(it);
    let monto = parseFloat(it.entrada) || 0;
    if (it.moneda !== destino) monto = convertir(monto, it.moneda, destino, fx); // "20 dólares" desde una cuenta en pesos
    if (destino === 'COP') monto = Math.round(monto); else monto = Math.round(monto * 100) / 100;
    const fecha = !it.fecha || it.fecha === hoy ? new Date().toISOString() : new Date(`${it.fecha}T12:00:00-05:00`).toISOString();
    const r = addTransaccion({
      tipo: it.tipo, monto, fecha,
      cuenta_id: usaCuenta(it.tipo) ? it.cuenta_id || '' : '',
      destino_cuenta_id: it.tipo === 'transferencia' ? it.destino_cuenta_id || undefined : undefined,
      categoria_id: usaCategoria(it.tipo) ? it.categoria_id || '' : '',
      meta_id: it.meta_id || undefined,
      deuda_id: it.deuda_id || undefined,
      notas: it.descripcion,
      origen: 'ia_voz',
      captura_id: id || undefined,
    });
    if (!r.error) confirmados.current.set(it.idx, {
      i: it.idx, incluido: true, tipo: it.tipo, monto, cuenta_id: usaCuenta(it.tipo) ? it.cuenta_id : null,
      destino_cuenta_id: it.tipo === 'transferencia' ? it.destino_cuenta_id : null, categoria_id: usaCategoria(it.tipo) ? it.categoria_id : null,
      meta_id: it.meta_id, deuda_id: it.deuda_id, fecha: !it.fecha || it.fecha === hoy ? null : it.fecha,
    });
    return r.error ? r.error.mensaje : null;
  };

  // ---------- Organizar con IA ----------
  const organizar = async (modo: 'revisar' | 'directo') => {
    dictado.detener();
    const t = texto.trim();
    if (t.length < 3) { setError('Dime o escribe qué quieres anotar.'); areaRef.current?.focus(); return; }
    setError(null); setAclaracion(null); setResumen(null);
    setFase('procesando');
    try {
      // F6: el texto se normaliza ("dos palos" → "2 palos"); lo que se dijo tal cual viaja aparte
      const n = normalizarDictado(t);
      const r = await interpretarTexto(n.texto, cuentaDefecto, { texto_dictado: n.cambio ? t : undefined, transcriptor: usoVoz.current ? 'web_speech' : 'teclado' });
      if (!viva.current) return;
      setCapturaId(r.captura_id);
      capturaRef.current = r.captura_id; totalIA.current = r.movimientos.length; confirmados.current = new Map(); cerrada.current = false;
      const dups = detectarDuplicados(
        // El monto dicho se compara en la moneda de la cuenta ("20 dólares" desde una cuenta en pesos)
        r.movimientos.map((m) => ({ tipo: m.tipo, monto: Math.round(convertir(m.monto, m.moneda, (usaCuenta(m.tipo) ? cuentas.find((c) => c.id === m.cuenta_id)?.moneda : 'COP') || 'COP', fx) * 100) / 100, cuenta_id: usaCuenta(m.tipo) ? m.cuenta_id : null, meta_id: m.meta_id, deuda_id: m.deuda_id, fecha: m.fecha || hoy })),
        transacciones,
      );
      let lista: Item[] = r.movimientos.map((m, i) => ({
        ...m, key: `${r.captura_id}-${i}`, idx: i, entrada: String(m.monto || ''), incluir: !dups[i], duplicado: dups[i], montoConfirmado: false,
      }));
      if (lista.length === 0) {
        setAclaracion(r.aclaracion || 'No encontré movimientos en lo que dijiste. ¿Lo dices de otra forma?');
        setFase('dictar');
        return;
      }
      if (modo === 'directo') {
        // Solo lo que está claro: sin dudas, confianza alta y que no parezca repetido.
        let guardados = 0;
        lista = lista.map((it) => {
          const listo = it.incluir && it.confianza >= 0.8 && it.dudas.length === 0 && pendientes(it).length === 0;
          if (!listo) return it;
          const err = guardar(it, r.captura_id);
          if (err) return { ...it, error: err };
          guardados++;
          return { ...it, guardado: true };
        });
        const faltan = lista.filter((it) => !it.guardado);
        if (faltan.length === 0) { cerrarLaCaptura(); onCerrar(); return; }
        setResumen(guardados > 0 ? `Anoté ${guardados}. Revisa ${faltan.length === 1 ? 'este' : `estos ${faltan.length}`}:` : null);
        lista = faltan;
      }
      setItems(lista);
      setFase('revisar');
    } catch (e: any) {
      setError(e?.message || 'No pudimos organizar el texto. Intenta otra vez o anótalo a mano.');
      setFase('dictar');
    }
  };
  // ---------- Revisión ----------
  const cambiar = (key: string, cambios: Partial<Item>) => setItems((l) => l.map((it) => (it.key === key ? { ...it, ...cambios, error: undefined } : it)));
  const incluidos = items.filter((it) => it.incluir && !it.guardado);
  const conPendientes = incluidos.filter((it) => pendientes(it).length > 0);

  const guardarRevisados = () => {
    if (incluidos.length === 0) { cerrarLaCaptura(); onCerrar(); return; }
    if (conPendientes.length > 0) {
      setError(`Responde ${conPendientes.length === 1 ? 'la pregunta marcada' : 'las preguntas marcadas'} antes de anotar.`);
      return;
    }
    setError(null);
    const nuevos = items.map((it) => {
      if (!it.incluir || it.guardado) return it;
      const err = guardar(it);
      return err ? { ...it, error: err } : { ...it, guardado: true };
    });
    const conError = nuevos.filter((it) => it.incluir && !it.guardado);
    if (conError.length === 0) { cerrarLaCaptura(); onCerrar(); return; }
    setItems(nuevos.filter((it) => !it.guardado));
    setResumen(`No se pudieron anotar ${conError.length}. Revisa el motivo en cada uno.`);
  };

  const textoBoton = incluidos.length === 0 ? 'Cerrar' : `Anotar ${incluidos.length} movimiento${incluidos.length === 1 ? '' : 's'}`;
  const selectCls = 'w-full bg-[#f5f5f5] text-[#0a0a0a] text-sm px-3 min-h-[44px] rounded-[14px] border border-field';
  const labelCls = 'text-xs font-medium text-[#737373] block mb-1';

  const estadoTexto = useMemo(() => {
    switch (dictado.estado) {
      case 'escuchando': return 'Te escucho… di todo lo que quieras anotar.';
      case 'permiso_negado': return 'El navegador no dejó usar el micrófono. Actívalo en los permisos del sitio o escribe aquí.';
      case 'no_soportado': return 'Este navegador no reconoce voz (prueba Chrome o Edge). Puedes escribirlo aquí.';
      case 'error': return 'Se cortó el micrófono. Toca el micrófono para seguir o escribe.';
      default: return texto ? 'Puedes corregir el texto antes de enviarlo.' : 'Toca el micrófono y habla, o escribe.';
    }
  }, [dictado.estado, texto]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="voz-titulo">
      <button type="button" aria-label="Cerrar" tabIndex={-1} onClick={() => { if (fase !== 'revisar') cerrar(); }} className="absolute inset-0 bg-black/40 lumi-aparecer" />
      <div className="relative w-full max-w-md max-h-[92vh] overflow-y-auto bg-white rounded-t-[28px] sm:rounded-[28px] p-5 pb-6 shadow-2xl lumi-subir">
        <div className="w-10 h-1 rounded-full bg-[#e5e5e5] mx-auto mb-3 sm:hidden" aria-hidden="true" />
        <div className="flex items-center justify-between mb-3">
          <h2 id="voz-titulo" className="text-base font-semibold text-[#0a0a0a]">
            {fase === 'revisar' ? 'Revisa lo que entendí' : 'Anotar hablando'}
          </h2>
          <button type="button" onClick={cerrar} className="w-11 h-11 rounded-[14px] flex items-center justify-center text-[#737373] hover:bg-[#f5f5f5]" aria-label="Cerrar">
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
          </button>
        </div>

        {fase !== 'revisar' && (
          <>
            {/* Micrófono con ondas mientras escucha */}
            <div className="flex flex-col items-center gap-2 py-2">
              <button
                type="button"
                onClick={() => (escuchando ? dictado.detener() : dictado.empezar())}
                disabled={!dictado.soportado || fase === 'procesando'}
                aria-pressed={escuchando}
                aria-label={escuchando ? 'Dejar de escuchar' : 'Hablar'}
                className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-colors disabled:opacity-40 ${escuchando ? 'bg-[#0a0a0a] text-[#fafafa]' : 'bg-[#f5f5f5] text-[#0a0a0a] border border-field'}`}
              >
                {escuchando && (
                  <>
                    <span className="lumi-onda absolute inset-0 rounded-full border-2 border-[#0a0a0a]" aria-hidden="true" />
                    <span className="lumi-onda lumi-onda-2 absolute inset-0 rounded-full border-2 border-[#0a0a0a]" aria-hidden="true" />
                  </>
                )}
                <span className="material-symbols-outlined text-[34px]" aria-hidden="true">
                  {dictado.estado === 'permiso_negado' || dictado.estado === 'no_soportado' ? 'mic_off' : escuchando ? 'graphic_eq' : 'mic'}
                </span>
              </button>
              <p role="status" className={`text-sm text-center ${dictado.estado === 'permiso_negado' || dictado.estado === 'error' ? 'text-alert' : 'text-[#737373]'}`}>
                {fase === 'procesando' ? 'Organizando tus movimientos…' : estadoTexto}
              </p>
            </div>

            <label htmlFor="voz-texto" className="sr-only">Lo que dijiste</label>
            <textarea
              id="voz-texto"
              ref={areaRef}
              value={texto}
              onChange={(e) => { setTexto(e.target.value); setError(null); }}
              rows={4}
              placeholder="Ej.: Hoy me gasté 25 mil en almuerzo, compré algo en la tienda por 8 mil y recibí 150 mil de un trabajo"
              className="w-full bg-[#f5f5f5] text-[#0a0a0a] text-base p-3 rounded-[18px] border border-field resize-none focus:bg-white"
              disabled={fase === 'procesando'}
            />
            {dictado.parcial && <p className="text-sm italic text-[#737373] mt-1" aria-hidden="true">{dictado.parcial}…</p>}
            {aclaracion && <p className="text-sm text-alert mt-2" role="status">{aclaracion}</p>}
            {error && <p className="text-sm text-ember mt-2" role="alert">{error}</p>}

            <div className="grid grid-cols-2 gap-2 mt-4">
              <button type="button" onClick={() => organizar('revisar')} disabled={fase === 'procesando'} className="min-h-[52px] rounded-[18px] text-sm font-semibold border border-field bg-white text-[#0a0a0a] disabled:opacity-50">
                Revisar antes
              </button>
              <button type="button" onClick={() => organizar('directo')} disabled={fase === 'procesando'} className="min-h-[52px] rounded-[18px] text-sm font-semibold bg-[#0a0a0a] text-[#fafafa] disabled:opacity-50 flex items-center justify-center gap-2">
                {fase === 'procesando' && <span className="lumi-girar w-4 h-4 border-2 border-white/40 border-t-white rounded-full" aria-hidden="true" />}
                Enviar de una vez
              </button>
            </div>
            <p className="text-xs text-[#737373] mt-2 text-center">
              "Enviar de una vez" anota lo que está claro y solo te pregunta lo dudoso. Cada movimiento se puede deshacer 5 s.
            </p>
          </>
        )}

        {fase === 'revisar' && (
          <div className="space-y-3">
            <p className="text-sm text-[#737373] bg-[#f5f5f5] rounded-[14px] p-3">“{texto.trim()}”</p>
            {resumen && <p className="text-sm font-medium text-[#0a0a0a]" role="status">{resumen}</p>}

            {items.map((it) => {
              const faltan = pendientes(it);
              const cats = categorias.filter((c) => c.tipo === it.tipo);
              const moneda = monedaDe(it);
              const cuentaNombre = cuentas.find((c) => c.id === it.cuenta_id)?.nombre;
              return (
                <div key={it.key} className={`rounded-[20px] border p-4 space-y-3 ${it.incluir ? 'border-[#e5e5e5] bg-white' : 'border-dashed border-[#e5e5e5] bg-[#fafafa] opacity-70'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${COLOR[it.tipo]}`}>{NOMBRE[it.tipo]}</span>
                    <label className="flex items-center gap-2 text-sm text-[#0a0a0a] min-h-[44px]">
                      <input type="checkbox" checked={it.incluir} onChange={(e) => cambiar(it.key, { incluir: e.target.checked })} className="w-5 h-5 accent-[#0a0a0a]" />
                      Anotar
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls} htmlFor={`m-${it.key}`}>Monto {it.moneda !== moneda ? `(${it.moneda})` : ''}</label>
                      <input
                        id={`m-${it.key}`}
                        type="text"
                        inputMode={moneda === 'COP' && it.moneda === 'COP' ? 'numeric' : 'decimal'}
                        value={formatEntrada(it.entrada)}
                        onChange={(e) => cambiar(it.key, { entrada: limpiarEntrada(e.target.value, it.moneda !== 'COP'), montoConfirmado: true })}
                        className={`${selectCls} text-base font-semibold tabular-nums ${faltan.some((f) => f.campo === 'monto') ? 'border-[color:var(--alert)]' : ''}`}
                      />
                    </div>
                    <div>
                      <label className={labelCls} htmlFor={`d-${it.key}`}>Detalle</label>
                      <input id={`d-${it.key}`} type="text" value={it.descripcion} onChange={(e) => cambiar(it.key, { descripcion: e.target.value })} className={selectCls} />
                    </div>
                  </div>

                  {(it.tipo === 'gasto' || it.tipo === 'ingreso') && (
                    <div className="flex gap-2" role="group" aria-label="Tipo">
                      {(['gasto', 'ingreso'] as const).map((t) => (
                        <button key={t} type="button" aria-pressed={it.tipo === t}
                          onClick={() => cambiar(it.key, { tipo: t, categoria_id: categorias.find((c) => c.tipo === t && c.id === it.categoria_id)?.id || null })}
                          className={`flex-1 min-h-[44px] rounded-[14px] text-sm font-medium border ${it.tipo === t ? 'bg-[#0a0a0a] text-[#fafafa] border-[#0a0a0a]' : 'bg-[#f5f5f5] text-[#737373] border-[#e5e5e5]'}`}>
                          {t === 'gasto' ? '− Gasto' : '+ Ingreso'}
                        </button>
                      ))}
                    </div>
                  )}

                  {usaCuenta(it.tipo) && (
                    <div>
                      <label className={labelCls} htmlFor={`c-${it.key}`}>{it.tipo === 'ingreso' ? 'Entra a' : it.tipo === 'transferencia' ? 'Desde' : 'Cuenta'}</label>
                      <select id={`c-${it.key}`} value={it.cuenta_id || ''} onChange={(e) => cambiar(it.key, { cuenta_id: e.target.value || null })} className={`${selectCls} ${faltan.some((f) => f.campo === 'cuenta') ? 'border-[color:var(--alert)]' : ''}`}>
                        <option value="">Elige…</option>
                        {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre} · {privacyHidden ? '••••' : formatMonto(c.saldo_actual, c.moneda)}</option>)}
                      </select>
                    </div>
                  )}
                  {it.tipo === 'transferencia' && (
                    <div>
                      <label className={labelCls} htmlFor={`t-${it.key}`}>Hacia</label>
                      <select id={`t-${it.key}`} value={it.destino_cuenta_id || ''} onChange={(e) => cambiar(it.key, { destino_cuenta_id: e.target.value || null })} className={selectCls}>
                        <option value="">Elige…</option>
                        {cuentas.filter((c) => c.id !== it.cuenta_id).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                    </div>
                  )}
                  {usaCategoria(it.tipo) && (
                    <div>
                      <span className={labelCls}>Categoría</span>
                      <div className="flex flex-wrap gap-1.5">
                        {cats.map((c) => (
                          <button key={c.id} type="button" aria-pressed={it.categoria_id === c.id} onClick={() => cambiar(it.key, { categoria_id: c.id })}
                            className={`min-h-[44px] px-3 rounded-full text-sm border ${it.categoria_id === c.id ? 'bg-[#0a0a0a] text-[#fafafa] border-[#0a0a0a]' : 'bg-white text-[#0a0a0a] border-field'}`}>
                            {c.nombre}
                          </button>
                        ))}
                        {cats.length === 0 && <span className="text-sm text-[#737373]">No tienes categorías de {it.tipo}s. Créalas en Anotar.</span>}
                      </div>
                    </div>
                  )}
                  {(it.tipo === 'aporte_meta' || it.tipo === 'retiro_meta') && (
                    <div>
                      <label className={labelCls} htmlFor={`me-${it.key}`}>Meta</label>
                      <select id={`me-${it.key}`} value={it.meta_id || ''} onChange={(e) => cambiar(it.key, { meta_id: e.target.value || null })} className={selectCls}>
                        <option value="">Elige…</option>
                        {metas.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                      </select>
                    </div>
                  )}
                  {(it.tipo === 'abono_capital' || it.tipo === 'prestamo_capital') && (
                    <div>
                      <label className={labelCls} htmlFor={`de-${it.key}`}>Deuda</label>
                      <select id={`de-${it.key}`} value={it.deuda_id || ''} onChange={(e) => cambiar(it.key, { deuda_id: e.target.value || null })} className={selectCls}>
                        <option value="">Elige…</option>
                        {deudas.filter((d) => d.estado === 'activa').map((d) => <option key={d.id} value={d.id}>{d.contraparte} · {d.tipo === 'por_cobrar' ? 'te debe' : 'le debes'}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-medium text-[#737373]" htmlFor={`f-${it.key}`}>Fecha</label>
                    <input id={`f-${it.key}`} type="date" value={it.fecha || hoy} max={hoy} onChange={(e) => cambiar(it.key, { fecha: e.target.value || null })} className="bg-[#f5f5f5] text-sm px-3 min-h-[44px] rounded-[14px] border border-field" />
                  </div>

                  {/* Preguntas: lo que falta para anotar */}
                  {it.incluir && faltan.map((f) => (
                    <div key={f.campo} className="flex items-center justify-between gap-2 rounded-[14px] border border-[color:var(--alert)] p-2" role="status">
                      <p className="text-sm text-[#0a0a0a] flex items-center gap-1">
                        <span className="material-symbols-outlined text-[18px] text-alert" aria-hidden="true">help</span>
                        {f.texto}
                      </p>
                      {f.campo === 'monto' && parseFloat(it.entrada) > 0 && (
                        <button type="button" onClick={() => cambiar(it.key, { montoConfirmado: true })} className="min-h-[44px] px-3 rounded-[12px] text-sm font-semibold border border-field bg-white shrink-0">
                          Sí, {formatMonto(parseFloat(it.entrada), it.moneda, 'neutro')}
                        </button>
                      )}
                    </div>
                  ))}
                  {it.duplicado && (
                    <p className="text-sm text-alert flex items-start gap-1" role="status">
                      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">content_copy</span>
                      {it.duplicado === 'ya_anotado'
                        ? `Parece repetido: ya hay un ${NOMBRE[it.tipo].toLowerCase()} de ${formatMonto(it.monto, it.moneda, 'neutro')} ese día${cuentaNombre ? ` en ${cuentaNombre}` : ''}. Marca "Anotar" solo si es otro.`
                        : 'Lo dijiste dos veces. Marca "Anotar" solo si son dos movimientos distintos.'}
                    </p>
                  )}
                  {it.error && <p className="text-sm text-ember" role="alert">{it.error}</p>}
                </div>
              );
            })}

            {error && <p className="text-sm text-ember" role="alert">{error}</p>}
            <div className="grid grid-cols-[auto_1fr] gap-2 pt-1">
              <button type="button" onClick={() => { setFase('dictar'); setItems([]); setResumen(null); setError(null); }} className="min-h-[52px] px-4 rounded-[18px] text-sm font-semibold border border-field bg-white text-[#0a0a0a]">
                Volver
              </button>
              <button type="button" onClick={guardarRevisados} className="min-h-[52px] rounded-[18px] text-sm font-semibold bg-[#0a0a0a] text-[#fafafa]">
                {textoBoton}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
