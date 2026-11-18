# Lumi Finance

Finanzas personales para jóvenes en Colombia: anota gastos e ingresos en segundos (calculadora o voz), metas, deudas, analítica y un informe hecho por tu IA.

**Stack:** React 19 + Vite + Tailwind + Zustand · servidor Express (`server.ts`) · Firebase Auth (correo y contraseña) + Firestore · Gemini.

## Empezar
- **En Google AI Studio:** sigue `guia-ai-studio/00_PASOS_PARA_TI.md` y la cadena `guia-ai-studio/CADENA_DE_PROMPTS.md`.
- **Para el agente de AI Studio:** `LEEME_AI_STUDIO.md`.
- **En tu computador:**
  ```bash
  npm install
  npm run dev        # servidor + app en http://localhost:3000 (necesita firebase-applet-config.json y GEMINI_API_KEY)
  ```

## Pruebas
```bash
npm run lint
npm run prueba:local       # sin internet
npm run prueba:motor       # emuladores de Firebase (firebase-tools + Java)
npm run prueba:ui          # navegador real + emuladores (Playwright)
```
