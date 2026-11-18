# 01 · Producto: qué es Lumi Finance

**Para quién:** jóvenes en Colombia que quieren saber en qué se va su plata sin esfuerzo.
**Promesa:** anotar un gasto en segundos, con la calculadora o hablando, y ver claro lo que tienen, lo que deben y lo que apartaron.
**Idioma:** español de Colombia, en tuteo, con frases cortas. Cifras con formato es-CO: `$25.000`, punto de miles y signo "−".

## Los 4 módulos (barra inferior)
| Módulo | Archivo | Qué hace |
|---|---|---|
| **Calculadora** | `src/components/Calculator/ExpressCalculator.tsx` | Teclado. El botón "Anotar −$5.000" lleva el monto a Anotar. El micrófono abre la **voz** (`src/components/Voz/CapturaVoz.tsx`). |
| **Anotar** (Registro) | `src/components/Register/HybridRegister.tsx` | Formulario único de Movimiento, Metas y Deudas. Tiene 5 segundos para deshacer. |
| **Metas y Deudas** | `src/components/DebtsGoals/DebtsGoalsView.tsx` | Muestra metas y deudas. Cada botón abre Anotar ya llenado: un solo canal para escribir. |
| **Analítica** | `src/components/Analytics/` | Resumen (disponible, mes, deudas, metas, gráficas), Movimientos (con filtros) y Ajustes (cuentas, divisas, tema, **Exportar**, cerrar sesión). |

## Reglas de experiencia que ya están implementadas
- **Signo:** "−5000" es un gasto y "5000" es un ingreso. Registro siempre envía el monto en positivo; el tipo sale del signo.
- **Optimista:** el movimiento aparece de una, con 5 segundos para deshacer. Luego va al servidor. Si no hay internet, queda en una cola local y se reintenta.
- **Privacidad:** el ojo de Analítica oculta las cifras (`••••`).
- **Nada se borra de verdad:** un borrado solo marca el registro como inactivo (`is_active = false`).
- **Temas:** 4 temas (`[data-theme]` en `src/index.css`).
- **Exportar:** arma un documento con todos los datos para pegarlo en cualquier IA, junto con un "analista financiero" (ver 06).
