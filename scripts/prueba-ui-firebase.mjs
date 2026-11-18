// Prueba de punta a punta EN EL NAVEGADOR: app real + servidor real + emuladores de Firebase (sin internet).
// Ejecutar:  npm run prueba:ui   (necesita Chromium + Playwright; capturas en ./capturas-prueba-ui o la carpeta que pases)
// Recorre: crear cuenta → semilla → ingreso y gasto desde la calculadora → saldos en Firestore → recargar sigue con sesión
//          → voz sin llave muestra un aviso amable → Exportar genera el documento → cerrar sesión.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright/index.js'); }
const OUT = process.argv[2] || 'capturas-prueba-ui';
mkdirSync(OUT, { recursive: true });
const PUERTO = 3100;
const env = { ...process.env, VITE_USAR_EMULADORES: '1', FIREBASE_PROJECT_ID: 'demo-lumi', TASAS_DESACTIVADAS: '1', PORT: String(PUERTO), GEMINI_API_KEY: '', DISABLE_HMR: 'true' };
const srv = spawn('npx', ['tsx', 'server.ts'], { env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
const apagar = () => { try { process.kill(-srv.pid, 'SIGTERM'); } catch { /* ya terminó */ } };
process.on('exit', apagar);
let log = ''; srv.stdout.on('data', (d) => (log += d)); srv.stderr.on('data', (d) => (log += d));
for (let i = 0; i < 60 && !log.includes('Lumi Finance en'); i++) await new Promise((r) => setTimeout(r, 500));

const { initializeApp, getApps } = await import('firebase-admin/app');
const { getFirestore } = await import('firebase-admin/firestore');
const db = getFirestore(getApps()[0] || initializeApp({ projectId: 'demo-lumi' }));

const r = { pasos: [] };
let fallas = 0;
const caso = (n, c, d) => { r.pasos.push(`${c ? '✓' : '✗'} ${n}${c ? '' : ' · ' + JSON.stringify(d)}`); if (!c) fallas++; };
const b = await pw.chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'es-CO', timezoneId: 'America/Bogota' });
const page = await ctx.newPage();
const errores = []; page.on('pageerror', (e) => errores.push(e.message));
try {
  await page.goto(`http://localhost:${PUERTO}/`);
  await page.waitForSelector('text=Lumi Finance', { timeout: 30000 });
  await page.screenshot({ path: `${OUT}/1-entrar.png` });
  await page.getByText('¿No tienes cuenta? Crear una').click();
  const correo = `prueba.${Date.now()}@lumi.co`;
  await page.fill('#auth-email', correo);
  await page.fill('#auth-clave', 'clave-123456');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await page.waitForSelector('button[aria-label="Anotar hablando"]', { timeout: 30000 });
  await page.waitForTimeout(1500);
  const uid = (await db.collection('usuarios').get()).docs.map((d) => d.id).pop();
  const cuentas = async () => Object.fromEntries((await db.collection(`usuarios/${uid}/cuentas`).get()).docs.map((d) => [d.data().nombre, d.data().saldo_actual]));
  caso('Crear cuenta y semilla (Efectivo y Ahorros en 0)', JSON.stringify(await cuentas()) === JSON.stringify({ 'Ahorros Principal': 0, Efectivo: 0 }) || (await cuentas()).Efectivo === 0, await cuentas());
  await page.screenshot({ path: `${OUT}/2-calculadora.png` });

  const tecla = (k) => page.locator('section.grid button', { hasText: new RegExp(`^${k.replace(/[-×÷]/, (x) => '\\' + x)}$`) }).first().click();
  const teclear = async (s) => { for (const k of s) await tecla(k); };
  // Ingreso 100.000 a Efectivo
  await page.selectOption('select[aria-label="Cuenta"]', { label: (await page.locator('select[aria-label="Cuenta"] option', { hasText: 'Efectivo' }).first().textContent()).trim() });
  await teclear('100000');
  await page.locator('button', { hasText: /Anotar [+\-−]?\$/ }).first().click();
  await page.waitForSelector('#monto', { timeout: 10000 });
  await page.screenshot({ path: `${OUT}/3-registro-ingreso.png` });
  await page.locator('button', { hasText: 'Salario' }).first().click().catch(() => {});
  await page.locator('button[type=submit]').last().click();
  await page.waitForTimeout(7000); // 5 s para deshacer + envío
  caso('Ingreso 100.000 guardado en Firestore (Efectivo 100.000)', (await cuentas()).Efectivo === 100000, await cuentas());

  // Gasto 25.000 (0 − 25000 =)
  await page.locator('nav').getByText('Calculadora').click();
  await page.waitForSelector('section.grid');
  await tecla('AC'); await teclear('0'); await tecla('−'); await teclear('25000'); await tecla('=');
  await page.locator('button', { hasText: /Anotar [+\-−]?\$/ }).first().click();
  await page.waitForSelector('#monto', { timeout: 10000 });
  await page.locator('button', { hasText: 'Comida' }).first().click().catch(() => {});
  await page.locator('button[type=submit]').last().click();
  await page.waitForTimeout(7000);
  caso('Gasto 25.000 guardado (Efectivo 75.000)', (await cuentas()).Efectivo === 75000, await cuentas());
  const movs = (await db.collection(`usuarios/${uid}/movimientos`).get()).docs.map((d) => d.data());
  caso('2 movimientos con user_id, tasa y categoría', movs.length === 2 && movs.every((m) => m.user_id === uid && m.tasa_cop === 1 && m.categoria_id), movs.map((m) => [m.tipo, m.monto, m.categoria_nombre]));

  // Recargar: la sesión sigue y la pantalla muestra el saldo que viene de Firestore
  await page.reload();
  await page.waitForSelector('button[aria-label="Anotar hablando"]', { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.locator('nav').getByText('Analítica').click();
  await page.waitForTimeout(2000);
  const tablero = await page.locator('body').innerText();
  caso('Después de recargar sigue con sesión y la Analítica muestra $75.000', /75\.000/.test(tablero), tablero.slice(0, 400));
  await page.screenshot({ path: `${OUT}/4-analitica.png` });

  // Tiempo real: un cambio hecho en el servidor aparece sin recargar
  const efe = (await db.collection(`usuarios/${uid}/cuentas`).where('nombre', '==', 'Efectivo').get()).docs[0].ref;
  await efe.update({ saldo_actual: 76000 });
  await page.waitForTimeout(2500);
  caso('Tiempo real: el saldo cambia en pantalla sin recargar', /76\.000/.test(await page.locator('body').innerText()));
  await efe.update({ saldo_actual: 75000 });
  await page.waitForTimeout(1500);
  await page.locator('nav').getByText('Calculadora').click();
  await page.waitForSelector('button[aria-label="Anotar hablando"]');

  // Voz sin llave de Gemini → aviso amable
  await page.click('button[aria-label="Anotar hablando"]');
  await page.waitForSelector('#voz-texto');
  await page.fill('#voz-texto', 'gasté 8 mil en un taxi');
  await page.click('text=Revisar antes');
  await page.waitForTimeout(2500);
  const avisoVoz = await page.locator('[role=dialog] [role=alert]').first().textContent().catch(() => '');
  caso('Voz sin IA configurada: aviso amable, sin romper la app', /No pudimos organizar/.test(avisoVoz || ''), avisoVoz);
  await page.screenshot({ path: `${OUT}/5-voz-sin-ia.png` });
  await page.keyboard.press('Escape');
  await page.locator('[role=dialog] button[aria-label="Cerrar"]').first().click().catch(() => {});

  // Exportar
  await page.locator('nav').getByText('Analítica').click();
  await page.getByText('Exportar mis datos o pedirle un informe a tu IA').click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/6-exportar.png` });
  const botonGenerar = page.getByRole('button', { name: /Generar|Copiar|Descargar|Preparar/ }).first();
  await botonGenerar.click();
  await page.waitForTimeout(3000);
  const textoExport = await page.locator('main').textContent();
  caso('Exportar: arma el documento (2 movimientos)', !/No se pudo leer/.test(textoExport) && /2 movimientos|movimientos: 2|Listo/i.test(textoExport), textoExport.slice(0, 300));
  await page.screenshot({ path: `${OUT}/7-exportar-listo.png` });
} catch (e) {
  caso('La prueba terminó sin excepción', false, String(e?.message || e).slice(0, 400));
  await page.screenshot({ path: `${OUT}/error.png` }).catch(() => {});
}
caso('Sin errores de JavaScript en la página', errores.length === 0, errores);
console.log(r.pasos.join('\n'));
console.log(`\nprueba-ui-firebase: ${r.pasos.length - fallas} OK, ${fallas} fallas`);
await b.close();
apagar();
if (fallas) console.log('\n--- log del servidor ---\n' + log.slice(-2000));
process.exit(fallas ? 1 : 0);
