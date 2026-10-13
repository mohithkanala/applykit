# ApplyKit

An AI job-search command center that runs inside [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Paste a job description and get a tailored resume (DOCX + identical PDF), a cover letter, an independent recruiter-style score, and an email draft, all built only from facts in your own resume.

## Get started

You need [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and [Git](https://git-scm.com). In a terminal:

```
git clone https://github.com/mohithkanala/applykit
cd applykit
claude
```

Say **hi**. Claude installs everything, asks for your resume (upload a PDF or Word file, or build one together), and sets up your profile. Then paste any job description with `/jd`.

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

## Manual setup (optional)

Claude runs this for you on first start. To run it yourself: `./setup.sh` (macOS, Linux, Git Bash) or `powershell -ExecutionPolicy Bypass -File setup.ps1` (Windows). It installs the Node and Python packages and [gstack](https://github.com/garrytan/gstack), which needs [Bun](https://bun.sh). For PDFs identical to the DOCX, have Microsoft Word installed (otherwise LibreOffice is used).

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
