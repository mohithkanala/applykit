#!/usr/bin/env node
// generate-cover-letter-docx.mjs — render a markdown cover letter to DOCX.
//
// Usage: node generate-cover-letter-docx.mjs <input.md> <output.docx>

import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import {
  AlignmentType,
  Document, Packer, Paragraph, TextRun, BorderStyle, ExternalHyperlink,
} from 'docx';

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error('Usage: node generate-cover-letter-docx.mjs <input.md> <output.docx>');
  process.exit(1);
}

const md = readFileSync(inPath, 'utf-8');
const lines = md.split(/\r?\n/);

const NAVY = '1F3864'; // matches the resume template
const GRAY = '333333';
const LIGHT_GRAY = '666666';

function parseInline(text, base = {}) {
  // Handle **bold**, *italic*, [text](url)
  const runs = [];
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|\[(.+?)\]\((.+?)\))/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) runs.push(new TextRun({ ...base, text: text.slice(last, m.index) }));
    if (m[2] !== undefined) runs.push(new TextRun({ ...base, text: m[2], bold: true }));
    else if (m[3] !== undefined) runs.push(new TextRun({ ...base, text: m[3], italics: true }));
    else if (m[4] !== undefined) {
      runs.push(new ExternalHyperlink({
        link: m[5],
        children: [new TextRun({ ...base, text: m[4] })],
      }));
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) runs.push(new TextRun({ ...base, text: text.slice(last) }));
  return runs;
}

const children = [];
let inHeader = true; // until first ---

for (let i = 0; i < lines.length; i++) {
  const raw = lines[i];
  const line = raw.trim();

  if (line === '---') {
    inHeader = false;
    children.push(new Paragraph({
      spacing: { before: 100, after: 200 },
      border: { bottom: { color: 'CCCCCC', space: 1, style: BorderStyle.SINGLE, size: 6 } },
    }));
    continue;
  }
  if (!line) {
    children.push(new Paragraph({ spacing: { before: 0, after: 80 } }));
    continue;
  }

  if (line.startsWith('# ')) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 60 },
      children: [new TextRun({ text: line.slice(2).toUpperCase(), bold: true, size: 36, color: NAVY })],
    }));
    continue;
  }
  if (line.startsWith('## ')) {
    children.push(new Paragraph({
      spacing: { before: 160, after: 80 },
      children: [new TextRun({ text: line.slice(3), bold: true, size: 26, color: NAVY })],
    }));
    continue;
  }

  // Numbered list (1. ...)
  const numMatch = line.match(/^(\d+)\.\s+(.+)$/);
  if (numMatch) {
    children.push(new Paragraph({
      spacing: { before: 40, after: 40 },
      indent: { left: 360, hanging: 360 },
      children: [
        new TextRun({ text: `${numMatch[1]}. `, bold: true, size: 22, color: NAVY }),
        ...parseInline(numMatch[2], { size: 22, color: GRAY }),
      ],
    }));
    continue;
  }

  // Header lines (before ---) styled smaller and lighter
  const base = inHeader ? { size: 20, color: '000000' } : { size: 22, color: GRAY };

  children.push(new Paragraph({
    alignment: inHeader ? AlignmentType.CENTER : undefined,
    spacing: { before: 0, after: inHeader ? 30 : 100 },
    children: parseInline(line, base),
  }));
}

const doc = new Document({
  creator: process.env.CV_AUTHOR || 'career-ops',
  title: 'Cover Letter',
  styles: { default: { document: { run: { font: 'Calibri' } } } },
  sections: [{
    properties: { page: { margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } },
    children,
  }],
});

const buffer = await Packer.toBuffer(doc);
await writeFile(outPath, buffer);
console.log(`Wrote ${outPath} (${buffer.length} bytes)`);
