#!/usr/bin/env python3
"""Create a Gmail DRAFT (with attachments) via IMAP APPEND. Draft only, never sends.

Why: the claude.ai Gmail connector needs each attachment inlined as base64 in the
tool call, which is unreliable for large files. IMAP APPEND carries the raw bytes
straight to [Gmail]/Drafts, so nothing routes through the model.

App password is read from a file (never printed). Threading: if --thread-from and
--thread-subject are given, we look up the original message's Message-ID in All Mail
and set In-Reply-To/References so Gmail threads the draft under it.

Usage:
  python imap-draft.py --user you@gmail.com --pw-file PATH --from-name "Your Name" \
    --to a@x.com --cc b@x.com --subject "Re: ..." --body-file body.txt \
    --attach r.pdf --attach r.docx \
    --thread-from recruiter@example.com --thread-subject "Job Requirement"
"""
import argparse, imaplib, time, email, mimetypes, sys, os, html
from email.message import EmailMessage
from email.utils import formatdate, make_msgid, formataddr

IMAP_HOST = "imap.gmail.com"
DRAFTS = '"[Gmail]/Drafts"'
ALLMAIL = '"[Gmail]/All Mail"'


def load_pw(path):
    with open(path, "r", encoding="utf-8-sig") as f:
        return "".join(f.read().split())  # drop all whitespace (Google shows 4x4 groups)


def find_thread_headers(M, from_addr, subject_key):
    """Return (message_id, references) of the newest matching original message, or (None, None)."""
    M.select(ALLMAIL, readonly=True)
    typ, data = M.search(None, "FROM", '"%s"' % from_addr, "SUBJECT", '"%s"' % subject_key)
    if typ != "OK" or not data or not data[0]:
        return None, None
    ids = data[0].split()
    typ, msgdata = M.fetch(ids[-1], "(BODY.PEEK[HEADER.FIELDS (MESSAGE-ID REFERENCES)])")
    if typ != "OK" or not msgdata or not msgdata[0]:
        return None, None
    raw = msgdata[0][1].decode("utf-8", "replace")
    hdr = email.message_from_string(raw)
    unfold = lambda v: " ".join(str(v).split()) if v else None  # folded headers carry CRLF
    return unfold(hdr.get("Message-ID")), unfold(hdr.get("References"))


def build(args, in_reply_to, references):
    msg = EmailMessage()
    msg["From"] = formataddr((args.from_name, args.user))
    msg["To"] = ", ".join(args.to)
    if args.cc:
        msg["Cc"] = ", ".join(args.cc)
    msg["Subject"] = args.subject
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain=args.user.split("@")[-1])
    if in_reply_to:
        msg["In-Reply-To"] = in_reply_to
        msg["References"] = ((references + " ") if references else "") + in_reply_to
    with open(args.body_file, "r", encoding="utf-8") as f:
        body = f.read()
    msg.set_content(body)
    # HTML twin: a text/plain-only draft gets hard-wrapped at ~78 chars by Gmail (narrow column).
    paras = html.escape(body).split("\n\n")
    msg.add_alternative("<div dir=\"ltr\">" + "".join(
        "<p>" + p.replace("\n", "<br>") + "</p>" for p in paras) + "</div>", subtype="html")
    for path in args.attach:
        ctype, _ = mimetypes.guess_type(path)
        if path.lower().endswith(".docx"):
            maintype, subtype = "application", "vnd.openxmlformats-officedocument.wordprocessingml.document"
        elif ctype:
            maintype, subtype = ctype.split("/", 1)
        else:
            maintype, subtype = "application", "octet-stream"
        with open(path, "rb") as f:
            msg.add_attachment(f.read(), maintype=maintype, subtype=subtype,
                               filename=os.path.basename(path))
    return msg


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--user", required=True)
    ap.add_argument("--from-name", required=True, help="display name for the From header")
    ap.add_argument("--pw-file", required=True)
    ap.add_argument("--to", action="append", required=True)
    ap.add_argument("--cc", action="append", default=[])
    ap.add_argument("--subject", required=True)
    ap.add_argument("--body-file", required=True)
    ap.add_argument("--attach", action="append", default=[])
    ap.add_argument("--thread-from", default=None)
    ap.add_argument("--thread-subject", default=None)
    args = ap.parse_args()

    for p in args.attach + [args.body_file]:
        if not os.path.exists(p):
            sys.exit(f"missing file: {p}")

    pw = load_pw(args.pw_file)
    M = imaplib.IMAP4_SSL(IMAP_HOST)
    try:
        M.login(args.user, pw)
    except imaplib.IMAP4.error:
        sys.exit("IMAP login failed. Check the app password (16 chars, no spaces) and that IMAP is enabled in Gmail.")

    in_reply_to = references = None
    if args.thread_from and args.thread_subject:
        in_reply_to, references = find_thread_headers(M, args.thread_from, args.thread_subject)
        print("threading under:", in_reply_to or "(original not found; draft will be standalone)")

    msg = build(args, in_reply_to, references)
    typ, resp = M.append(DRAFTS, "\\Draft", imaplib.Time2Internaldate(time.time()), msg.as_bytes())
    M.logout()
    if typ != "OK":
        sys.exit(f"APPEND failed: {resp}")
    print(f"Draft created in {args.user} Drafts with {len(args.attach)} attachment(s). Not sent.")


if __name__ == "__main__":
    main()
