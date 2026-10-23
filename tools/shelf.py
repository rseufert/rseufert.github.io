#!/usr/bin/env python3
"""Fetch the library's Project Gutenberg texts into temple/texts/ and point the shelf at them.

Reads the shelf in temple/index.html (every <li id="lib-..."> on the five shelves), and for
each link to www.gutenberg.org/ebooks/N fetches the plain-text file
(https://www.gutenberg.org/ebooks/N.txt.utf-8), whole, with its header and licence as the
licence asks, into temple/texts/<slug>.txt (a second or later volume as <slug>-2.txt and so
on). It then rewrites the shelf so the book's own link opens the local copy in the reader
(/temple/read/#slug) and the Gutenberg page is kept beside it in the meta, and writes
temple/texts/index.json, the manifest the reader uses for titles and sources. Links to other
hosts are left as they are.

    python3 tools/shelf.py            # fetch what is missing, rewrite the shelf and the manifest
    python3 tools/shelf.py --refetch  # fetch everything again

Idempotent: run it twice and the shelf is the same.
"""
import json, os, re, sys, time, html
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "temple", "index.html")
TEXTS = os.path.join(ROOT, "temple", "texts")
UA = {"User-Agent": "rickseufert.com shelf (tools/shelf.py; one fetch a book)"}
GUT = re.compile(r'https://www\.gutenberg\.org/ebooks/(\d+)')

def fetch(n):
    url = "https://www.gutenberg.org/ebooks/%s.txt.utf-8" % n
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    text = data.decode("utf-8-sig", "replace").replace("\r\n", "\n")
    if "Project Gutenberg" not in text[:2000]:
        raise RuntimeError("not a Gutenberg text: " + url)
    return text

def title_of(text):
    m = re.search(r"^Title:\s*(.+)$", text[:4000], re.M)
    return m.group(1).strip() if m else None

def main():
    refetch = "--refetch" in sys.argv
    os.makedirs(TEXTS, exist_ok=True)
    page = open(PAGE, encoding="utf-8").read()
    manifest = {}
    items = list(re.finditer(r'<li id="lib-([a-z0-9-]+)">(.*?)</li>', page, re.S))
    out = page
    for m in items:
        slug, body = m.group(1), m.group(2)
        ids = GUT.findall(body)
        if not ids:
            continue
        # The book's own link is the first <a>; its title is that link's text.
        first = re.match(r'<a href="([^"]+)">(.*?)</a>', body, re.S)
        title = html.unescape(re.sub(r"<[^>]+>", "", first.group(2))).strip()
        meta = re.search(r'<span class="meta">(.*?)</span>', body, re.S)
        edition = html.unescape(re.sub(r"<[^>]+>", "", meta.group(1))).strip() if meta else ""
        new = body
        for k, n in enumerate(ids):
            name = slug if k == 0 else "%s-%d" % (slug, k + 1)
            path = os.path.join(TEXTS, name + ".txt")
            if refetch or not os.path.exists(path):
                sys.stderr.write("fetching %s (#%s) -> %s.txt\n" % (title, n, name))
                text = fetch(n)
                open(path, "w", encoding="utf-8").write(text)
                time.sleep(1.2)
            else:
                text = open(path, encoding="utf-8").read()
            manifest[name] = {"title": title if k == 0 else "%s, %d" % (title, k + 1), "gutenberg": int(n), "edition": edition,
                              "heading": title_of(text), "bytes": os.path.getsize(path), "shelf": slug}
            gut_url = "https://www.gutenberg.org/ebooks/%s" % n
            local = "/temple/read/#" + name
            if k == 0:
                # the book's link opens the reader; Gutenberg stays in the meta
                new = new.replace('<a href="%s">' % gut_url, '<a href="%s">' % local, 1)
                if "Gutenberg #" not in new:
                    new = new.replace('</span><br>', ' · <a href="%s">Gutenberg #%s</a></span><br>' % (gut_url, n), 1)
            else:
                # a later volume: its link opens the reader at that volume
                new = new.replace('<a href="%s">' % gut_url, '<a href="%s" data-gutenberg="%s">' % (local, n), 1)
        out = out.replace(body, new, 1)
    if out != page:
        open(PAGE, "w", encoding="utf-8").write(out)
    json.dump(manifest, open(os.path.join(TEXTS, "index.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False, sort_keys=True)
    total = sum(v["bytes"] for v in manifest.values())
    print("%d texts, %.1f MB, manifest written" % (len(manifest), total / 1e6))

if __name__ == "__main__":
    main()
