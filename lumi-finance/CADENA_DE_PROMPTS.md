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

### Paleta «Cocuyo»: color con emoción

Inspirada en las luciérnagas (cocuyos) de las noches colombianas. Cada color cumple un papel en la historia:

| Color | Hex | Emoción | Dónde aparece |
|---|---|---|---|
| Noche violeta | `#150C2A` | La incertidumbre, pero no fría: íntima, de noche en casa | El hero, el simulador y el pie de página |
| Chispa de luciérnaga | `#D4FF5E` | Asombro y esperanza: «algo se encendió» | Solo donde hay luz: el botón principal, el logo, los momentos clave y las luciérnagas |
| Amanecer coral | `#FF7452` | Calidez y alivio: «ya pasó la noche» | Barras, acentos, el amanecer y el cierre |
| Melocotón | `#FFB38A` | Cercanía, sin la frialdad de un banco | Gradientes y fondos suaves |
| Crema cálida | `#FFF3EA` | Calma y claridad | Las secciones de solución |

**Por qué es memorable:** casi todas las fintech usan azul, verde dinero o dorado. Lumi es la única de violeta con chispa de luciérnaga. Las luciérnagas que flotan al encender la luz son su firma visual: el detalle que la gente recuerda y cuenta.

### Logo

Una **L** (estructura y orden) que abraza un **punto de luz dorado** (claridad). Se lee como un sol que sale sobre una base firme. Funciona en una sola tinta, a 16 px y como foto de perfil de WhatsApp.

### La oferta: lo que la mesa decidió

**Lanzamiento:** 1 de enero de 2027. **Gancho:** quien se inscribe por WhatsApp y deja sus datos (tú se los pides en la conversación) tiene **enero y febrero de 2027 gratis** (100 % de descuento) en Premium o VIP. Desde marzo, Premium cuesta $19.900 y VIP $29.900 al mes. Free es gratis para siempre.

| | **Free** | **Premium** · Recomendado | **VIP** · Exclusivo |
|---|---|---|---|
| Promesa | Para empezar a ordenar | Todo lo que necesitas para tomar el control | Una experiencia hecha a tu medida |
| Precio | $0 | $19.900/mes | $29.900/mes |
| Registro manual, cuentas COP/USD | ✓ | ✓ | ✓ |
| Metas | 1 | Sin límite | Sin límite |
| Registro por voz | 5 al mes (para probar) | Sin límite | Sin límite |
| Asistente de finanzas con IA | — | Básico | **Agente avanzado de metas** que te acompaña semana a semana |
| Informe y exportación | — | 1 por semana | Cuando quieras |
| Proyecciones a 3, 6 y 12 meses | — | ✓ | ✓ |
| Novedades | — | — | **Primero en cada actualización** |
| Atención | — | WhatsApp | **Prioritaria** por WhatsApp |

**Técnicas de persuasión, sin que se sienta como un robo:**
1. **Efecto centro y señal de recomendación:** Premium va en el centro, en oscuro y con borde de luz. Es la opción «obvia».
2. **Precio por día:** «menos de $700 al día: menos que un tinto». Convierte un gasto mensual en algo cotidiano.
3. **Comparación con un señuelo:** VIP es «solo $10.000 más que Premium». Hace ver a VIP accesible y a Premium como una opción sensata.
4. **Free honesto:** es útil de verdad, pero muestra tachado lo que no incluye. El cliente ve lo que se pierde sin que nadie se lo diga.
5. **Reciprocidad y efecto de dotación:** 2 meses gratis. Quien registra su plata con voz y recibe informes no quiere volver atrás.
6. **Urgencia real, no inventada:** cuenta regresiva al 1 de enero. Nada de «quedan 3 cupos» falsos.
7. **Transparencia que da confianza:** «antes de marzo te avisamos para que elijas». Esto es lo que evita la sensación de robo.
8. **VIP vende estatus y acompañamiento, no más funciones:** primero en las novedades, atención prioritaria y un agente que te lleva a tus metas.
9. **Enmarcar el año nuevo:** «Empieza 2027 hablando con tu plata» aprovecha el efecto de nuevo comienzo.

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
La paleta debe ser de nicho y contar una emoción (no azul banco ni dorado genérico): justifiquen qué siente
el cliente con cada color y en qué momento de la página aparece. Definan una «firma visual» memorable.
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

### Prompt 3.5 — La oferta y los planes

```
Con estas condiciones: lanzamiento el 1 de enero de 2027; 100 % de descuento en enero y febrero para quien se inscriba
por WhatsApp y deje sus datos; Premium a $19.900/mes; VIP a $29.900/mes; Free con lo básico y voz limitada,
la mesa diseña la tabla de planes. Premium debe cubrir lo que la mayoría necesita. VIP debe sentirse exclusivo
(sin límites, agente avanzado de metas, primero en las novedades, atención prioritaria).
Usen técnicas de persuasión éticas (efecto centro, precio por día, señuelo, reciprocidad, urgencia real)
y digan cómo evitar que se sienta como un robo. El asesor de cumplimiento revisa las condiciones de la promo.
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

## 3. Guion de WhatsApp: primero conexión, después datos

El cliente llega con un mensaje corto y cálido que ya viene escrito desde la página (no pide datos):
> ¡Hola Lumi! 👋 Me llamó la atención el plan Premium y quiero empezar 2027 con mi plata en orden. ¿Me cuentas cómo aparto mis 2 meses gratis?

Tú respondes en **3 mensajes**, en este orden:

**1 · Conexión (antes de vender nada)**
> ¡Hola! Qué bueno que escribiste 🙌 Soy [tu nombre], de Lumi. Antes de contarte, una pregunta: si este año tu plata te hiciera caso, ¿qué es lo primero que quisieras lograr? (un viaje, salir de una deuda, por fin ahorrar…)

*Por qué funciona:* lo haces hablar de su meta, no de tu producto. Quien dice su meta en voz alta ya se comprometió un poco con ella (principio de compromiso y coherencia).

**2 · Puente (su meta + Lumi)**
> Me encanta. Eso es justo para lo que hicimos Lumi: le hablas, anota tus gastos y te dice qué hacer primero para llegar a [su meta]. Lanzamos el 1 de enero y, como escribiste antes, tienes enero y febrero gratis en Premium o VIP.

**3 · Datos (ya con confianza)**
> Para apartarte tus 2 meses solo necesito:
> 1. Tu nombre
> 2. Tu ciudad
> 3. Tu correo
> 4. ¿Premium o VIP? (si dudas, te ayudo a elegir según tu meta)

**Cierre**
> ¡Listo, [nombre]! Quedaste inscrito ✨ El 1 de enero te escribo para activarlo, y antes de marzo te aviso para que elijas si sigues, cambias de plan o pasas a Free.

*Consejo:* guarda los 4 mensajes como respuestas rápidas en WhatsApp Business, con atajos como `/hola`, `/puente`, `/datos` y `/listo`.

---

## 4. Cómo cambiar tu número en el HTML (ya está puesto)

Abre `lumi-finance.html` con cualquier editor y busca `CONFIG` (cerca del final):

```js
const CONFIG = {
  phone: "573246591009",            // tu número con código de país, sin + ni espacios
  phoneDisplay: "+57 324 659 1009", // cómo se ve en la página
  waMessage: "¡Hola Lumi! 👋 Vi la página y quiero empezar 2027 con mi plata en orden..."
};
```

Al cambiar esas tres líneas se actualizan todos los botones y números de la página.
