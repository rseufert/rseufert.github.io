#!/usr/bin/env python3
"""Keep the library's texts in temple/texts/ and point the shelf at them.

Reads the shelf in temple/index.html (every <li id="lib-..."> on the five shelves) and
fetches a copy of each book it can:

  * a link to www.gutenberg.org/ebooks/N: the plain-text file
    (https://www.gutenberg.org/ebooks/N.txt.utf-8), kept whole with its header and licence,
    as the licence asks;
  * a book in SCANS below: the OCR text of a public-domain scan at the Internet Archive
    (the item's DjVuTXT file), cleaned a little (hyphens at line ends joined, page numbers
    and running heads dropped) and marked in the manifest as OCR, uncorrected;
  * a file already at temple/texts/<slug>.txt, put there by hand from the book's own link:
    kept as it is, the link recorded as its source;
  * a text in FREE below, not public domain but freely redistributable by its author's word:
    fetched as plain text (HTML stripped, cut between two markers) and marked so.

Each goes to temple/texts/<slug>.txt (a second or later volume as <slug>-2.txt and so on).
The shelf is rewritten so the book's own link opens the reading room (/temple/read/#slug)
and the source is kept beside it in the meta; temple/texts/index.json is the manifest the
reader uses (title, edition, source, whether OCR). Books with neither source stay links.

    python3 tools/shelf.py            # fetch what is missing, rewrite the shelf and the manifest
    python3 tools/shelf.py --refetch  # fetch everything again

Idempotent: run it twice and the shelf is the same.
"""
import json, os, re, sys, time, html
import urllib.request, urllib.error
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "temple", "index.html")
TEXTS = os.path.join(ROOT, "temple", "texts")
UA = {"User-Agent": "rickseufert.com shelf (tools/shelf.py; one fetch a book)"}
GUT = re.compile(r'https://www\.gutenberg\.org/ebooks/(\d+)')

# Scans at the Internet Archive for the books that are not on Gutenberg: the shelf's slug,
# then the item identifiers, one a volume, each the edition the shelf names.
SCANS = {
    "pistis": ["pistissophiagnos1921mead"],
    "fragments": ["fragmentsoffaith00meaduoft"],
    "pearl": ["hymnoftherobe10meaduoft"],
    "logia": ["logiaiesousaying00gren"],
    "king": ["gnosticsandtheir00kinguoft"],
    "thrice": ["thricegreatesthe01hermuoft", "thricegreatesthe02hermuoft", "thricegreatesthe03hermuoft"],
    "virgin": ["1885-kingsford-maitland-virgin-of-the-world"],
    "yetzirah": ["sepheryetzirahb00rittgoog"],
    "kabbalah-unveiled": ["b24884443"],
    "key": ["b24884431"],
    "goetia": ["ac_goetia"],
    "moses": ["sixthandseventh00schegoog"],
    "enoch": ["bookofenoch0000unse"],
    "cloud": ["bookofcontemplat00unde"],
    "dionysius": ["theworksofdionys00dionuoft", "worksofdionysius02pseu"],
    "upanishads": ["upanishads01ml"],
}
# Texts that are not public domain but freely redistributable by their authors' word (the shelf
# note says so): fetched as plain text, HTML stripped, cut between two markers when given.
FREE = {   # slug: (address, start marker, end marker, a title to put in front), the markers cutting the page's furniture off
    "jargon": ("http://www.catb.org/jargon/oldversions/jarg447.txt", None, None, None),
    "gnu": ("https://www.gnu.org/gnu/manifesto.html", "The GNU Manifesto (which appears below)", "Copyright Infringement Notification", "The GNU Manifesto\nRichard Stallman, 1985\n\n"),
    "barlow": ("https://www.eff.org/cyberspace-independence", "Governments of the Industrial World", "Back to top", "A Declaration of the Independence of Cyberspace\nJohn Perry Barlow, Davos, February 8, 1996\n\n"),
    "rfc1149": ("https://www.rfc-editor.org/rfc/rfc1149.txt", None, None, None),
    "rfc1925": ("https://www.rfc-editor.org/rfc/rfc1925.txt", None, None, None),
    "mentor": ("http://phrack.org/archives/issues/7/3.txt", "==Phrack Inc.==", None, None),
    "nechayev": ("https://www.marxists.org/subject/anarchism/nechayev/catechism.htm", "1. The revolution", "Anarchism Archive", "Catechism of a Revolutionist\nSergey Nechayev, 1869\n\n"),
}
HOSTS = [("gutenberg.org", "Gutenberg"), ("gnosis.org", "Gnostic Society Library"), ("sacred-texts.com", "sacred-texts"),
         ("archive.org", "Internet Archive"), ("esotericarchives.com", "Esoteric Archives"), ("newadvent.org", "New Advent"),
         ("ccel.org", "the Christian Classics Ethereal Library"), ("catb.org", "catb.org"), ("gnu.org", "gnu.org"), ("eff.org", "the EFF"),
         ("rfc-editor.org", "the RFC Editor"), ("phrack.org", "Phrack"), ("marxists.org", "marxists.org")]
# A file put there by hand whose text came from somewhere other than the shelf's own link.
HAND = {
    "keys": "https://archive.org/details/aleister-crowley-liber-chanokh",
    "origen": "https://www.ccel.org/ccel/schaff/anf04.txt",
    "irenaeus": "https://www.ccel.org/ccel/schaff/anf01.txt",
}

def get(url, timeout=90):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def fetch_gutenberg(n):
    # The plain-text file lives at one of a few addresses, by the book's age.
    for url in ("https://www.gutenberg.org/ebooks/%s.txt.utf-8" % n, "https://www.gutenberg.org/cache/epub/%s/pg%s.txt" % (n, n),
                "https://www.gutenberg.org/files/%s/%s-0.txt" % (n, n), "https://www.gutenberg.org/files/%s/%s.txt" % (n, n)):
        try:
            text = get(url).decode("utf-8-sig", "replace").replace("\r\n", "\n")
        except urllib.error.HTTPError as e:
            if e.code == 404: continue
            raise
        if "Project Gutenberg" in text[:2000]:
            return text
    # A newer book may have only the HTML; take that, tags off.
    raw = get("https://www.gutenberg.org/cache/epub/%s/pg%s-images.html" % (n, n)).decode("utf-8", "replace")
    raw = re.sub(r"(?is)<(script|style)\b.*?</\1>", "", raw)
    raw = re.sub(r"(?i)<br\s*/?>", "\n", raw)
    raw = re.sub(r"(?i)</(p|div|h[1-6]|li|tr|blockquote|pre|table)>", "\n\n", raw)
    text = html.unescape(re.sub(r"<[^>]+>", "", raw)).replace("\r\n", "\n")
    text = re.sub(r"[ \t]+\n", "\n", text); text = re.sub(r"\n{3,}", "\n\n", text).strip() + "\n"
    if "Project Gutenberg" not in text[:3000]:
        raise RuntimeError("no text for Gutenberg #" + n)
    return text

def fetch_scan(ident):
    meta = json.loads(get("https://archive.org/metadata/%s" % ident))
    files = [f for f in meta.get("files", []) if f.get("format") == "DjVuTXT"]
    if not files:
        raise RuntimeError("no OCR text in " + ident)
    raw = get("https://archive.org/download/%s/%s" % (ident, urllib.request.quote(files[0]["name"]))).decode("utf-8", "replace")
    md = meta.get("metadata", {})
    return clean_ocr(raw), {"title": md.get("title"), "year": (md.get("year") or md.get("date") or "")[:4]}

def fetch_free(url, start, end, title=None):
    raw = get(url).decode("utf-8", "replace")
    if "<html" in raw[:2000].lower() or "<!doctype" in raw[:200].lower():
        raw = re.sub(r"(?s)<!--.*?-->", "", raw)
        raw = re.sub(r"(?is)<(script|style|nav|header|footer)\b.*?</\1>", "", raw)
        raw = re.sub(r"(?i)<br\s*/?>", "\n", raw)
        raw = re.sub(r"(?i)</(p|div|h[1-6]|li|tr|blockquote|pre)>", "\n\n", raw)
        raw = re.sub(r"<[^>]+>", "", raw)
        raw = html.unescape(raw)
    raw = raw.replace("\r\n", "\n")
    if start and start in raw: raw = raw[raw.index(start):]
    if end and end in raw: raw = raw[:raw.index(end)]
    raw = re.sub(r"[ \t]+\n", "\n", raw)
    raw = re.sub(r"\n{3,}", "\n\n", raw)
    return (title or "") + raw.strip() + "\n"

def clean_ocr(t):
    t = t.replace("\r\n", "\n").replace("\f", "\n\n")
    t = re.sub(r"(\w)-\n(?=[a-z])", r"\1", t)                          # a word broken at a line end
    t = re.sub(r"[ \t]{2,}", " ", t)                                     # the OCR's double spaces
    lines = t.split("\n")
    short = Counter(l.strip() for l in lines if 0 < len(l.strip()) < 60)
    heads = {l for l, n in short.items() if n >= 10 and not re.match(r"^[\d\W]*$", l)}   # running heads
    out = []
    for l in lines:
        s = l.strip()
        if s in heads: continue
        if re.match(r"^[\divxlcIVXLC]{1,6}$", s): continue                # a page number
        if re.match(r"^[\W_]{1,4}$", s): continue                       # a stray mark
        out.append(l.rstrip())
    t = "\n".join(out)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip() + "\n"

def label(url):
    for host, name in HOSTS:
        if host in url: return name
    return "the source"

# The marks: what each entry is, from the manifest (kept whole, a scan's
# OCR, made here, a link out), and the places to start, from the page's own
# "where to start" list. Written before each entry's link, replacing any
# already there, so the pass is idempotent; the manifest learns them too.
ROBUST = {
    "whole": ("\u25cf", "kept here whole, as plain text"),
    "ocr": ("\u25d0", "kept here as a scan's OCR, uncorrected"),
    "drawn": ("\u25c6", "made here rather than kept"),
    "link": ("\u25cb", "a link out; not kept here"),
}
START = re.compile(r'<ol class="start"[^>]*>(.*?)</ol>', re.S)
LI = re.compile(r'<li id="lib-([a-z0-9-]+)"(?: class="[^"]*")?>\s*(?:<span class="(?:mark|pick)"[^>]*>[^<]*</span>\s*)*(?=<a href="([^"]+)")')
def marks(page, manifest):
    m = START.search(page)
    picks = set(re.findall(r'href="#lib-([a-z0-9-]+)"', m.group(1))) if m else set()
    def one(mm):
        slug, href = mm.group(1), mm.group(2)
        kind = ("ocr" if manifest[slug].get("ocr") else "whole") if slug in manifest else ("drawn" if href.startswith("/temple/") else "link")
        glyph, what = ROBUST[kind]
        pre = '<span class="mark" data-robust="%s" title="%s">%s</span>' % (kind, what, glyph)
        if slug in picks: pre += '<span class="pick" title="a place to start">\u2606</span>'
        return '<li id="lib-%s"%s>%s ' % (slug, ' class="pick"' if slug in picks else '', pre)
    for name, entry in manifest.items():
        entry["robust"] = "ocr" if entry.get("ocr") else "whole"
        if entry.get("shelf") in picks: entry["pick"] = True
        else: entry.pop("pick", None)
    return LI.sub(one, page)

def main():
    refetch = "--refetch" in sys.argv
    os.makedirs(TEXTS, exist_ok=True)
    page = open(PAGE, encoding="utf-8").read()
    manifest = {}
    out = page
    for m in re.finditer(r'<li id="lib-([a-z0-9-]+)"[^>]*>(.*?)</li>', page, re.S):
        slug, body = m.group(1), m.group(2)
        first = re.search(r'<a href="([^"]+)">(.*?)</a>', body, re.S)
        title = html.unescape(re.sub(r"<[^>]+>", "", first.group(2))).strip()
        # The book's source: its own link, or, once that opens the reading room, the first link out.
        ext = first.group(1)
        if ext.startswith("/temple/read/"):
            links = re.findall(r'<a href="(https?://[^"]+)"', body)
            ext = links[0] if links else ext
        meta = re.search(r'<span class="meta">(.*?)</span>', body, re.S)
        edition = html.unescape(re.sub(r"<[^>]+>", "", meta.group(1))).strip() if meta else ""
        gut = GUT.findall(body)
        sources = [("gutenberg", n) for n in gut] if gut else [("archive", i) for i in SCANS.get(slug, [])]
        # A file put there by hand (temple/texts/<slug>.txt with no Gutenberg or scan source) is kept as it is.
        if not sources and slug in FREE:
            sources = [("free", FREE[slug][0])]
            ext = FREE[slug][0]                                         # the source, whatever the shelf's link has become
        if not sources and os.path.exists(os.path.join(TEXTS, slug + ".txt")):
            sources = [("hand", HAND.get(slug, ext))]
        if not sources:
            continue
        new = body
        for k, (kind, ref) in enumerate(sources):
            name = slug if k == 0 else "%s-%d" % (slug, k + 1)
            path = os.path.join(TEXTS, name + ".txt")
            entry = {"title": title if k == 0 else "%s, %d" % (title, k + 1), "edition": edition, "shelf": slug}
            if kind == "gutenberg":
                entry["gutenberg"] = int(ref)
                src = "https://www.gutenberg.org/ebooks/%s" % ref
            elif kind == "archive":
                entry["archive"] = ref; entry["ocr"] = True
                src = "https://archive.org/details/%s" % ref
            else:
                entry["source"] = ref; entry["host"] = label(ref)
                if kind == "free": entry["free"] = True
                src = ref
            if kind == "hand":
                pass
            elif refetch or not os.path.exists(path):
                sys.stderr.write("fetching %s -> %s.txt\n" % (src, name))
                try:
                    if kind == "gutenberg": text = fetch_gutenberg(ref)
                    elif kind == "free": text = fetch_free(*FREE[slug])
                    else: text, info = fetch_scan(ref); entry["scan"] = info
                except Exception as e:
                    # No text to be had: the book stays a link, and the run goes on.
                    sys.stderr.write("  no text: %s\n" % e)
                    time.sleep(1.2)
                    continue
                open(path, "w", encoding="utf-8").write(text)
                time.sleep(1.2)
            elif kind == "archive":
                old = json.load(open(os.path.join(TEXTS, "index.json"))) if os.path.exists(os.path.join(TEXTS, "index.json")) else {}
                if name in old and "scan" in old[name]: entry["scan"] = old[name]["scan"]
            entry["bytes"] = os.path.getsize(path)
            manifest[name] = entry
            local = "/temple/read/#" + name
            if k == 0:
                # the book's own link opens the reading room (once; a link already local is left); the source stays in the meta
                if first.group(1) == ext:
                    new = new.replace('<a href="%s">' % ext, '<a href="%s">' % local, 1)
                tag = ('Gutenberg #%s' % ref) if kind == "gutenberg" else label(ext)
                shown = ('>%s</a>' % tag) in new                    # the source already named in the meta
                if kind in ("hand", "free"):
                    if not shown and ext.startswith("http"):
                        new = new.replace('</span><br>', ' · <a href="%s">%s</a></span><br>' % (ext, tag), 1)
                    continue
                if not shown:
                    new = new.replace('</span><br>', ' · <a href="%s">%s</a></span><br>' % (ext if kind == "gutenberg" or "archive.org" not in ext else src, tag), 1)
                if kind == "archive" and "archive.org" not in ext and "Internet Archive" not in new:
                    new = new.replace('</span><br>', ' · scan at the <a href="%s">Internet Archive</a></span><br>' % src, 1)
            elif kind == "gutenberg":
                new = new.replace('<a href="%s">' % src, '<a href="%s" data-gutenberg="%s">' % (local, ref), 1)
        out = out.replace(body, new, 1)
    out = marks(out, manifest)
    if out != page:
        open(PAGE, "w", encoding="utf-8").write(out)
    json.dump(manifest, open(os.path.join(TEXTS, "index.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False, sort_keys=True)
    total = sum(v["bytes"] for v in manifest.values())
    print("%d texts, %.1f MB, %d from scans; manifest written" % (len(manifest), total / 1e6, sum(1 for v in manifest.values() if v.get("ocr"))))

if __name__ == "__main__":
    main()
