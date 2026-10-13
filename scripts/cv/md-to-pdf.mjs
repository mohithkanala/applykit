#!/usr/bin/env node
// Quick markdown to PDF converter using Playwright. One-off utility.
// Usage: node md-to-pdf.mjs <input.md> <output.pdf>

import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error('Usage: node md-to-pdf.mjs <input.md> <output.pdf>');
  process.exit(1);
}

const md = readFileSync(inPath, 'utf-8');

// Minimal markdown rendering: paragraphs, h1/h2/h3, em/strong, horizontal rule, links
function mdToHtml(src) {
  const lines = src.split(/\r?\n/);
  let html = '';
  let inPara = false;
  const flush = () => { if (inPara) { html += '</p>\n'; inPara = false; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    if (line === '---') { flush(); html += '<hr/>\n'; continue; }
    let m;
    if ((m = line.match(/^# (.+)$/))) { flush(); html += `<h1>${inline(m[1])}</h1>\n`; continue; }
    if ((m = line.match(/^## (.+)$/))) { flush(); html += `<h2>${inline(m[1])}</h2>\n`; continue; }
    if ((m = line.match(/^### (.+)$/))) { flush(); html += `<h3>${inline(m[1])}</h3>\n`; continue; }
    if ((m = line.match(/^(\d+)\. (.+)$/))) { flush(); html += `<p class="num"><span class="num-marker">${m[1]}.</span> ${inline(m[2])}</p>\n`; continue; }
    if (!inPara) { html += '<p>'; inPara = true; } else { html += ' '; }
    html += inline(line);
  }
  flush();
  return html;
}

function inline(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
}

const body = mdToHtml(md);
const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Cover Letter</title>
<style>
  @page { size: Letter; margin: 0.75in; }
  body { font-family: Georgia, 'Times New Roman', serif; font-size: 11pt; line-height: 1.5; color: #1a1a1a; max-width: 7in; }
  h1 { font-size: 18pt; margin: 0 0 0.1em 0; letter-spacing: 0.02em; }
  h2 { font-size: 13pt; margin: 1.2em 0 0.4em 0; color: #333; }
  h3 { font-size: 11pt; margin: 1em 0 0.3em 0; }
  hr { border: none; border-top: 1px solid #888; margin: 0.6em 0 1em 0; }
  p { margin: 0.4em 0; }
  p.num { margin: 0.4em 0 0.4em 1.6em; text-indent: -1.6em; padding-left: 0; }
  p.num .num-marker { display: inline-block; width: 1.4em; font-weight: 600; }
  a { color: #1a1a1a; text-decoration: underline; }
  strong { color: #000; }
</style></head><body>${body}</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'load' });
await page.pdf({ path: outPath, format: 'Letter', margin: { top: '0.75in', bottom: '0.75in', left: '0.75in', right: '0.75in' }, printBackground: false });
await browser.close();
console.log(`Wrote ${outPath}`);
