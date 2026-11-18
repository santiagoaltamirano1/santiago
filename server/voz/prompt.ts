// Lumi Finance · Prompt de voz VERSIONADO (lo usa server/voz/interpretar.ts y las pruebas).
// Sin imports. Probado con OpenAI (voz-v2: 30/30 ×3); en Google corre con Gemini y se vuelve a medir con /api/dev/evaluar-voz.
// Regla: ningún cambio de prompt entra a producción sin pasar los umbrales de server/voz/calificador.ts.
//  · voz-v1: el prompt de la Fase 5, tal cual (línea base).
//  · voz-v2: glosario colombiano, calendario de 7 días, ejemplos difíciles, correcciones dentro de la frase,
//            futuro = sin movimiento, campos nuevos (texto_fuente, nota, contraparte, cuenta_dicha, destino_dicho)
//            y validación que NO resuelve en silencio una cuenta que la persona nombró y no existe.

export type VersionVoz = "voz-v1" | "voz-v2";
export const VERSION_VOZ_PRODUCCION: VersionVoz = "voz-v2";

export const TIPOS = ["gasto", "ingreso", "transferencia", "aporte_meta", "retiro_meta", "abono_capital", "prestamo_capital"] as const;
export const CAMPOS_DUDA = ["cuenta", "destino", "categoria", "monto", "tipo", "meta", "deuda", "fecha"] as const;
const anulable = (t: string) => ({ type: [t, "null"] });

export interface Contexto {
  cuentas: { id: string; nombre: string; tipo?: string; moneda?: string }[];
  categorias: { id: string; nombre: string; tipo: "gasto" | "ingreso"; supercategoria?: string | null }[];
  metas: { id: string; nombre: string }[];
  deudas: { id: string; contraparte: string; concepto?: string | null; moneda?: string; relacion: string; pendiente?: number }[];
}

// ---------------------------------------------------------------------------
// Esquema de salida (JSON Schema estricto)
// ---------------------------------------------------------------------------
export function esquema(version: VersionVoz) {
  const propsBase: Record<string, unknown> = {
    tipo: { type: "string", enum: TIPOS },
    monto: { type: "number", description: "Siempre positivo, en unidades completas (25 mil = 25000)." },
    moneda: { type: "string", enum: ["COP", "USD", "EUR"] },
    descripcion: { type: "string", description: "Corta, en español, como la diría la persona: 'Almuerzo', 'Compra en la tienda'." },
    cuenta_id: anulable("string"),
    destino_cuenta_id: anulable("string"),
    categoria_id: anulable("string"),
    meta_id: anulable("string"),
    deuda_id: anulable("string"),
    fecha: { ...anulable("string"), description: "YYYY-MM-DD; null = hoy." },
    confianza: { type: "number", description: "0 a 1." },
    dudas: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["campo", "pregunta"],
        properties: { campo: { type: "string", enum: CAMPOS_DUDA }, pregunta: { type: "string" } },
      },
    },
  };
  const propsV2: Record<string, unknown> = {
    texto_fuente: { type: "string", description: "Copia LITERAL del pedazo del texto que originó este movimiento (incluida una corrección: '180 mil, no, mejor 185')." },
    nota: { ...anulable("string"), description: "Información extra que dijo y no es el detalle: 'para el cumpleaños de Ana'. null si no hay." },
    contraparte: { ...anulable("string"), description: "Persona o comercio nombrado: 'D1', 'mi tía', 'Camilo'. null si no hay." },
    cuenta_dicha: { ...anulable("string"), description: "Cómo nombró la cuenta de origen, aunque no exista en la lista: 'Daviplata', 'la tarjeta'. null si no la nombró." },
    destino_dicho: { ...anulable("string"), description: "Cómo nombró la cuenta de destino. null si no la nombró." },
  };
  const props = version === "voz-v2" ? { ...propsBase, ...propsV2 } : propsBase;
  return {
    name: "movimientos_lumi",
    strict: true,
    schema: {
      type: "object", additionalProperties: false, required: ["movimientos", "aclaracion"],
      properties: {
        aclaracion: { ...anulable("string"), description: "Pregunta general si el texto no se entiende o no trae movimientos; null si se entiende." },
        movimientos: { type: "array", items: { type: "object", additionalProperties: false, required: Object.keys(props), properties: props } },
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Calendario de los últimos 7 días (la IA no debe calcular días de la semana: lección de la F4)
// ---------------------------------------------------------------------------
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
export function calendario(hoy: string): string {
  const base = Date.UTC(+hoy.slice(0, 4), +hoy.slice(5, 7) - 1, +hoy.slice(8, 10));
  return Array.from({ length: 8 }, (_, k) => {
    const d = new Date(base - k * 864e5);
    const iso = d.toISOString().slice(0, 10);
    return `${k === 0 ? "hoy" : k === 1 ? "ayer" : DIAS[d.getUTCDay()]} = ${iso}${k >= 2 ? "" : ` (${DIAS[d.getUTCDay()]})`}`;
  }).join("; ");
}

// ---------------------------------------------------------------------------
// Instrucciones
// ---------------------------------------------------------------------------
function instruccionesV1(ctx: Contexto, hoy: string, cuentaDefecto: string | null) {
  return `Eres el asistente de registro de Lumi Finance, una app de finanzas personales para jóvenes en Colombia.
Tu ÚNICA tarea es ORGANIZAR en movimientos lo que la persona dijo. No das consejos ni opiniones.

Hoy es ${hoy} (hora de Bogotá).

Reglas:
- Un movimiento por cada gasto, ingreso, transferencia, abono o aporte que la persona mencione. No inventes movimientos.
- Montos colombianos: "mil", "lucas", "luquitas", "barras" = ×1.000; "palo", "palos", "millón", "melón" = ×1.000.000; "25 mil" = 25000; "1,5 palos" = 1500000. Siempre positivos.
- Moneda COP salvo que diga dólares/USD o euros.
- tipo: "me gasté/compré/pagué algo" = gasto; "recibí/me pagaron/gané/me llegó" = ingreso; "pasé/moví de X a Y" = transferencia;
  "aparté/ahorré para (meta)" = aporte_meta; "saqué de (meta)" = retiro_meta;
  pagos de una deuda existente o "X me pagó lo que me debía" = abono_capital; "le presté a X" / "X me prestó" sobre una deuda existente = prestamo_capital.
- Usa SOLO los id de las listas de abajo. Nunca inventes un id.
- cuenta_id: la cuenta que la persona nombre (Nequi, efectivo, banco…). Si no nombra ninguna, usa la cuenta por defecto${cuentaDefecto ? ` (${cuentaDefecto})` : ""}.
  Si nombra una cuenta que no está en la lista, deja cuenta_id en null y agrega una duda de campo "cuenta".
- categoria_id: solo para gasto e ingreso; elige la categoría del MISMO tipo que mejor encaje. Si ninguna encaja razonablemente, null y una duda "categoria".
- En metas y deudas: categoria_id null. Si la meta o deuda no se puede identificar en la lista, null y una duda.
- Si el monto no es claro ("como 20 o 30 mil"), usa el más probable, baja la confianza y agrega una duda "monto".
- fecha: null si es hoy; "ayer" = el día anterior a hoy; fechas explícitas en YYYY-MM-DD.
- dudas: preguntas cortas, en tuteo, que se respondan con un toque. Vacío si no hay dudas.
- confianza: 0.9+ si todo es explícito; 0.6–0.8 si tuviste que suponer algo; menos si es muy dudoso.
- Si el texto no tiene ningún movimiento, devuelve movimientos vacío y una aclaración.

Cuentas: ${JSON.stringify(ctx.cuentas)}
Categorías: ${JSON.stringify(ctx.categorias)}
Metas: ${JSON.stringify(ctx.metas)}
Deudas activas: ${JSON.stringify(ctx.deudas)}`;
}

// La parte FIJA va primero (se reutiliza en caché entre llamadas); lo variable (fecha y listas) al final.
const FIJO_V2 = `Eres el asistente de registro de Lumi Finance, una app de finanzas personales para jóvenes en Colombia.
Tu ÚNICA tarea es ORGANIZAR en movimientos lo que la persona dijo o escribió. No das consejos ni opiniones.

# Reglas
1. Un movimiento por cada gasto, ingreso, transferencia, aporte, retiro, abono o préstamo que la persona diga que YA pasó. Nunca inventes movimientos.
2. Futuro o intención ("voy a pagar", "todavía no lo he pagado", "el mes que viene") = NO es movimiento. Si no queda ninguno, movimientos vacío y una aclaración corta.
3. Correcciones dentro de la frase ("180 mil, no, mejor dicho 185", "30… no espera, 20") = UN solo movimiento con el valor FINAL. Su texto_fuente incluye la corrección completa.
4. Muletillas y palabras repetidas por el dictado ("eh", "pues", "este", "un un") no cambian nada. Pero si la persona dice DOS veces el mismo gasto completo, son DOS movimientos (la app decide si es repetido).
5. Montos: siempre positivos y en unidades completas.
   - "mil", "lucas", "luquitas", "barras", "k" = ×1.000 ("25 lucas" = 25000; "12 k" = 12000). "media luca" = 500.
   - "palo", "palos", "melón", "millón" = ×1.000.000; "un palo y medio" = 1500000; "2 palos 300" = 2300000.
   - "una gamba" = 100000.
   - "150" o "aboné 150" sin unidad, cuando el contexto es de miles, = 150000 con confianza 0.7 o menos.
   - "como 20 o 30 mil" = el menor (20000), confianza baja y una duda "monto".
6. Moneda COP salvo que diga dólares, USD, "verdes" o euros. En dólares y euros el número va TAL CUAL, sin multiplicar: "20 dólares" = 20; "400 USD" = 400; solo "mil dólares" = 1000.
7. Tipos:
   - gasto: compré, pagué algo, me gasté. Incluye arriendo, servicios, suscripciones.
   - ingreso: recibí, me pagaron, me llegó, vendí, me regalaron, "la quincena", "el sueldo".
   - transferencia: pasé/moví plata entre DOS cuentas de la persona. "Saqué del cajero" = de la cuenta bancaria a Efectivo. "Pagué la tarjeta desde el banco" = transferencia del banco a la tarjeta (no es gasto).
   - aporte_meta: aparté, guardé, ahorré PARA una meta de la lista. retiro_meta: saqué plata DE una meta ("de la plata del Mac").
   - "Puse/metí/mandé plata a X" donde X es una cuenta o billetera (Nequi, Daviplata, el banco), aunque no esté en la lista = transferencia hacia X (nunca aporte_meta).
   - abono_capital: pago a una deuda existente, o "X me pagó lo que me debía".
   - prestamo_capital: "le presté a X" o "X me prestó".
8. Usa SOLO los id de las listas. Nunca inventes un id.
9. Cuentas:
   - cuenta_dicha y destino_dicho: escribe cómo nombró la persona la cuenta, aunque no exista ("Daviplata", "la tarjeta", "el banco"). null si no nombró ninguna.
   - Si nombró una cuenta que SÍ está en la lista (aunque la diga distinto: "Bancol" = Bancolombia, "la Visa" = la tarjeta Visa), usa su id.
   - Si nombró una cuenta que NO está en la lista: cuenta_id null y una duda "cuenta" que diga su nombre ("No tienes Daviplata en Lumi, ¿de qué cuenta salió?").
   - Si no nombró ninguna: cuenta_id = la cuenta por defecto.
10. Categorías: solo para gasto e ingreso, del MISMO tipo. Guía: almuerzo, tinto, domicilios, Rappi, restaurante = comida; taxi, Uber, TransMilenio, SITP, gasolina = transporte; mercado, D1, Ara, Éxito = mercado; internet, celular, luz, agua, Netflix, Spotify = servicios; cerveza, rumba, cine = salidas; sueldo, quincena = salario. Si ninguna categoría de la lista encaja de verdad (por ejemplo arriendo y no hay Vivienda), categoria_id null y una duda "categoria". No fuerces.
11. Metas y deudas: identifica por el nombre o la persona ("la del Mac" = MacBook; "mi mamá" = Mamá). Si la persona o meta no está en la lista, id null, una duda "deuda" o "meta" y escribe el nombre en contraparte. categoria_id null.
12. Fechas: null si es hoy. Usa SOLO el calendario de abajo para "ayer", "el lunes", etc. Fechas con día y mes ("el 3 de noviembre") en YYYY-MM-DD del año actual. Nunca una fecha futura.
13. texto_fuente: copia LITERAL (mismas palabras y números) del pedazo del texto que originó cada movimiento. nota: información extra útil ("para el cumpleaños de mi tía"); null si no hay. contraparte: persona o comercio nombrado.
14. dudas: preguntas cortas, en tuteo, que se respondan con un toque. Vacío si no hay dudas. Nunca resuelvas en silencio algo que no sabes: pregunta.
15. confianza: 0.9+ si todo es explícito; 0.6–0.8 si supusiste algo; menos si es muy dudoso.

# Ejemplos (cuentas de ejemplo: Efectivo por defecto, Nequi, Davivienda, Mastercard)
- "pagué 8 lucas de bus y 4.500 de una arepa" → 2 gastos: 8000 Transporte; 4500 Comida. texto_fuente "pagué 8 lucas de bus" y "4.500 de una arepa".
- "me consignaron 1 palo 200 del trabajo a Davivienda" → ingreso 1200000, cuenta Davivienda, Salario.
- "metí 300 mil a Movii" (no hay Movii) → transferencia 300000 desde la cuenta por defecto; destino_cuenta_id null, destino_dicho "Movii", duda destino "No tienes Movii en Lumi, ¿a qué cuenta entró?".
- "pagué 15 dólares de Spotify con la Mastercard" → gasto 15 USD (no 15000), cuenta Mastercard, Servicios.
- "cené con 45 mil, no, fueron 48" → UN gasto 48000 Comida; texto_fuente "cené con 45 mil, no, fueron 48".
- "la otra semana pago el semestre" → sin movimientos; aclaración "Eso todavía no pasa; cuando lo pagues, me cuentas."
- "le presté 30 a Laura" (Laura no está en las deudas) → prestamo_capital 30000, deuda_id null, contraparte "Laura", duda deuda.
- "retiré 200 mil en el cajero de Davivienda" → transferencia Davivienda → Efectivo.
- "aboné 400 mil a la Mastercard desde Davivienda" → transferencia Davivienda → Mastercard.
- "me regalaron 50 mil por mi cumpleaños y gasté 20 en pastel" → ingreso 50000 Regalos (nota "cumpleaños") + gasto 20000 Comida.
- "eh pues hoy hoy pagué un un parqueadero de 6 mil" → UN gasto 6000 Transporte.
- "gasté como 10 o 15 mil en dulces" → gasto 10000, confianza baja, duda monto "¿Fueron 10 o 15 mil?".
- "qué más" → sin movimientos; aclaración "¿Qué quieres anotar?".`;

function instruccionesV2(ctx: Contexto, hoy: string, cuentaDefecto: string | null) {
  return `${FIJO_V2}

# Datos de esta persona
Hoy es ${hoy} (hora de Bogotá). Calendario: ${calendario(hoy)}.
Cuenta por defecto: ${cuentaDefecto ? cuentaDefecto : "ninguna"}.
Cuentas: ${JSON.stringify(ctx.cuentas)}
Categorías: ${JSON.stringify(ctx.categorias)}
Metas: ${JSON.stringify(ctx.metas)}
Deudas activas: ${JSON.stringify(ctx.deudas)}`;
}

export function instrucciones(version: VersionVoz, ctx: Contexto, hoy: string, cuentaDefectoNombre: string | null) {
  return version === "voz-v2" ? instruccionesV2(ctx, hoy, cuentaDefectoNombre) : instruccionesV1(ctx, hoy, cuentaDefectoNombre);
}

// ---------------------------------------------------------------------------
// Ubicar texto_fuente en el texto original (índices calculados por el servidor, nunca por el modelo)
// ---------------------------------------------------------------------------
const plano = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Versión normalizada (sin tildes, minúsculas, solo letras/números, espacios unificados) con el mapa de posiciones. */
function normalizarConMapa(s: string): { t: string; mapa: number[] } {
  let t = ""; const mapa: number[] = []; let espacio = false;
  for (let i = 0; i < s.length; i++) {
    const c = plano(s[i]);
    if (/[a-z0-9ñ]/.test(c)) { t += c; mapa.push(i); espacio = false; }
    else if (!espacio && t.length) { t += " "; mapa.push(i); espacio = true; }
  }
  return { t: t.trimEnd(), mapa };
}

export function ubicarFuentes(texto: string, fuentes: (string | null | undefined)[]): ({ inicio: number; fin: number } | null)[] {
  let cursor = 0;
  const norm = normalizarConMapa(texto);
  return fuentes.map((f) => {
    const frag = (f || "").trim();
    if (!frag) return null;
    let i = texto.indexOf(frag, cursor);
    if (i < 0) i = texto.indexOf(frag);
    if (i >= 0) { cursor = i + frag.length; return { inicio: i, fin: i + frag.length }; }
    const nf = normalizarConMapa(frag).t;
    if (!nf) return null;
    const desdeNorm = norm.mapa.findIndex((p) => p >= cursor);
    let j = norm.t.indexOf(nf, Math.max(0, desdeNorm));
    if (j < 0) j = norm.t.indexOf(nf);
    if (j < 0) return null;
    const inicio = norm.mapa[j], fin = norm.mapa[j + nf.length - 1] + 1;
    cursor = fin;
    return { inicio, fin };
  });
}

// ---------------------------------------------------------------------------
// Validación contra los datos reales (lo que no cuadra se vuelve una duda; nada se inventa)
// ---------------------------------------------------------------------------
export function validar(salida: any, ctx: Contexto, cuentaDefecto: string | null, version: VersionVoz, texto = "", hoy = "") {
  const ids = (l: { id: string }[]) => new Set(l.map((x) => x.id));
  const cuentas = ids(ctx.cuentas), metas = ids(ctx.metas), deudas = ids(ctx.deudas);
  const catTipo = new Map(ctx.categorias.map((c) => [c.id, c.tipo]));
  const nombreCuentaExiste = (dicha: string | null | undefined) => {
    if (!dicha) return true;
    const d = plano(dicha);
    return ctx.cuentas.some((c) => { const n = plano(c.nombre); return n.includes(d) || d.includes(n); });
  };
  const movs = (Array.isArray(salida?.movimientos) ? salida.movimientos : []).slice(0, 20).filter((m: any) => (TIPOS as readonly string[]).includes(m.tipo));
  const fuentes = version === "voz-v2" ? ubicarFuentes(texto, movs.map((m: any) => m.texto_fuente)) : [];
  return movs.map((m: any, k: number) => {
    const dudas = Array.isArray(m.dudas) ? [...m.dudas] : [];
    const duda = (campo: string, pregunta: string) => { if (!dudas.some((d: any) => d.campo === campo)) dudas.push({ campo, pregunta }); };
    const limpio: any = { ...m, monto: Math.abs(Number(m.monto) || 0), dudas };
    if (!(limpio.monto > 0)) duda("monto", "¿Cuánto fue?");
    const usaCuenta = !["aporte_meta", "retiro_meta"].includes(m.tipo);
    if (usaCuenta) {
      if (!cuentas.has(m.cuenta_id)) {
        // v2: si la persona NOMBRÓ una cuenta que no existe, no se cambia en silencio por la de por defecto
        const nombroOtra = version === "voz-v2" && m.cuenta_dicha && !nombreCuentaExiste(m.cuenta_dicha);
        limpio.cuenta_id = !nombroOtra && cuentaDefecto && cuentas.has(cuentaDefecto) ? cuentaDefecto : null;
      }
      if (!limpio.cuenta_id) duda("cuenta", version === "voz-v2" && m.cuenta_dicha ? `No tienes "${m.cuenta_dicha}" en Lumi. ¿De qué cuenta?` : "¿De qué cuenta?");
    } else limpio.cuenta_id = null;
    if (m.tipo === "transferencia") {
      if (!cuentas.has(m.destino_cuenta_id) || m.destino_cuenta_id === limpio.cuenta_id) { limpio.destino_cuenta_id = null; duda("destino", version === "voz-v2" && m.destino_dicho && !nombreCuentaExiste(m.destino_dicho) ? `No tienes "${m.destino_dicho}" en Lumi. ¿A qué cuenta va?` : "¿A qué cuenta va?"); }
    } else limpio.destino_cuenta_id = null;
    if (m.tipo === "gasto" || m.tipo === "ingreso") {
      if (catTipo.get(m.categoria_id) !== m.tipo) { limpio.categoria_id = null; duda("categoria", m.tipo === "gasto" ? "¿En qué se fue?" : "¿De dónde vino?"); }
    } else limpio.categoria_id = null;
    if (m.tipo === "aporte_meta" || m.tipo === "retiro_meta") {
      if (!metas.has(m.meta_id)) { limpio.meta_id = null; duda("meta", "¿Para cuál meta?"); }
    } else limpio.meta_id = null;
    if (m.tipo === "abono_capital" || m.tipo === "prestamo_capital") {
      if (!deudas.has(m.deuda_id)) { limpio.deuda_id = null; duda("deuda", m.contraparte ? `${m.contraparte} no está en tus deudas. ¿Cuál es?` : "¿Cuál deuda?"); }
    } else limpio.deuda_id = null;
    if (limpio.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(limpio.fecha)) limpio.fecha = null;
    // Nunca una fecha futura: se deja en hoy y se pregunta
    if (limpio.fecha && hoy && limpio.fecha > hoy) { limpio.fecha = null; duda("fecha", "¿Qué día fue?"); }
    limpio.confianza = Math.max(0, Math.min(1, Number(m.confianza) || 0));
    if (dudas.length) limpio.confianza = Math.min(limpio.confianza, 0.6);
    if (version === "voz-v2") {
      limpio.fuente = fuentes[k] ?? null;
      limpio.nota = typeof m.nota === "string" && m.nota.trim() ? m.nota.trim().slice(0, 140) : null;
    }
    return limpio;
  });
}
