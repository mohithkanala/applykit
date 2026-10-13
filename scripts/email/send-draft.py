#!/usr/bin/env python3
"""Send an existing Gmail draft (made by imap-draft.py) byte-for-byte as reviewed, then remove it from Drafts.
Run ONLY after the owner has reviewed the draft and approved sending. Use --dry-run first to show recipients/attachments.

Usage: python send-draft.py --user you@gmail.com --pw-file PATH --subject "CTS REQ" [--dry-run]
"""
import argparse, imaplib, smtplib, email, sys
from email.utils import getaddresses


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--user", required=True)
    ap.add_argument("--pw-file", required=True)
    ap.add_argument("--subject", required=True, help="unique substring of the draft subject")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    pw = "".join(open(a.pw_file, encoding="utf-8-sig").read().split())

    M = imaplib.IMAP4_SSL("imap.gmail.com")
    M.login(a.user, pw)
    M.select('"[Gmail]/Drafts"')
    typ, data = M.search(None, "SUBJECT", '"%s"' % a.subject)
    ids = data[0].split() if data and data[0] else []
    if len(ids) != 1:
        M.logout()
        sys.exit(f"expected exactly 1 matching draft, found {len(ids)}; refusing to send")
    typ, msgdata = M.fetch(ids[0], "(RFC822)")
    raw = msgdata[0][1]
    msg = email.message_from_bytes(raw)
    rcpts = [addr for _, addr in getaddresses(msg.get_all("To", []) + msg.get_all("Cc", []) + msg.get_all("Bcc", []))]
    atts = [p.get_filename() for p in msg.walk() if p.get_filename()]
    print("Subject:", msg["Subject"])
    print("To/Cc  :", ", ".join(rcpts))
    print("Attach :", ", ".join(atts) if atts else "NONE")
    if a.dry_run:
        M.logout()
        print("dry run: NOT sent")
        return
    payload = raw
    if msg["Bcc"]:  # never leak Bcc in the sent headers
        del msg["Bcc"]
        payload = msg.as_bytes()
    # Delete the draft BEFORE sending. Gmail merges the sent copy with the draft (same Message-ID),
    # so expunging the draft afterwards can wipe the message from Sent (seen in practice).
    M.store(ids[0], "+FLAGS", "\\Deleted")
    M.expunge()
    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as S:
            S.starttls()
            S.login(a.user, pw)
            S.sendmail(a.user, rcpts, payload)
    except Exception:
        M.append('"[Gmail]/Drafts"', "\\Draft", None, raw)  # put the draft back so nothing is lost
        M.logout()
        raise
    M.logout()
    print("SENT, and removed from Drafts.")


if __name__ == "__main__":
    main()
