---
description: Paste one or more JDs; produce tailored resume + cover letter + validator score for each. Terse, no chatter.
argument-hint: <paste one or more JDs (text or URLs); separate multiple with --->
---

You are running the application build. $ARGUMENTS contains **one OR MORE** JDs (pasted text and/or URLs). Follow the canonical pipeline in **WORKFLOW.md** (the single source of truth) plus CLAUDE.md and `config/profile.yml`. Be terse — no preamble, no narration, just do it and report the deliverables.

**Multiple JDs:** if more than one JD is present (separated by `---`, blank lines, or clearly distinct postings), process EACH independently through the full pipeline (own folder, own manifest, own resume + cover letter + validator pass). End with a single **summary table**: company | role | folder | score (SHIP/REFINE) | framing call | top gap. Build sequentially. If 5+ are pasted, say so and offer to run them as parallel sub-agents to save time. Each JD adds tokens to this chat — for a large batch, fewer-per-chat keeps context lean.

## Steps

1. **Parse the JD.** Extract company, role title, location, seniority signals, required + preferred skills, years asked, visa/sponsorship notes, comp if present. If $ARGUMENTS is a URL, use the `/browse` skill to fetch it; if the page is bot-blocked (empty body), say so and ask the user to paste the JD text.

2. **Pick the folder.** `applications/applied/{today}/{slug}/` if the user is applying now, else `applications/pending/{slug}/`. `{slug}` = `{company}-{role}` kebab-case. Default to `pending/` unless the user says they're applying. Today's date is in the session context.

3. **Decide seniority framing yourself** (delegated — never ask). Mid/early-band or over-qualification-risk roles (esp. with a referral) → drop the year count, lead on match. Senior/Staff/Lead/Principal/Founding/Head/Consultant → lead with your total years of experience and any leadership scope. Note which call you made in one line.

4. **Write `JD.md`** (the parsed JD + a short honest fit verdict, including any gaps) and **`{dir}/cv-data.json`** (a tailored copy of `general-resume/cv-data.json`: reorder, rename, trim, rewrite tagline/summary from existing facts; never add facts that aren't in the master). Never fabricate. No self-rating words ("expert"), 0 em-dashes, no job-level designator (II, Senior, Staff) copied into your tagline, 2-page cap unless the profile says otherwise.

5. **Build:**
   - `python scripts/cv/build-resume.py {dir}/cv-data.json {dir}/Resume.docx`
   - `node scripts/cv/generate-pdf-from-docx.mjs {dir}/Resume.docx {dir}/Resume.pdf`
   - Verify page count with pypdf (2-page cap) and em-dash count == 0. Fix if violated.

6. **Cover letter** (default yes for MODERATE+ fit): write `{dir}/Cover_Letter.md` (one page, header matches resume, sign off "Regards,", 0 em-dashes, no "Excited to" filler, leads on match), then:
   - `node scripts/cv/generate-cover-letter-docx.mjs {dir}/Cover_Letter.md {dir}/Cover_Letter.docx`
   - `node scripts/cv/generate-pdf-from-docx.mjs {dir}/Cover_Letter.docx {dir}/Cover_Letter.pdf`
   - Verify 1 page.

7. **Validate (ALWAYS, automatic).** Invoke the `recruiter-validator` agent with the JD, resume DOCX+PDF, knowledge bank (`general-resume/cv-data.json`), and cover letter. Write its JSON to `{dir}/validator-verdict.json`. If REFINE, apply `recommended_changes`, rebuild, re-validate, up to 3 iterations. If a CRITICAL is a true bank gap the user can confirm, surface it.

8. **Email draft (always — save to disk, never auto-send).** Write a short application email to `{dir}/email-*.md` (recruiter-outreach style: 3 to 5 sentences, one line per project, "Regards," sign-off, no rate negotiation in the email). Header lines To/Cc/Subject + which resume to attach. Routing:
   - **Forwarded by a contact:** if someone in your network forwarded the req, address the recruiter / original sender directly and Cc the contact who forwarded it, unless their note says to reply to them instead.
   - **Direct/portal/referral:** if recruiter or hiring-manager contacts are known, draft `email-to-recruiter.md` (+ a referral-thanks note if there's a referrer). If LinkedIn Easy Apply / no contact, skip the email (note "no email — apply directly").
   - If the role is INELIGIBLE (visa/citizenship wall), still write the draft if asked but put a `DO NOT SEND — <reason>` line at the top.

## Output (terse)

- Resume PDF path
- Cover letter PDF path
- Validator score + SHIP/REFINE
- Seniority framing call (years vs match-first), one line
- Honest gaps (anything the JD wants that you lack — for interview prep, not faked)
- Live JD URL if provided

Do NOT log to the tracker or send anything until the user says they applied. Surface fit concerns in `JD.md`, not as chat pushback; build first.
