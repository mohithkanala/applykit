#!/usr/bin/env node
// Lightweight markdown -> docx converter.
// Usage: node md-to-docx.mjs <file1.md> [file2.md] ...
// Writes alongside each input as <name>.docx.

import fs from 'node:fs';
import path from 'node:path';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
} from 'docx';

const FONT = 'Calibri';

function parseInline(text) {
  // Returns array of TextRun. Supports **bold**, *italic*, `code`.
  const runs = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      runs.push(new TextRun({ text: text.slice(last, m.index), font: FONT, size: 22 }));
    }
    const tok = m[1];
    if (tok.startsWith('**')) {
      runs.push(new TextRun({ text: tok.slice(2, -2), bold: true, font: FONT, size: 22 }));
    } else if (tok.startsWith('`')) {
      runs.push(new TextRun({ text: tok.slice(1, -1), font: 'Consolas', size: 20 }));
    } else if (tok.startsWith('*')) {
      runs.push(new TextRun({ text: tok.slice(1, -1), italics: true, font: FONT, size: 22 }));
    }
    last = m.index + tok.length;
  }
  if (last < text.length) {
    runs.push(new TextRun({ text: text.slice(last), font: FONT, size: 22 }));
  }
  return runs.length ? runs : [new TextRun({ text: text, font: FONT, size: 22 })];
}

function convert(md) {
  const lines = md.split(/\r?\n/);
  const children = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Code fence
    if (line.startsWith('```')) {
      const code = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        code.push(lines[i]);
        i++;
      }
      i++;
      for (const c of code) {
        children.push(new Paragraph({
          children: [new TextRun({ text: c || ' ', font: 'Consolas', size: 18 })],
          spacing: { before: 0, after: 0 },
          shading: { type: 'clear', fill: 'F4F4F4' },
        }));
      }
      children.push(new Paragraph({ children: [new TextRun({ text: '', font: FONT })] }));
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      children.push(new Paragraph({
        children: parseInline(line.slice(2)).map(r => {
          r.options = { ...r.options };
          return new TextRun({ ...r.options, bold: true, size: 36, font: FONT });
        }),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 360, after: 180 },
      }));
      i++; continue;
    }
    if (line.startsWith('## ')) {
      children.push(new Paragraph({
        children: parseInline(line.slice(3)).map(r => new TextRun({ ...r.options, bold: true, size: 30, font: FONT })),
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 280, after: 140 },
      }));
      i++; continue;
    }
    if (line.startsWith('### ')) {
      children.push(new Paragraph({
        children: parseInline(line.slice(4)).map(r => new TextRun({ ...r.options, bold: true, size: 26, font: FONT })),
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 220, after: 120 },
      }));
      i++; continue;
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line)) {
      children.push(new Paragraph({
        children: [new TextRun({ text: '', font: FONT })],
        border: { bottom: { color: 'AAAAAA', space: 1, value: BorderStyle.SINGLE, size: 6 } },
        spacing: { before: 120, after: 120 },
      }));
      i++; continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const buf = [];
      while (i < lines.length && (lines[i].startsWith('> ') || lines[i] === '>')) {
        buf.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      const text = buf.join(' ').trim();
      children.push(new Paragraph({
        children: parseInline(text).map(r => new TextRun({ ...r.options, italics: true })),
        indent: { left: 360 },
        border: { left: { color: 'AAAAAA', space: 12, value: BorderStyle.SINGLE, size: 12 } },
        spacing: { before: 120, after: 120 },
      }));
      continue;
    }

    // Bulleted list
    if (/^[-*]\s+/.test(line)) {
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        const item = lines[i].replace(/^[-*]\s+/, '');
        children.push(new Paragraph({
          children: parseInline(item),
          bullet: { level: 0 },
          spacing: { before: 40, after: 40 },
        }));
        i++;
      }
      continue;
    }

    // Numbered list
    if (/^\d+\.\s+/.test(line)) {
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        const item = lines[i].replace(/^\d+\.\s+/, '');
        children.push(new Paragraph({
          children: parseInline(item),
          numbering: { reference: 'numbered', level: 0 },
          spacing: { before: 40, after: 40 },
        }));
        i++;
      }
      continue;
    }

    // Blank line
    if (line.trim() === '') {
      children.push(new Paragraph({ children: [new TextRun({ text: '', font: FONT })] }));
      i++; continue;
    }

    // Plain paragraph (gather contiguous non-blank lines)
    const para = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== '' &&
      !lines[i].startsWith('#') && !lines[i].startsWith('>') &&
      !/^[-*]\s+/.test(lines[i]) && !/^\d+\.\s+/.test(lines[i]) &&
      !lines[i].startsWith('```') && !/^---+\s*$/.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    children.push(new Paragraph({
      children: parseInline(para.join(' ')),
      spacing: { before: 80, after: 80 },
    }));
  }

  return new Document({
    numbering: {
      config: [{
        reference: 'numbered',
        levels: [{
          level: 0,
          format: 'decimal',
          text: '%1.',
          alignment: AlignmentType.START,
          style: { paragraph: { indent: { left: 360, hanging: 260 } } },
        }],
      }],
    },
    styles: {
      default: {
        document: { run: { font: FONT, size: 22 } },
      },
    },
    sections: [{ properties: {}, children }],
  });
}

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('Usage: node md-to-docx.mjs <file.md> [file2.md] ...');
    process.exit(1);
  }
  for (const f of files) {
    const md = fs.readFileSync(f, 'utf8');
    const doc = convert(md);
    const out = path.join(path.dirname(f), path.basename(f, path.extname(f)) + '.docx');
    const buf = await Packer.toBuffer(doc);
    fs.writeFileSync(out, buf);
    console.log('wrote', out);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
