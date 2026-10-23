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
    kept as it is, the link recorded as its source.

Each goes to temple/texts/<slug>.txt (a second or later volume as <slug>-2.txt and so on).
The shelf is rewritten so the book's own link opens the reading room (/temple/read/#slug)
and the source is kept beside it in the meta; temple/texts/index.json is the manifest the
reader uses (title, edition, source, whether OCR). Books with neither source stay links.

    python3 tools/shelf.py            # fetch what is missing, rewrite the shelf and the manifest
    python3 tools/shelf.py --refetch  # fetch everything again

Idempotent: run it twice and the shelf is the same.
"""
import json, os, re, sys, time, html
import urllib.request
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
HOSTS = [("gutenberg.org", "Gutenberg"), ("gnosis.org", "Gnostic Society Library"), ("sacred-texts.com", "sacred-texts"),
         ("archive.org", "Internet Archive"), ("esotericarchives.com", "Esoteric Archives"), ("newadvent.org", "New Advent"),
         ("ccel.org", "the Christian Classics Ethereal Library")]
# A file put there by hand whose text came from somewhere other than the shelf's own link.
HAND = {
    "origen": "https://www.ccel.org/ccel/schaff/anf04.txt",
}

def get(url, timeout=90):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def fetch_gutenberg(n):
    text = get("https://www.gutenberg.org/ebooks/%s.txt.utf-8" % n).decode("utf-8-sig", "replace").replace("\r\n", "\n")
    if "Project Gutenberg" not in text[:2000]:
        raise RuntimeError("not a Gutenberg text: #" + n)
    return text

def fetch_scan(ident):
    meta = json.loads(get("https://archive.org/metadata/%s" % ident))
    files = [f for f in meta.get("files", []) if f.get("format") == "DjVuTXT"]
    if not files:
        raise RuntimeError("no OCR text in " + ident)
    raw = get("https://archive.org/download/%s/%s" % (ident, urllib.request.quote(files[0]["name"]))).decode("utf-8", "replace")
    md = meta.get("metadata", {})
    return clean_ocr(raw), {"title": md.get("title"), "year": (md.get("year") or md.get("date") or "")[:4]}

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

def main():
    refetch = "--refetch" in sys.argv
    os.makedirs(TEXTS, exist_ok=True)
    page = open(PAGE, encoding="utf-8").read()
    manifest = {}
    out = page
    for m in re.finditer(r'<li id="lib-([a-z0-9-]+)">(.*?)</li>', page, re.S):
        slug, body = m.group(1), m.group(2)
        first = re.match(r'<a href="([^"]+)">(.*?)</a>', body, re.S)
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
                src = ref
            if kind == "hand":
                pass
            elif refetch or not os.path.exists(path):
                sys.stderr.write("fetching %s -> %s.txt\n" % (src, name))
                if kind == "gutenberg": text = fetch_gutenberg(ref)
                else: text, info = fetch_scan(ref); entry["scan"] = info
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
                if kind == "hand" and tag not in new:
                    new = new.replace('</span><br>', ' · <a href="%s">%s</a></span><br>' % (ext, tag), 1)
                    continue
                if tag not in new:
                    new = new.replace('</span><br>', ' · <a href="%s">%s</a></span><br>' % (ext if kind == "gutenberg" or "archive.org" not in ext else src, tag), 1)
                if kind == "archive" and "archive.org" not in ext and "Internet Archive" not in new:
                    new = new.replace('</span><br>', ' · scan at the <a href="%s">Internet Archive</a></span><br>' % src, 1)
            elif kind == "gutenberg":
                new = new.replace('<a href="%s">' % src, '<a href="%s" data-gutenberg="%s">' % (local, ref), 1)
        out = out.replace(body, new, 1)
    if out != page:
        open(PAGE, "w", encoding="utf-8").write(out)
    json.dump(manifest, open(os.path.join(TEXTS, "index.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False, sort_keys=True)
    total = sum(v["bytes"] for v in manifest.values())
    print("%d texts, %.1f MB, %d from scans; manifest written" % (len(manifest), total / 1e6, sum(1 for v in manifest.values() if v.get("ocr"))))

if __name__ == "__main__":
    main()
