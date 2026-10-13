#!/usr/bin/env node
// generate-cv-docx.mjs — render a structured CV data file to DOCX.
//
// Usage: node generate-cv-docx.mjs <data.json> <output.docx>
//
// The data.json file is produced by build-cv-*.mjs scripts when called
// with --data-only flag. Schema documented in build-cv-airtable-data.mjs.

import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  BorderStyle, ExternalHyperlink, ShadingType, LevelFormat,
} from 'docx';

const [, , dataPath, outPath] = process.argv;
if (!dataPath || !outPath) {
  console.error('Usage: node generate-cv-docx.mjs <data.json> <output.docx>');
  process.exit(1);
}

const data = JSON.parse(readFileSync(dataPath, 'utf-8'));

// Color palette mirroring the HTML template — monochrome
const NAVY = '0D0D0D';
const TEAL = '1A1A1A';
const PURPLE = '2A2A2A';
const GRAY = '3A3A3A';
const LIGHT_GRAY = '555555';

function spacer(height = 80) {
  return new Paragraph({ spacing: { before: 0, after: height } });
}

function rule() {
  return new Paragraph({
    border: { bottom: { color: 'CCCCCC', space: 1, style: BorderStyle.SINGLE, size: 6 } },
    spacing: { before: 0, after: 100 },
  });
}

function sectionHeading(text) {
  return new Paragraph({
    spacing: { before: 160, after: 60 },
    border: { bottom: { color: 'E2E2E2', space: 2, style: BorderStyle.SINGLE, size: 10 } },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, color: TEAL, size: 22, characterSpacing: 12 })],
  });
}

function bullet(text) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { before: 0, after: 25 },
    children: parseInline(text, { size: 20, color: GRAY }),
  });
}

// Parse inline **bold** spans, [text](url) links, and plain text into a mixed array
// of TextRun and ExternalHyperlink children suitable for Paragraph.children.
function parseInline(text, baseRun) {
  const runs = [];
  const re = /\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) runs.push(new TextRun({ ...baseRun, text: text.slice(last, m.index) }));
    if (m[1] !== undefined) {
      // Bold span
      runs.push(new TextRun({ ...baseRun, text: m[1], bold: true, color: NAVY }));
    } else {
      // Markdown link [text](url)
      runs.push(new ExternalHyperlink({
        link: m[3],
        children: [new TextRun({ ...baseRun, text: m[2], color: '0563C1' })],
      }));
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) runs.push(new TextRun({ ...baseRun, text: text.slice(last) }));
  return runs;
}

const children = [];

// === HEADER ===
children.push(new Paragraph({
  spacing: { before: 0, after: 40 },
  children: [new TextRun({ text: data.candidate.name, bold: true, size: 48, color: NAVY })],
}));
if (data.tagline) {
  children.push(new Paragraph({
    spacing: { before: 0, after: 80 },
    children: [new TextRun({ text: data.tagline, bold: true, size: 22, color: '2A2A2A' })],
  }));
}
children.push(rule());

// Single contact line: email | phone | location | linkedin | github
children.push(new Paragraph({
  spacing: { before: 0, after: 200 },
  children: [
    new ExternalHyperlink({
      link: `mailto:${data.candidate.email}`,
      children: [new TextRun({ text: data.candidate.email, size: 20, color: '0563C1' })],
    }),
    new TextRun({ text: ` | ${data.candidate.phone} | ${data.candidate.location} | `, size: 20, color: LIGHT_GRAY }),
    new ExternalHyperlink({
      link: data.candidate.linkedinUrl,
      children: [new TextRun({ text: data.candidate.linkedinDisplay, size: 20, color: '0563C1' })],
    }),
    new TextRun({ text: ' | ', size: 20, color: LIGHT_GRAY }),
    new ExternalHyperlink({
      link: data.candidate.portfolioUrl,
      children: [new TextRun({ text: data.candidate.portfolioDisplay, size: 20, color: '0563C1' })],
    }),
  ],
}));

// === PROFESSIONAL SUMMARY ===
children.push(sectionHeading('Professional Summary'));
children.push(new Paragraph({
  spacing: { before: 0, after: 100 },
  children: parseInline(data.summary, { size: 21, color: '2F2F2F' }),
}));

// === CORE COMPETENCIES ===
if (data.competencies && data.competencies.length) {
  children.push(sectionHeading('Core Competencies'));
  children.push(new Paragraph({
    spacing: { before: 0, after: 100 },
    children: [new TextRun({ text: data.competencies.join('  ·  '), size: 20, color: TEAL })],
  }));
}

// === WORK EXPERIENCE ===
children.push(sectionHeading('Work Experience'));
for (const job of data.experience) {
  // Company + period — keepNext so this header never orphans from its body.
  children.push(new Paragraph({
    spacing: { before: 320, after: 20 },
    keepNext: true,
    keepLines: true,
    children: [
      new TextRun({ text: job.company, bold: true, size: 23, color: PURPLE }),
      new TextRun({ text: `   ${job.period}`, size: 21, color: LIGHT_GRAY }),
    ],
  }));
  if (job.role) {
    children.push(new Paragraph({
      spacing: { before: 0, after: 60 },
      keepNext: true,
      keepLines: true,
      children: [
        new TextRun({ text: job.role, bold: true, size: 21, color: '333333' }),
        ...(job.location ? [new TextRun({ text: `  (${job.location})`, size: 21, color: LIGHT_GRAY })] : []),
      ],
    }));
  }
  for (const proj of job.projects || []) {
    children.push(new Paragraph({
      spacing: { before: 60, after: 20 },
      keepNext: true,
      keepLines: true,
      children: [
        new TextRun({ text: proj.title, bold: true, size: 20, color: '333333' }),
        ...(proj.subRole ? [new TextRun({ text: `   |  ${proj.subRole}`, italics: true, size: 20, color: LIGHT_GRAY })] : []),
      ],
    }));
    if (proj.stack) {
      children.push(new Paragraph({
        spacing: { before: 0, after: 30 },
        keepNext: true,
        keepLines: true,
        children: [new TextRun({ text: `Stack: ${proj.stack}`, italics: true, size: 21, color: LIGHT_GRAY })],
      }));
    }
    for (const b of proj.bullets) children.push(bullet(b));
  }
  for (const b of job.bullets || []) children.push(bullet(b));
}

// === PROJECTS ===
if (data.projects && data.projects.length) {
  children.push(sectionHeading('Projects'));
  for (const p of data.projects) {
    children.push(new Paragraph({
      spacing: { before: 100, after: 30 },
      children: [
        new TextRun({ text: p.title, bold: true, size: 21, color: PURPLE }),
        ...(p.badge ? [new TextRun({ text: `   ${p.badge}`, italics: true, size: 21, color: TEAL })] : []),
      ],
    }));
    children.push(new Paragraph({
      spacing: { before: 0, after: 30 },
      children: parseInline(p.desc, { size: 20, color: GRAY }),
    }));
    if (p.tech) {
      children.push(new Paragraph({
        spacing: { before: 0, after: 80 },
        children: [new TextRun({ text: `Stack: ${p.tech}`, italics: true, size: 21, color: LIGHT_GRAY })],
      }));
    }
  }
}

// === EDUCATION ===
children.push(sectionHeading('Education'));
for (const e of data.education) {
  children.push(new Paragraph({
    spacing: { before: 100, after: 20 },
    children: [
      new TextRun({ text: e.title, bold: true, size: 21, color: '333333' }),
      new TextRun({ text: `   ${e.year}`, size: 21, color: LIGHT_GRAY }),
    ],
  }));
  if (e.desc) {
    const lines = e.desc.split('\n');
    lines.forEach((line, idx) => {
      const isLast = idx === lines.length - 1;
      children.push(new Paragraph({
        spacing: { before: 0, after: isLast ? 100 : 40 },
        children: parseInline(line, { size: 20, color: GRAY }),
      }));
    });
  }
}

// === CERTIFICATIONS ===
if (data.certifications && data.certifications.length) {
  children.push(sectionHeading('Certifications'));
  for (const c of data.certifications) {
    const titleRun = c.url
      ? new ExternalHyperlink({
          link: c.url,
          children: [new TextRun({ text: c.title, size: 20, color: '0563C1' })],
        })
      : new TextRun({ text: c.title, size: 20, color: '1A1A1A' });
    children.push(new Paragraph({
      spacing: { before: 30, after: 30 },
      children: [
        titleRun,
        new TextRun({ text: `   ${c.year}`, size: 21, color: LIGHT_GRAY }),
      ],
    }));
  }
}

// === SKILLS ===
if (data.skills && data.skills.length) {
  children.push(sectionHeading('Skills'));
  for (const s of data.skills) {
    children.push(new Paragraph({
      spacing: { before: 30, after: 30 },
      children: [
        new TextRun({ text: `${s.category}: `, bold: true, size: 20, color: NAVY }),
        new TextRun({ text: s.items, size: 20, color: GRAY }),
      ],
    }));
  }
}

// === EXTRACURRICULARS & AWARDS ===
if (data.extracurriculars && data.extracurriculars.length) {
  children.push(sectionHeading('Extracurriculars & Awards'));
  for (const item of data.extracurriculars) {
    children.push(new Paragraph({
      bullet: { level: 0 },
      spacing: { before: 0, after: 25 },
      children: parseInline(item, { size: 20, color: GRAY }),
    }));
  }
}

const doc = new Document({
  creator: data.candidate.name,
  title: `${data.candidate.name} — CV`,
  styles: { default: { document: { run: { font: 'Calibri' } } } },
  sections: [{
    properties: {
      page: {
        margin: { top: 720, right: 720, bottom: 720, left: 720 }, // 0.5 inch in twips
      },
    },
    children,
  }],
});

const buffer = await Packer.toBuffer(doc);
await writeFile(outPath, buffer);
console.log(`Wrote ${outPath} (${buffer.length} bytes)`);
