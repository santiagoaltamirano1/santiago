# 06 · Voz con Gemini y el agente analista

## Voz (Calculadora › micrófono)
1. El navegador transcribe lo que dices (Web Speech, es-CO), o la persona escribe.
2. `src/utils/normalizarDictado.ts` convierte números dichos en palabras ("veinticinco mil" pasa a "25 mil") y guarda el texto original.
3. `/api/voz/interpretar` hace esto:
   - lee las cuentas, categorías, metas y deudas de la persona;
   - le pide a Gemini un JSON estricto con el prompt **`server/voz/prompt.ts` (voz-v2)**;
   - valida cada dato contra lo real; lo que no cuadra se vuelve una **pregunta (duda)**;
   - ubica de qué parte del texto salió cada movimiento.
4. La persona elige "Revisar antes" o "Enviar de una vez". **La IA nunca guarda sola**: los movimientos van por `/api/movimientos` con `origen: 'ia_voz'`.
5. Al cerrar, `/api/voz/cerrar` guarda qué corrigió la persona (sirve para mejorar el prompt).

### Regla del prompt (obligatoria)
**Ningún cambio de `server/voz/prompt.ts` entra sin medirlo.** Se mide con el set de 30 frases (`server/voz/eval_set.ts`) usando el botón "Medir la voz" (Analítica › Ajustes, con el secreto `EVAL_VOZ=1`).

Para aprobar debe cumplir todos estos umbrales, en la **peor** de 3 corridas:
- monto, tipo y cantidad ≥ 97 %;
- promedio por campo ≥ 92 %;
- al menos 24 de 30 frases perfectas;
- **cero** dudas resueltas en silencio;
- p95 ≤ 4 s.

Línea base: voz-v2 sacó 30/30 en 3 corridas con OpenAI. Con Gemini **todavía no se ha medido**.

## Agente analista (Analítica › Ajustes › Exportar)
- La app arma un paquete: los datos, los indicadores (I01–I19), las gráficas y las instrucciones del agente **lumi-analista v1.3**. La persona lo copia y lo pega en cualquier IA (ChatGPT, Claude o Gemini).
- Todo pasa **en el teléfono**; el servidor solo entrega los datos (`/api/exportar`).
- Archivos: `src/ia/` (`paquete.ts`, `indicadores.ts`, `agenteAnalista.ts`, `agente/instrucciones.md`, `verificador.ts`). No se cambian en la migración.
