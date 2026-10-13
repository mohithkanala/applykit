#!/usr/bin/env python3
"""build-resume.py: build a resume DOCX from cv-data JSON using templates/resume-template.docx.

The template holds one formatted prototype paragraph per element (name, tagline, contact,
section heading, summary, skill line, company line, role, project, stack, bullet, education
line, education description, list item). This script clones those prototypes, so every resume
has exactly the template's look. Render the PDF from the DOCX with
scripts/cv/generate-pdf-from-docx.mjs so both files are identical.

Usage: python scripts/cv/build-resume.py <cv-data.json> <output.docx>
Text supports **bold** spans. Schema: see general-resume/cv-data.example.json.
"""
import copy
import json
import re
import sys
from pathlib import Path

import docx
from docx.opc.constants import RELATIONSHIP_TYPE as RT
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parents[2]
TEMPLATE = ROOT / "templates" / "resume-template.docx"
KEYS = ["NAME", "TAGLINE", "CONTACT", "HEADING", "SUMMARY", "SKILL", "COMPANY", "ROLE",
        "PROJECT", "STACK", "BULLET", "EDU", "EDUDESC", "ITEM"]
DASHES = re.compile("[–—]")


def clean(text):
    return DASHES.sub("-", str(text or ""))


def set_runs(p, text, base=0):
    """Rewrite paragraph p from runs[base] onward; **x** spans become bold copies of the base run."""
    runs = p._p.findall(qn("w:r"))
    proto = runs[base]
    for r in runs[base + 1:]:
        p._p.remove(r)
    parts = re.split(r"(\*\*.+?\*\*)", clean(text))
    anchor = proto
    first = True
    prpr = proto.find(qn("w:rPr"))
    proto_bold = prpr is not None and prpr.find(qn("w:b")) is not None
    for part in parts:
        if not part:
            continue
        bold = part.startswith("**") and part.endswith("**")
        txt = part[2:-2] if bold else part
        r = proto if first else copy.deepcopy(proto)
        if not first:
            anchor.addnext(r)
        rpr = r.find(qn("w:rPr"))
        if rpr is None:
            rpr = r.makeelement(qn("w:rPr"), {})
            r.insert(0, rpr)
        for b in rpr.findall(qn("w:b")):
            rpr.remove(b)
        if bold or proto_bold:
            rpr.insert(0, rpr.makeelement(qn("w:b"), {}))
        for t in r.findall(qn("w:t")):
            r.remove(t)
        t = r.makeelement(qn("w:t"), {})
        t.text = txt
        t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
        r.append(t)
        anchor, first = r, False
    if first:  # empty text
        for t in proto.findall(qn("w:t")):
            t.text = ""


def main():
    if len(sys.argv) != 3:
        sys.exit("Usage: python scripts/cv/build-resume.py <cv-data.json> <output.docx>")
    data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    d = docx.Document(str(TEMPLATE))
    protos = {}
    for p in d.paragraphs:
        m = re.match(r"\{\{(\w+)\}\}", p.text)
        if m and m.group(1) in KEYS:
            protos[m.group(1)] = p._p
        elif p.text.startswith("{{LABEL}}"):
            protos["SKILL"] = p._p
    missing = [k for k in KEYS if k not in protos]
    if missing:
        sys.exit(f"template is missing prototypes: {missing}")
    body = d.element.body
    for el in protos.values():
        body.remove(el)
    sect = body.find(qn("w:sectPr"))

    def add(key, text=None, bold_label=None):
        el = copy.deepcopy(protos[key])
        sect.addprevious(el)
        p = docx.text.paragraph.Paragraph(el, d._body)
        if key == "SKILL":
            runs = el.findall(qn("w:r"))
            runs[0].find(qn("w:t")).text = clean(bold_label) + ": "
            set_runs(p, text, base=1)
        elif text is not None:
            set_runs(p, text)
        return p

    c = data["candidate"]
    add("NAME", c["name"].upper())
    if data.get("tagline"):
        add("TAGLINE", data["tagline"])
    # contact: "Location | phone | email | " + linkedin link + " | " + portfolio link
    p = add("CONTACT")
    lead = " | ".join(x for x in [c.get("location"), c.get("phone"), c.get("email")] if x)
    runs = p._p.findall(qn("w:r"))
    lead_t = runs[0].find(qn("w:t"))
    lead_t.text = lead + " | "
    lead_t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    links = [(c.get("linkedinDisplay"), c.get("linkedinUrl")), (c.get("portfolioDisplay"), c.get("portfolioUrl"))]
    links = [l for l in links if l[0] and l[1]]
    hls = p._p.findall(qn("w:hyperlink"))
    for i, h in enumerate(hls):
        if i >= len(links):
            prev = h.getprevious()
            if prev is not None and prev.tag == qn("w:r"):
                p._p.remove(prev)
            p._p.remove(h)
            continue
        disp, url = links[i]
        h.set(qn("r:id"), d.part.relate_to(url, RT.HYPERLINK, is_external=True))
        ts = list(h.iter(qn("w:t")))
        ts[0].text = disp
        for t in ts[1:]:
            t.text = ""
    if not links:
        lead_t.text = lead

    add("HEADING", "PROFESSIONAL SUMMARY")
    add("SUMMARY", data["summary"])

    if data.get("skills"):
        add("HEADING", "TECHNICAL SKILLS")
        for s in data["skills"]:
            add("SKILL", s["items"], bold_label=s["category"])

    add("HEADING", "PROFESSIONAL EXPERIENCE")
    for job in data["experience"]:
        right = "  |  ".join(x for x in [job.get("location"), job.get("period")] if x)
        add("COMPANY", f"{job['company']}\t{right}")
        if job.get("role"):
            add("ROLE", job["role"])
        for proj in job.get("projects", []):
            if proj.get("title"):
                add("PROJECT", proj["title"])
            if proj.get("stack"):
                add("STACK", f"Stack: {proj['stack']}")
            for b in proj.get("bullets", []):
                add("BULLET", b)
        for b in job.get("bullets", []):
            add("BULLET", b)

    if data.get("education"):
        add("HEADING", "EDUCATION")
        for e in data["education"]:
            right = "  |  ".join(x for x in [e.get("location"), e.get("year")] if x)
            add("EDU", f"{e['title']}\t{right}" if right else e["title"])
            if e.get("desc"):
                add("EDUDESC", e["desc"])

    if data.get("certifications"):
        add("HEADING", "CERTIFICATIONS")
        for cert in data["certifications"]:
            add("ITEM", ", ".join(x for x in [cert.get("title"), cert.get("year")] if x))

    if data.get("extracurriculars"):
        add("HEADING", "AWARDS & ACTIVITIES")
        for x in data["extracurriculars"]:
            add("ITEM", x)

    cp = d.core_properties
    cp.author = c["name"]
    cp.title = f"{c['name']} Resume"
    d.save(sys.argv[2])
    print(f"Wrote {sys.argv[2]}")


if __name__ == "__main__":
    main()
