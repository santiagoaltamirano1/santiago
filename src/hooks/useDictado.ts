import { useEffect, useRef, useState } from 'react';

// Dictado con el reconocimiento de voz del navegador (Web Speech API), en español de Colombia.
// Es el mismo motor que el "Transcriptor de voz en español" (motor B): resultados parciales en vivo,
// se reinicia solo mientras la persona quiera seguir hablando. En Firefox no existe: se escribe a mano.

export type EstadoDictado = 'inactivo' | 'escuchando' | 'no_soportado' | 'permiso_negado' | 'error';

export function useDictado(onFinal: (texto: string) => void) {
  const SR: any = typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;
  const [estado, setEstado] = useState<EstadoDictado>(SR ? 'inactivo' : 'no_soportado');
  const [parcial, setParcial] = useState('');
  const rec = useRef<any>(null);
  const quiere = useRef(false);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const crear = () => {
    const r = new SR();
    r.lang = 'es-CO';
    r.interimResults = true;
    r.continuous = !/Android/i.test(navigator.userAgent); // en Android continuous repite frases
    r.maxAlternatives = 1;
    r.onstart = () => setEstado('escuchando');
    r.onresult = (ev: any) => {
      let interino = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        // [U25] Lo que llega después de detener (o de otro reconocedor) no se agrega
        if (res.isFinal && quiere.current && r === rec.current) onFinalRef.current(res[0].transcript);
        else interino += res[0].transcript;
      }
      setParcial(interino);
    };
    r.onerror = (ev: any) => {
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') { quiere.current = false; setEstado('permiso_negado'); }
      else if (ev.error === 'network' || ev.error === 'audio-capture') { quiere.current = false; setEstado('error'); }
      // no-speech y aborted: se reintenta solo en onend
    };
    r.onend = () => {
      setParcial('');
      // [U25] Solo el reconocedor vigente se reinicia (evita dos a la vez y texto duplicado)
      if (quiere.current && r === rec.current) { try { r.start(); return; } catch { /* sigue abajo */ } }
      setEstado((e) => (e === 'escuchando' ? 'inactivo' : e));
    };
    return r;
  };

  const empezar = () => {
    if (!SR) return;
    quiere.current = true;
    try { rec.current?.abort(); } catch { /* ya estaba cerrado */ }
    try { rec.current = crear(); rec.current.start(); if ('vibrate' in navigator) navigator.vibrate(10); }
    catch { quiere.current = false; setEstado('error'); }
  };
  const detener = () => {
    quiere.current = false;
    try { rec.current?.stop(); } catch { /* ya estaba detenido */ }
    if ('vibrate' in navigator) navigator.vibrate(10);
    setEstado((e) => (e === 'escuchando' ? 'inactivo' : e));
  };

  useEffect(() => () => { quiere.current = false; try { rec.current?.abort(); } catch { /* nada */ } }, []);

  return { estado, parcial, empezar, detener, soportado: !!SR };
}
