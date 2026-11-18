# 07 · Pruebas

| Comando | Qué prueba | Necesita |
|---|---|---|
| `npm run lint` | Revisión de tipos de todo el proyecto | — |
| `npm run prueba:local` | Reglas de dinero (16), indicadores (61), exportar (30), paquete de la IA (64) y voz sin IA (31) | — |
| `npm run prueba:servidor` | Servidor de punta a punta (81): dinero, dólares, metas, deudas, repetidos, datos ajenos, permisos de Firestore, tasas, resumen, exportar y voz con un Gemini simulado | Emuladores de Firebase (`firebase-tools` y Java) |
| `npm run prueba:ui` | En el navegador (9): crear cuenta, ingreso y gasto, saldos, recarga, tiempo real, voz sin IA y exportar | Emuladores y Playwright |

Las dos últimas se corren en un computador con Node. Si AI Studio no puede correrlas, usa la **lista manual**.

## Lista manual (en la vista previa o en la app publicada)
1. Crear una cuenta de usuario: aparecen **Efectivo** y **Ahorros Principal** en $0, y 5 categorías.
2. Calculadora → `100000` → Anotar → Salario → guardar. Después de 5 s, Analítica muestra **Disponible $100.000**.
3. Calculadora → `0 − 25000 =` → Anotar → Comida → guardar. Analítica: **Entró +$100.000 · Salió −$25.000 · Disponible $75.000**.
4. Anotar → Entre mis cuentas → 20.000 de Efectivo a Ahorros. El disponible sigue en $75.000.
5. Metas → Nueva meta "Prueba" de $1.000.000 → Apartar 50.000. Debe quedar **Disponible $25.000**.
6. Apartar 900.000 → el aviso debe ser "Solo tienes $25.000 libres para apartar."
7. Deudas → Nueva → "Me prestaron" 100.000 de "Mamá" → Pagué 150.000. El aviso es "Solo quedan $100.000 pendientes" y ofrece abonar $100.000 y saldar.
8. Recargar la página: todo sigue igual y la sesión sigue abierta.
9. Micrófono → "gasté 8 mil en un taxi" → Revisar antes: un gasto de $8.000 en Transporte.
10. Analítica › Ajustes › Exportar → Para mi IA → Preparar: dice cuántos movimientos tiene.
