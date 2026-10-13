#!/usr/bin/env node
// build-cv-from-data.mjs — render structured CV data to HTML via the template.
//
// Usage: node build-cv-from-data.mjs <cv-data.json> <output.html>
//
// Data schema matches output/airtable/.../cv-data.json. Standard companion to
// generate-pdf.mjs (HTML to PDF) and generate-cv-docx.mjs (data to DOCX).

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const [, , dataPath, outPath] = process.argv;
if (!dataPath || !outPath) {
  console.error('Usage: node build-cv-from-data.mjs <cv-data.json> <output.html>');
  process.exit(1);
}

const data = JSON.parse(await readFile(dataPath, 'utf-8'));
const tpl = await readFile(resolve(__dirname, '..', '..', 'templates', 'cv-template.html'), 'utf-8');

const esc = s => String(s)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:#0563C1;text-decoration:none;">$1</a>');

const comp = data.competencies.map(t => `<span class='competency-tag'>${t}</span>`).join('\n      ');

const expHtml = data.experience.map(j => {
  let h = `    <div class='job'>
      <div class='job-header'>
        <span class='job-company'>${j.company}</span>
        <span class='job-period'>${j.period}</span>
      </div>`;
  if (j.role) h += `\n      <div class='job-role'>${j.role}${j.location ? ` <span class='job-location'>(${j.location})</span>` : ''}</div>`;
  for (const p of (j.projects || [])) {
    h += `\n      <div class='job-role' style='margin-top:8px;'>${p.title}</div>`;
    if (p.stack) h += `\n      <div class='project-tech' style='margin-top:2px;margin-bottom:4px;'>Stack: ${p.stack}</div>`;
    h += `\n      <ul>\n`;
    for (const b of p.bullets) h += `        <li>${esc(b)}</li>\n`;
    h += '      </ul>';
  }
  if (j.bullets) {
    h += '\n      <ul>\n';
    for (const b of j.bullets) h += `        <li>${esc(b)}</li>\n`;
    h += '      </ul>';
  }
  h += '\n    </div>';
  return h;
}).join('\n\n');

const projHtml = (data.projects || []).map(p => `    <div class='project'>
      <div class='project-title'>${p.title}${p.badge ? ` <span class='project-badge'>${p.badge}</span>` : ''}</div>
      <div class='project-desc'>${esc(p.desc)}</div>
      <div class='project-tech'>Stack: ${p.tech}</div>
    </div>`).join('\n\n');

const eduHtml = data.education.map(e => `    <div class='edu-item'>
      <div class='edu-header'>
        <span class='edu-title'>${e.title}</span>
        <span class='edu-year'>${e.year}</span>
      </div>
      <div class='edu-desc'>${esc(e.desc).split('\n').join('<br>')}</div>
    </div>`).join('\n\n');

const certHtml = data.certifications.map(c => {
  const title = c.url
    ? `<a href='${c.url}' style='color:#0563C1;text-decoration:none;'>${c.title}</a>`
    : c.title;
  return `    <div class='cert-item'>
      <span class='cert-title'>${title}</span>
      <span class='cert-year'>${c.year}</span>
    </div>`;
}).join('\n');

const skillsHtml = `    <div class='skills-grid' style='flex-direction:column;gap:4px;'>\n` +
  data.skills.map(s => `      <div class='skill-item'><span class='skill-category'>${s.category}:</span> ${s.items}</div>`).join('\n') +
  '\n    </div>';

const subs = {
  '{{LANG}}': 'en',
  '{{PAGE_WIDTH}}': '8.5in',
  '{{NAME}}': data.candidate.name,
  '{{TAGLINE}}': data.tagline || '',
  '{{PHONE}}': data.candidate.phone,
  '{{EMAIL}}': data.candidate.email,
  '{{LINKEDIN_URL}}': data.candidate.linkedinUrl,
  '{{LINKEDIN_DISPLAY}}': data.candidate.linkedinDisplay,
  '{{PORTFOLIO_URL}}': data.candidate.portfolioUrl,
  '{{PORTFOLIO_DISPLAY}}': data.candidate.portfolioDisplay,
  '{{LOCATION}}': data.candidate.location,
  '{{SECTION_SUMMARY}}': 'Professional Summary',
  '{{SUMMARY_TEXT}}': esc(data.summary),
  '{{SECTION_COMPETENCIES}}': 'Core Competencies',
  '{{COMPETENCIES}}': comp,
  '{{SECTION_EXPERIENCE}}': 'Work Experience',
  '{{EXPERIENCE}}': expHtml,
  '{{SECTION_PROJECTS}}': 'Projects',
  '{{PROJECTS}}': projHtml,
  '{{SECTION_EDUCATION}}': 'Education',
  '{{EDUCATION}}': eduHtml,
  '{{SECTION_CERTIFICATIONS}}': 'Certifications',
  '{{CERTIFICATIONS}}': certHtml,
  '{{SECTION_SKILLS}}': 'Skills',
  '{{SKILLS}}': skillsHtml,
};

let html = tpl;

// Skip empty sections (Core Competencies and Projects) so the template matches the
// canonical CV layout that omits duplicate or unused sections.
const hasCompetencies = Array.isArray(data.competencies) && data.competencies.length > 0;
const hasProjects = Array.isArray(data.projects) && data.projects.length > 0;
if (!hasCompetencies) {
  html = html.replace(/\s*<!-- CORE COMPETENCIES -->[\s\S]*?(?=\s*<!-- WORK EXPERIENCE -->)/, '\n\n  ');
}
if (!hasProjects) {
  html = html.replace(/\s*<!-- PROJECTS -->[\s\S]*?(?=\s*<!-- EDUCATION -->)/, '\n\n  ');
}

for (const [k, v] of Object.entries(subs)) html = html.split(k).join(v);
await writeFile(outPath, html, 'utf-8');
console.log(`Wrote ${outPath}`);
