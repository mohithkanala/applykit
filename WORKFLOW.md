# WORKFLOW.md: Canonical Application Build Pipeline

**This is the single source of truth for building a tailored application.** The `/jd` command and CLAUDE.md point here. When the workflow changes, update THIS file.

---

## Source-of-truth hierarchy (read these, never hand-fabricate)

1. **Master resume data** `general-resume/cv-data.json`: your full resume as data, and the knowledge bank of every true, defensible claim about you. The recruiter-validator checks every resume against it. If a true claim isn't here, add it here first. Build the master resume from it with `python scripts/cv/build-resume.py general-resume/cv-data.json general-resume/Master_Resume.docx`.
2. **Your profile** `config/profile.yml` and `modes/_profile.md`: targets, narrative, deal-breakers.
3. **Custom validator rules (optional)** `config/validator-rules.md`: hard rules about you (exact degree wording, things never to claim).

## Per-JD build (what `/jd` runs)

1. **Parse the JD**: company, role, location, seniority, required/preferred skills, years, visa, comp. For a URL, fetch it; if bot-blocked, ask for pasted text.
2. **Folder**: `applications/applied/{today}/{slug}/` if applying now, else `applications/pending/{slug}/`. Slug = `{company}-{role}` kebab-case.
3. **Seniority framing (decide, don't ask)**: mid/early-band roles drop the year count and lead on match; senior/staff/lead roles lead with years and leadership scope.
4. **Write** `JD.md` (parsed JD + honest fit verdict including gaps) and `{dir}/cv-data.json`: a tailored copy of the master data. Tailoring is subtractive only: reorder, rename, trim, rewrite the tagline and summary from facts already in the master. Never add facts that aren't in the master.
5. **Build the resume**: `python scripts/cv/build-resume.py {dir}/cv-data.json {dir}/Resume.docx`, then `node scripts/cv/generate-pdf-from-docx.mjs {dir}/Resume.docx {dir}/Resume.pdf`. The PDF is rendered from the DOCX by Word, so the two are identical. Verify 2 pages (pypdf) and 0 em-dashes.
6. **Cover letter** for MODERATE+ fits: `{dir}/Cover_Letter.md` -> docx -> pdf. One page, header matches the resume, "Regards," sign-off, 0 em-dashes.
7. **Validate**: run the `recruiter-validator` agent (JD + resume + knowledge bank) and write `{dir}/validator-verdict.json`. Batch the fixes and run it once at the end (each pass takes a few minutes).
8. **Output**: resume path, cover letter path, validator score + SHIP/REFINE, framing call, honest gaps, JD URL.
9. **Index**: `node scripts/pipeline/index-applications.mjs` regenerates `applications/INDEX.md` from disk. On submit, move `pending/{slug}/` to `applied/{today}/{slug}/` and rerun it.

## Email drafts with attachments (Gmail, optional)

`scripts/email/imap-draft.py` creates a Gmail **draft** (never sends) with attachments via IMAP, threaded under an existing email. It adds an HTML part so Gmail doesn't hard-wrap the text at 78 characters.

```
python scripts/email/imap-draft.py --user you@gmail.com --pw-file PATH_TO_APP_PASSWORD --from-name "Your Name" \
  --to recruiter@example.com --cc someone@example.com --subject "Re: ..." --body-file body.txt \
  --attach Resume.pdf --attach Resume.docx --thread-from recruiter@example.com --thread-subject "Job Requirement"
```

After you review the draft: `python scripts/email/send-draft.py --user you@gmail.com --pw-file PATH --subject "<unique part of subject>" --dry-run` (check To/Cc/attachments), then run it again without `--dry-run`. It deletes the draft first and then sends over SMTP (deleting after the send can wipe Gmail's Sent copy); if the send fails, the draft is restored. It refuses unless exactly one draft matches.

Setup: turn on 2-step verification, create a Gmail **app password**, save it in a file outside the repo (e.g. `~/.secrets/gmail/app_password.txt`) and pass its path. Never commit it.

## Hard invariants (never violate)

- **2-page cap** for tailored resumes (a staffing-recruiter submittal may run longer if your profile says so).
- **0 em-dashes / en-dashes** everywhere; hyphens are fine.
- **No self-rating labels** ("expert/advanced/proficient").
- **No job-level designator in your tagline** (II, Senior, Staff come from the JD, not from you).
- **No fabrication.** Every claim must be in the knowledge bank. Surface gaps in `JD.md`; build anyway and let yourself decide.
- **Nothing is sent without your review.** Drafts only until you say send.
- **Tracker integrity**: never hand-add rows to `data/applications.md`; write a TSV to `batch/tracker-additions/` and run `node scripts/tracker/merge-tracker.mjs`.

## Scripts

- `scripts/cv/build-resume.py <cv-data.json> <out.docx>`: build a resume DOCX from data using `templates/resume-template.docx` (the resume design)
- `scripts/cv/generate-pdf-from-docx.mjs <in.docx> <out.pdf>`: Word engine via docx2pdf (Windows and Mac with Word), LibreOffice headless elsewhere
- `scripts/cv/generate-cover-letter-docx.mjs <in.md> <out.docx>`
- `scripts/email/imap-draft.py`, `scripts/email/send-draft.py`
- `scripts/pipeline/index-applications.mjs`, `scripts/tracker/merge-tracker.mjs`, `scripts/tracker/verify-pipeline.mjs`
- Page check: `python -c "from pypdf import PdfReader; print(len(PdfReader('x.pdf').pages))"`

## Parallel chats

Different jobs in parallel chats are fine: each job lives in its own folder and `applications/INDEX.md` is regenerated from disk. Never build the **same** JD in two chats at once.
