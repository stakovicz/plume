// `npm run captures`: redoes the doc and site screenshots that show the whole window, with `npm run dev` running
// (the tutorial layers are built from the app's own modules, which only the dev server serves).
// Chrome must be installed (playwright-core drives it, no browser download). Dark theme, French interface;
// each capture is written as WebP at the size the pages declare. Captures cropped to a panel or a dialog
// (tuto1-couleur, tuto1-degrade, tuto1-texte…) are still taken by hand.
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const URL = process.env.URL ?? 'http://localhost:1420/';
const browser = await chromium.launch({ channel: 'chrome' });

/** A fresh window `width` × `height` (CSS px), rendered at `out` pixels wide; the web version opens the first example. */
async function open(width, height, out) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: out / width, colorScheme: 'dark', locale: 'fr-FR' });
  const page = await ctx.newPage();
  await page.goto(URL);
  await page.getByText('Navigateur', { exact: true }).waitFor();
  await page.waitForTimeout(1500); // example and fonts loaded
  return page;
}

/** Screenshot of `page` as WebP, encoded by the browser itself. */
async function capture(page, path) {
  await page.waitForTimeout(500);
  const png = (await page.screenshot()).toString('base64');
  const webp = await page.evaluate(async (data) => {
    const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
    const c = new OffscreenCanvas(img.width, img.height);
    c.getContext('2d').drawImage(img, 0, 0);
    const blob = await c.convertToBlob({ type: 'image/webp', quality: 0.82 });
    return [...new Uint8Array(await blob.arrayBuffer())];
  }, png);
  writeFileSync(path, Uint8Array.from(webp));
  console.log(path);
  await page.context().close();
}

/** Tutorial 1 up to step 5 (artboard, sun, ground, title), pasted as Plume layers into a new document. */
async function tutorialLayers(page) {
  await page.keyboard.press('Meta+KeyN');
  await page.keyboard.press('a');
  await page.getByText('1920 × 1080', { exact: true }).click();
  await page.evaluate(async () => {
    const { newLayer } = await import('/src/lib/model/layer.ts');
    const { encodeFile } = await import('/src/lib/model/codable.ts');
    const { IDENTITY } = await import('/src/lib/model/geometry.ts');
    const { DEFAULT_TEXT } = await import('/src/lib/model/text.ts');
    const rgb = (h) => ({ r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4), 16) / 255, a: 1 });
    const p = (x, y) => ({ x, y });
    const ground = newLayer('Rectangle 1', 'rect', [p(0, 773.3), p(1920, 1080)], {
      fill: rgb('2E7D32'), strokeWidth: 0,
      fillGradient: { kind: 'linear', stops: [{ offset: 0, color: rgb('2E7D32') }, { offset: 1, color: rgb('A5D6A7') }], start: p(960, 773.3), end: p(960, 1080), radius: 0, transform: IDENTITY },
    });
    const sun = newLayer('Ovale 1', 'ellipse', [p(1180, 126.6), p(1440, 386.6)], { fill: rgb('F5B700'), strokeWidth: 0 });
    // size 119: set to 120 in the inspector below, which fits the box to the measured text
    const title = newLayer('Bonjour', 'text', [p(1080, 472.8), p(1080, 472.8)], {
      fill: rgb('000000'), strokeWidth: 0, text: { ...DEFAULT_TEXT, content: 'Bonjour', font: 'PT Serif', weight: 700, size: 119 },
    });
    const clip = new DataTransfer(); // pasted into the selected artboard
    clip.setData('application/x-plume+json', encodeFile({ layers: [ground, sun, title], palette: [] }));
    document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: clip, bubbles: true }));
  });
  await page.getByText('Bonjour', { exact: true }).first().click();
  await page.locator('.inspector').getByLabel('Taille', { exact: true }).last().fill('120');
  await page.keyboard.press('Enter');
}

// Site: the example illustration, the sun selected
{
  const page = await open(1440, 757, 1512);
  await page.mouse.click(868, 375);
  await page.mouse.move(5, 750);
  await capture(page, 'site/img/editeur.webp');
}

// Tutorial 1, step 2: the new Full HD artboard
{
  const page = await open(1372, 816, 1412);
  await page.keyboard.press('Meta+KeyN');
  await page.keyboard.press('a');
  await page.getByText('1920 × 1080', { exact: true }).click();
  await page.mouse.move(700, 790);
  await capture(page, 'docs/img/tuto1-plan-de-travail.webp');
}

// Tutorial 1, step 6: sun and title centered (⌥H), grouped, renamed Motif, shadow on
{
  const page = await open(1372, 683, 1568);
  await tutorialLayers(page);
  await page.getByText('Ovale 1', { exact: true }).click();
  await page.getByText('Bonjour', { exact: true }).first().click({ modifiers: ['Meta'] });
  await page.keyboard.press('Alt+KeyH');
  await page.keyboard.press('Meta+KeyG');
  await page.locator('.inspector').getByLabel('Nom', { exact: true }).fill('Motif');
  await page.keyboard.press('Enter');
  await page.locator('.inspector').getByLabel('Ombre', { exact: true }).first().click();
  await page.locator('button.disclosure[aria-label="Motif"]').click(); // unfold it in the navigator
  await page.mouse.move(700, 670);
  await capture(page, 'docs/img/tuto1-groupe.webp');
}

await browser.close();
