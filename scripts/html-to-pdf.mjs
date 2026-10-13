import { chromium } from 'playwright';
import path from 'path';

const htmlPath = process.argv[2];
const pdfPath = process.argv[3];
if (!htmlPath || !pdfPath) {
  console.error('Usage: node html-to-pdf.mjs <input.html> <output.pdf>');
  process.exit(1);
}
const absHtml = path.resolve(htmlPath);
const fileUrl = 'file:///' + absHtml.split(path.sep).join('/');

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(fileUrl);
await page.pdf({
  path: pdfPath,
  format: 'Letter',
  printBackground: true,
  margin: { top: '0.4in', bottom: '0.4in', left: '0.5in', right: '0.5in' }
});
await browser.close();
console.log('Wrote', pdfPath);
