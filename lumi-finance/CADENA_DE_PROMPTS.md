# Lumi Finance — Mesa de expertos y cadena de prompts

Configuración recomendada: **Opus 5.5, esfuerzo medio**. Cada prompt usa la salida del anterior como entrada. Respeta el orden.

---

## 1. La mesa de expertos

| Experto | Su única responsabilidad |
|---|---|
| **Estratega de marca** | Una idea central que quepa en 7 palabras y una metáfora que lo ordene todo |
| **Copywriter de respuesta directa** | Que cada frase empuje hacia la siguiente y, al final, hacia tu número |
| **Diseñador de identidad** | El logo y el sistema visual (color, tipografía, forma) |
| **★ Director de experiencia y diseño (dueño de lo que ve el cliente)** | Decide **todo lo que el cliente ve y siente**. Tiene veto sobre cualquier sección que hable demasiado del problema o que se vea como «otra página de finanzas» |
| **Especialista en conversión (CRO)** | Tu número a un toque, desde cualquier punto de la página |
| **Asesor de cumplimiento financiero** | Nada de cifras, testimonios ni promesas de rentabilidad inventadas |

### El Director de experiencia: reglas no negociables

1. **El dolor dura un solo momento.** El problema aparece **una vez**, en el primer pantallazo, y se toca con una pregunta, no con un sermón: *«¿Sabes a dónde se fue tu plata este mes?»*. Desde ahí, **el 90 % de la página es solución**.
2. **La página no cuenta la transformación: la hace vivir.** Empieza **a oscuras** (azul noche, cifras borrosas). Al bajar, la luz «se enciende»: el fondo pasa a crema cálido y las cifras se vuelven nítidas. El visitante pasa de la oscuridad a la claridad con el dedo, sin leer una palabra.
3. **Mostrar, no describir.** Nada de listas de funciones. Cada función se ve funcionando: un mensaje de voz que se vuelve un registro, un informe que se arma solo y un simulador con *su* número.
4. **Que el visitante ponga algo suyo.** Si escribe su ingreso y su «antojo» del mes, la proyección pasa a ser *suya*. Lo que uno arma, lo valora más (efecto IKEA y efecto de dotación).
5. **El final es el punto más alto** (regla del pico y el final). El cierre debe ser la sección más luminosa, con el número en grande.

### Psicología aplicada

| Plano | Palanca | Cómo se ve en la página |
|---|---|---|
| **Inconsciente** | Oscuridad → luz | El fondo cambia de color con el scroll. El dorado aparece solo cuando hay claridad |
| | Curiosidad (brecha de información) | Las cifras borrosas del hero se ven nítidas al pasar el cursor o al tocar «Encender la luz» |
| | Fluidez cognitiva | Una idea por pantalla, mucho aire y frases cortas |
| | Formas redondeadas y color cálido | Seguridad y cercanía, nada de «banco frío» |
| | Movimiento con intención | Las animaciones solo cuentan la historia y se apagan con `prefers-reduced-motion` |
| **Consciente** | Beneficio concreto | «Habla, y Lumi lo anota», «Tu informe dice qué hacer primero» |
| | Personalización | El simulador muestra lo que pasa con *tu* plata en 3, 6 y 12 meses |
| | Reducción de riesgo | «Sin regaños», «tus datos son tuyos», «te respondo yo, no un bot» |
| | Una sola acción | WhatsApp o llamada. Nada de formularios |

### Lo que la mesa tomó de las mejores marcas

- **Apple / Nubank:** el cliente es el héroe y la marca es la guía. Lumi no regaña: enciende la luz.
- **Stripe / Linear:** el producto *es* el héroe visual. Se muestra la app en acción, no fotos de stock.
- **Wise:** transparencia radical. Se dice qué hace y qué no hace.
- **Duolingo:** la calidez le gana a la autoridad cuando el público es joven.

### Logo

Una **L** (estructura y orden) que abraza un **punto de luz dorado** (claridad). Se lee como un sol que sale sobre una base firme. Funciona en una sola tinta, a 16 px y como foto de perfil de WhatsApp.

---

## 2. Cadena de prompts (copiar y pegar en orden)

### Prompt 0 — Contexto (una vez al inicio)

```
Eres una mesa de 6 expertos: estratega de marca, copywriter de respuesta directa, diseñador de identidad,
DIRECTOR DE EXPERIENCIA Y DISEÑO (dueño único de lo que ve y siente el cliente, con veto),
especialista en conversión (CRO) y asesor de cumplimiento financiero.

Producto: LUMI FINANCE, una app de finanzas personales para jóvenes en Colombia.
Qué hace: registras ingresos, gastos y transferencias (también con la voz), manejas varias cuentas
(pesos y dólares), metas de ahorro y deudas. Lumi calcula tus indicadores, y un analista de IA te entrega
un informe claro: cómo vas, qué pasa si sigues igual (3, 6 y 12 meses) y qué hacer primero.
Tono: de tú, cercano, sin regaños, riguroso con las cifras. Protege la privacidad (anonimiza a terceros).
Cliente ideal: [edad, ocupación, ingreso típico]. Acceso: [gratis / beta / plan].
Objetivo único de la página: que el visitante escriba por WhatsApp o llame al [NÚMERO +57].

Reglas: el problema se toca UNA sola vez y en una frase; el 90 % de la página muestra la solución en acción.
Prohibido: inventar cifras, testimonios o promesas de rentabilidad.
Antes de responder, cada experto opina en una línea. Luego entregan una versión consensuada.
```

### Prompt 1 — Posicionamiento

```
Definan: 1) el cliente ideal en un párrafo (qué siente, qué ha intentado);
2) la idea central en máximo 7 palabras; 3) la metáfora rectora (oscuridad → luz) con 10 palabras
de su campo semántico; 4) 3 diferenciadores reales y verificables del producto.
```

### Prompt 2 — Logo

```
El diseñador de identidad propone 3 conceptos de logo (símbolo + logotipo). Para cada uno:
la idea, por qué funciona a 16 px y si funciona en una sola tinta. El Director de experiencia elige uno.
Entreguen el ícono en SVG (viewBox 64x64), la versión horizontal, la paleta en hex y las tipografías de Google Fonts.
```

### Prompt 3 — Experiencia (lo dirige SOLO el Director de experiencia)

```
Diseña el recorrido emocional de la página, pantalla por pantalla, como un guion de cine:
- Pantalla 1: el dolor se toca en UNA pregunta y se resuelve con un gesto («encender la luz»).
- Pantallas 2 a N: la solución, mostrada en acción (demos interactivas, no listas de funciones).
- Final: el punto emocional más alto y el número de teléfono en grande.
Por pantalla, indica: qué ve el cliente, qué siente sin darse cuenta (inconsciente), qué entiende (consciente),
qué interacción hace y qué palanca psicológica usa. Veta cualquier pantalla que repita el problema.
```

### Prompt 4 — Copy

```
El copywriter escribe el texto sobre el guion aprobado. Titulares de máximo 8 palabras y párrafos de máximo 2 líneas.
Da 3 variantes del titular principal y el Director elige una. El asesor de cumplimiento marca cualquier promesa
de resultado o cifra sin fuente.
```

### Prompt 5 — Construcción del HTML

```
Construyan UN solo archivo HTML autocontenido (CSS y JS internos, sin frameworks), con:
- El logo SVG incrustado y como favicon.
- La transición de fondo oscuro → claro ligada al scroll.
- Las demos interactivas del guion: dictado por voz, informe y un simulador con los datos del visitante
  (marcado como ilustrativo).
- Un objeto CONFIG con el teléfono que rellene todos los enlaces (tel: y wa.me con un mensaje prellenado).
- Un botón flotante de WhatsApp, una barra fija con «Llamar» y «WhatsApp» en el móvil, y el número grande al final.
- Un diseño responsive desde 360 px, contraste AA y respeto por prefers-reduced-motion.
```

### Prompt 6 — Auditoría del Director de experiencia + CRO

```
Recorran la página como un joven de 22 años que llega desde Instagram en el móvil:
1) ¿En 5 segundos sé qué es y siento curiosidad? 2) ¿Cuántas veces se menciona el problema? (meta: 1)
3) ¿Cuántos toques hay hasta el número? (meta: 1) 4) ¿Qué momento recordaré mañana?
Den las 5 mejoras de mayor impacto y apliquen las 3 primeras.
```

---

## 3. Cómo poner tu número en el HTML

Abre `lumi-finance.html` con cualquier editor y busca `CONFIG` (cerca del final):

```js
const CONFIG = {
  phone: "573000000000",            // tu número con código de país, sin + ni espacios
  phoneDisplay: "+57 300 000 0000", // cómo se ve en la página
  waMessage: "Hola Lumi, quiero encender la luz sobre mi plata."
};
```

Al cambiar esas tres líneas se actualizan todos los botones y números de la página.
