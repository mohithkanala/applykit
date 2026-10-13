# ApplyKit

An AI job-search command center that runs inside [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Paste a job description and get a tailored resume (DOCX + identical PDF), a cover letter, an independent recruiter-style score, and an email draft, all built only from facts in your own resume.

## What you get

- **`/jd`**: paste one or more job descriptions (text or URLs). For each one you get:
  - a folder in `applications/pending/{company-role}/`
  - a tailored `Resume.docx` and an identical `Resume.pdf`
  - a one-page cover letter
  - a **recruiter-validator** verdict: score out of 10, SHIP or REFINE, JD requirement match, and any claim you couldn't defend in an interview
  - an application email draft
- **One clean resume design** for every resume (`templates/resume-template.docx`), generated from your data, so formatting never drifts.
- **No fabrication by design**: every resume is cut down from your master resume data (`general-resume/cv-data.json`), and the validator flags anything that isn't in it.
- **Job pipeline**: offer evaluation, portal scanning, tracker, follow-up cadence, interview prep (`/career-ops` shows every mode).
- **Applying on the web** with gstack's `/browse`: it reads job posts, checks they're live, and fills forms, then stops before Submit so you review.
- **Gmail drafts with attachments** (optional): drafts only; nothing is sent until you approve.

## Setup (about 15 minutes)

You need: [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [Git](https://git-scm.com), [Node.js](https://nodejs.org) 18+, [Python](https://www.python.org) 3.10+, and Microsoft Word (Windows or Mac) for pixel-identical PDFs. Without Word, PDFs fall back to LibreOffice.

1. **Get the kit**
   ```
   git clone https://github.com/mohithkanala/applykit.git
   cd applykit
   npm install
   pip install python-docx docx2pdf pypdf
   ```
2. **Install gstack** (browser and helper skills). It installs into your Claude Code skills folder and updates itself. You also need [Bun](https://bun.sh); on Windows, run this in Git Bash.
   ```
   git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup
   ```
3. **Start Claude Code in the kit folder** (`claude`) and say hello. It walks you through setup:
   - **Your base resume:** upload your current resume (PDF or Word), paste it, or build one from scratch together. Claude turns it into `general-resume/cv-data.json` and builds your master `Master_Resume.docx` and `.pdf`. Check every fact.
   - **Your profile:** target roles, location, salary range, deal-breakers.
   - **Portals and tracker** for scanning jobs.
4. **Run your first build:** `/jd` followed by a pasted job description.

## Your data stays private

Your resume data, profile, applications, and reports are in `.gitignore`, so they're never committed, even if you publish your fork. Before making any fork public, add your own name, email, and phone to `config/leak-patterns.txt` (copy `config/leak-patterns.example.txt`) and run `npm test`; it fails if any of them appear in tracked files.

## Key files

| File | What it is |
|---|---|
| `WORKFLOW.md` | The build pipeline `/jd` follows, step by step |
| `general-resume/cv-data.json` | Your master resume as data, the source of truth (example: `cv-data.example.json`) |
| `templates/resume-template.docx` | The resume design |
| `scripts/cv/build-resume.py` | Resume data to DOCX |
| `scripts/cv/generate-pdf-from-docx.mjs` | DOCX to identical PDF (Word engine) |
| `.claude/agents/recruiter-validator.md` | The independent recruiter that scores every resume |
| `.claude/commands/jd.md` | The `/jd` command |
| `config/validator-rules.example.md` | Optional hard rules about you for the validator |
| `scripts/email/` | Gmail draft and send helpers |

## License

MIT. See [LICENSE](LICENSE). Built on the open-source [career-ops](https://github.com/santifer/career-ops) project (MIT).
