#!/usr/bin/env python3
"""Give every film on the site the still its page shows.

The films on the home page and the project pages are GIFs drawn by mock-films, and they loop.
The page shows each one's still, a PNG, and plays the GIF only when the
visitor clicks it (js/films.js); without the script, the link opens the GIF:

    <figure class="film">
      <a class="play" href="/blog/NAME.gif" ...><img src="/blog/NAME.png" ...></a>
      ...

The still is the film's final frame - the whole exchange, once it has played -
unless the film names another moment with data-poster-ms on its link, the
time in milliseconds of the frame to show. A film in acts may end on its last
act alone, and mock-films names the frame that tells the story better.
This script plays each GIF to its end and writes that frame next to it, so
adding a film is adding the GIF and the markup, and running this.

    python3 tools/film_stills.py           # write any still that is missing or stale
    python3 tools/film_stills.py --check   # fail if one is, or the markup is wrong

The films are the GIFs linked inside `<figure class="film">` on the home page
and on each directory's index.html (mock-sap/, mock-edi/, ...), not whatever
is in blog/, so the check also catches a film whose `<img>` shows the
wrong still. Standard library only, like the projects it shows: a GIF
decoder (LZW, local colour tables, transparency, the three disposal methods,
interlacing) and a PNG writer, which is all `zlib` needs to be told.
"""
import argparse
import os
import re
import struct
import sys
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def pages():
    """The pages that can show a film: the home page, which shows each
    project's first, and the index.html of each directory beside it."""
    found = [os.path.join(ROOT, "index.html")]
    for name in sorted(os.listdir(ROOT)):
        path = os.path.join(ROOT, name, "index.html")
        if not name.startswith(("_", ".")) and os.path.isfile(path):
            found.append(path)
    return found


FIGURE = re.compile(r'<figure class="film">(.*?)</figure>', re.S)
GIF = re.compile(r'<a[^>]*\bclass="play"[^>]*\bhref="(/[^"]+\.gif)"')
STILL = re.compile(r'<img[^>]*\bsrc="(/[^"]+\.png)"')
# The moment the still is taken from, when it is not the last frame.
POSTER = re.compile(r'<a[^>]*\bclass="play"[^>]*\bdata-poster-ms="(\d+)"')


# ---------------------------------------------------------------------------
# GIF: play every frame onto a canvas, and keep the canvas
# ---------------------------------------------------------------------------

def _sub_blocks(data, pos):
    """The bytes of a run of sub-blocks, and where the run ends."""
    out = bytearray()
    while True:
        size = data[pos]
        pos += 1
        if size == 0:
            return bytes(out), pos
        out += data[pos:pos + size]
        pos += size


def _lzw(data, min_code_size, pixel_count):
    """Decode GIF LZW into at most `pixel_count` palette indices."""
    clear = 1 << min_code_size
    end = clear + 1
    size = min_code_size + 1
    table = [bytes([i]) for i in range(clear)] + [b"", b""]
    out = bytearray()
    previous = None
    bits = bitcount = 0
    for byte in data:
        bits |= byte << bitcount
        bitcount += 8
        while bitcount >= size:
            code = bits & ((1 << size) - 1)
            bits >>= size
            bitcount -= size
            if code == clear:
                size = min_code_size + 1
                table = table[:clear + 2]
                previous = None
                continue
            if code == end:
                return bytes(out[:pixel_count])
            if previous is None:
                entry = table[code]
            elif code < len(table):
                entry = table[code]
                table.append(previous + entry[:1])
            else:                       # the code being defined right now
                entry = previous + previous[:1]
                table.append(entry)
            out += entry
            previous = entry
            if len(table) == (1 << size) and size < 12:
                size += 1
    return bytes(out[:pixel_count])


def _deinterlace(indices, width, height):
    rows = [indices[r * width:(r + 1) * width] for r in range(height)]
    order = (list(range(0, height, 8)) + list(range(4, height, 8))
             + list(range(2, height, 4)) + list(range(1, height, 2)))
    placed = [b""] * height
    for source, target in enumerate(order):
        placed[target] = rows[source]
    return b"".join(placed)


def _palette(data, pos, flags):
    count = 2 << (flags & 0x07)
    raw = data[pos:pos + 3 * count]
    return [tuple(raw[i:i + 3]) for i in range(0, len(raw), 3)], pos + 3 * count


def last_frame(path):
    """The canvas once every frame has been drawn."""
    return frame_at(path, None)


def frame_at(path, ms):
    """The canvas a viewer sees `ms` milliseconds into the film, or once every
    frame has been drawn when `ms` is None: (width, height, pixels), each
    pixel an (r, g, b) tuple or None where nothing has been drawn. A time past
    the end is the last frame, which the film holds."""
    with open(path, "rb") as handle:
        data = handle.read()
    if data[:6] not in (b"GIF87a", b"GIF89a"):
        raise ValueError("%s is not a GIF" % path)
    width, height, flags, _background = struct.unpack("<HHBB", data[6:12])
    pos = 13
    global_palette = []
    if flags & 0x80:
        global_palette, pos = _palette(data, pos, flags)
    # A cleared pixel is transparent, not the "background colour" the header
    # names: no browser paints that colour, the page shows through instead,
    # and the still has to show the same thing. None is transparent.
    fill = None
    canvas = [fill] * (width * height)
    disposal, transparent, delay = 0, None, 0
    clock = 0   # when the next frame goes up, in ms
    # The previous frame's disposal, carried out only when another frame
    # arrives: the last frame's is never done, because it is what the film
    # ends on - and a comment block after it must not count as a next frame.
    pending = None
    while pos < len(data):
        marker = data[pos]
        pos += 1
        if marker == 0x3B:                                  # trailer
            break
        if marker == 0x21:                                  # extension
            label = data[pos]
            block, pos = _sub_blocks(data, pos + 1)
            if label == 0xF9 and len(block) >= 4:           # graphic control
                disposal = (block[0] >> 2) & 0x07
                transparent = block[3] if block[0] & 0x01 else None
                delay = struct.unpack("<H", block[1:3])[0]
            continue
        if marker != 0x2C:
            raise ValueError("%s: unexpected block 0x%02x at %d" % (path, marker, pos - 1))
        left, top, w, h, image_flags = struct.unpack("<HHHHB", data[pos:pos + 9])
        pos += 9
        palette = global_palette
        if image_flags & 0x80:
            palette, pos = _palette(data, pos, image_flags)
        min_code_size = data[pos]
        compressed, pos = _sub_blocks(data, pos + 1)
        indices = _lzw(compressed, min_code_size, w * h)
        if image_flags & 0x40:
            indices = _deinterlace(indices, w, h)

        # A frame that goes up after `ms` is not seen yet: what is on the
        # canvas now, the previous frame and its disposal not yet done, is.
        if ms is not None and pending and clock > ms:
            return width, height, canvas
        # Browsers show a delay of 0 or 1 hundredths of a second as 10.
        clock += (delay if delay > 1 else 10) * 10

        if pending:
            done, done_rect, done_saved = pending
            if done == 2:                                   # restore to background
                for y, x in done_rect:
                    canvas[y * width + x] = fill
            elif done == 3:                                 # restore to previous
                for (y, x), pixel in zip(done_rect, done_saved):
                    canvas[y * width + x] = pixel

        rect = [(y, x) for y in range(top, min(top + h, height))
                for x in range(left, min(left + w, width))]
        saved = ([canvas[y * width + x] for y, x in rect]
                 if disposal == 3 else None)
        for (y, x), index in zip(rect, indices):
            if index != transparent and index < len(palette):
                canvas[y * width + x] = palette[index]
        pending = (disposal, rect, saved)
        disposal, transparent, delay = 0, None, 0
    return width, height, canvas


# ---------------------------------------------------------------------------
# PNG: a palette image when it fits in one, which a film always does
# ---------------------------------------------------------------------------

def _chunk(kind, body):
    return (struct.pack(">I", len(body)) + kind + body
            + struct.pack(">I", zlib.crc32(kind + body) & 0xFFFFFFFF))


def png(width, height, pixels):
    """PNG bytes for the pixels, the same bytes every time for the same image."""
    clear = None in pixels
    # Transparent first, so a single tRNS byte covers it.
    colours = ([None] if clear else []) + sorted(set(pixels) - {None})
    if len(colours) <= 256:
        lookup = {colour: i for i, colour in enumerate(colours)}
        raw = b"".join(b"\x00" + bytes(lookup[p] for p in pixels[y * width:(y + 1) * width])
                       for y in range(height))
        header = struct.pack(">IIBBBBB", width, height, 8, 3, 0, 0, 0)
        extra = _chunk(b"PLTE", b"".join(bytes(c or (0, 0, 0)) for c in colours))
        if clear:
            extra += _chunk(b"tRNS", b"\x00")
    else:
        raw = b"".join(b"\x00" + b"".join(bytes(p or (0, 0, 0)) + (b"\x00" if p is None else b"\xff")
                                          for p in pixels[y * width:(y + 1) * width])
                       for y in range(height))
        header = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
        extra = b""
    return (b"\x89PNG\r\n\x1a\n" + _chunk(b"IHDR", header) + extra
            + _chunk(b"IDAT", zlib.compress(raw, 9)) + _chunk(b"IEND", b""))


def read_png(data):
    """(width, height, pixels) from 8-bit RGB or RGBA, or 1-, 2-, 4- or 8-bit
    palette PNG bytes (what an encoder picks for a small palette), in
    the form `last_frame` returns, or None for a PNG this cannot read. Enough
    to compare a still that another tool wrote - mock-films, say - by what it
    shows rather than by its bytes."""
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    pos, idat, palette, alpha = 8, bytearray(), [], b""
    width = height = colour_type = None
    while pos + 8 <= len(data):
        length, kind = struct.unpack(">I4s", data[pos:pos + 8])
        body = data[pos + 8:pos + 8 + length]
        pos += 12 + length
        if kind == b"IHDR":
            width, height, depth, colour_type, _, _, interlace = struct.unpack(">IIBBBBB", body)
            if interlace or colour_type not in (2, 3, 6):
                return None
            if depth not in ((1, 2, 4, 8) if colour_type == 3 else (8,)):
                return None
        elif kind == b"PLTE":
            palette = [tuple(body[i:i + 3]) for i in range(0, len(body), 3)]
        elif kind == b"tRNS":
            alpha = body
        elif kind == b"IDAT":
            idat += body
    if width is None:
        return None
    # Filtering works on bytes: a pixel is `step` bytes back, and a row of
    # sub-byte palette indices is packed into `stride` bytes.
    channels = {2: 3, 3: 1, 6: 4}[colour_type]
    stride = (width * channels * depth + 7) // 8
    step = max(1, channels * depth // 8)
    raw = zlib.decompress(bytes(idat))
    rows, previous = [], bytearray(stride)
    for y in range(height):
        kind, line = raw[y * (stride + 1)], bytearray(raw[y * (stride + 1) + 1:(y + 1) * (stride + 1)])
        for i in range(stride):
            left = line[i - step] if i >= step else 0
            up = previous[i]
            corner = previous[i - step] if i >= step else 0
            if kind == 1:
                line[i] = (line[i] + left) & 0xFF
            elif kind == 2:
                line[i] = (line[i] + up) & 0xFF
            elif kind == 3:
                line[i] = (line[i] + (left + up) // 2) & 0xFF
            elif kind == 4:
                guess = left + up - corner
                pa, pb, pc = abs(guess - left), abs(guess - up), abs(guess - corner)
                line[i] = (line[i] + (left if pa <= pb and pa <= pc else up if pb <= pc else corner)) & 0xFF
        rows.append(bytes(line))
        previous = line
    pixels = []
    for line in rows:
        for x in range(width):
            if colour_type == 3:
                if depth == 8:
                    index = line[x]
                else:
                    bit = x * depth
                    index = (line[bit // 8] >> (8 - depth - bit % 8)) & ((1 << depth) - 1)
                clear = index < len(alpha) and alpha[index] == 0
                pixels.append(None if clear else palette[index])
            elif colour_type == 2:
                pixels.append(tuple(line[3 * x:3 * x + 3]))
            else:
                r, g, b, a = line[4 * x:4 * x + 4]
                pixels.append(None if a == 0 else (r, g, b))
    return width, height, pixels


# ---------------------------------------------------------------------------

def films(page_html):
    """(gif, still, poster_ms) for every film on the page: site paths, still
    None when the figure shows no PNG, and poster_ms None for the last frame."""
    found = []
    for figure in FIGURE.findall(page_html):
        gif = GIF.search(figure)
        if gif:
            still = STILL.search(figure)
            poster = POSTER.search(figure)
            found.append((gif.group(1), still.group(1) if still else None,
                          int(poster.group(1)) if poster else None))
    return found


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--check", action="store_true",
                        help="write nothing; fail if a still is missing, stale or not linked")
    args = parser.parse_args(argv)

    # A film can be on two pages, the home page and its project's; it is one
    # film with one still, so both have to name the same moment.
    listed, problems, written = [], [], []
    for page in pages():
        with open(page, encoding="utf-8") as handle:
            for film in films(handle.read()):
                if film in listed:
                    continue
                if any(film[0] == other[0] for other in listed):
                    problems.append("%s is on two pages with a different still or "
                                    "data-poster-ms; %s has the odd one"
                                    % (film[0], os.path.relpath(page, ROOT)))
                    continue
                listed.append(film)
    if not listed:
        print("no <figure class=\"film\"> on any page; nothing to do")
        return 0

    for gif, still, poster_ms in listed:
        expected = gif[:-len(".gif")] + ".png"
        if still is None:
            problems.append("%s's figure shows no still; its <img> should be "
                            'src="%s"'
                            % (gif, expected))
            still = expected
        elif still != expected:
            problems.append("%s's <img> shows %s; its still is %s" % (gif, still, expected))
            still = expected
        gif_file = os.path.join(ROOT, gif.lstrip("/"))
        still_file = os.path.join(ROOT, still.lstrip("/"))
        if not os.path.exists(gif_file):
            problems.append("%s is on the page but not in the repository" % gif)
            continue
        frame = frame_at(gif_file, poster_ms)
        wanted = png(*frame)
        try:
            with open(still_file, "rb") as handle:
                # Compared by what it shows, so a still another tool wrote is
                # current as long as it is the right picture.
                current = read_png(handle.read()) == frame
        except IOError:
            current = False
        if current:
            continue
        if args.check:
            problems.append("%s is missing or is not %s's frame at %s" % (
                still, gif, "%d ms" % poster_ms if poster_ms is not None else "the end"))
        else:
            with open(still_file, "wb") as handle:
                handle.write(wanted)
            written.append("%s (%d KB)" % (still, (len(wanted) + 1023) // 1024))

    for line in written:
        print("wrote %s" % line)
    if problems:
        for problem in problems:
            print(problem, file=sys.stderr)
        print("\n%d problem(s). `python3 tools/film_stills.py` writes the stills; "
              "the markup is the page's." % len(problems), file=sys.stderr)
        return 1
    if not written:
        print("%d film(s), each with a current still" % len(listed))
    return 0


if __name__ == "__main__":
    sys.exit(main())
