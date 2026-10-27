# rickbot

The `[chat]` tab in the corner of every page. It is a helpdesk bot for a few
turns, then it confesses: reality has been hacked by extradimensional machine
elves, who came through the strip under the menu, and the window becomes a
text adventure through a dungeon made of the site.

| file | what |
| --- | --- |
| `chat.js` | the whole thing: the bot, the dungeon, the ending; loaded by the layout on every page |
| `chat.css` | the window, the tab, the wave, the glitch; linked by the layout |
| `tools/guestbook.py`, `.github/workflows/guestbook.yml` | the guest book, compiled from issues |
| `data/guestbook.json` | the guest book's fallback copy on master |

## Stages

The state lives in `localStorage` under `rickbot` and carries from page to
page; `RESET` starts over.

1. **bot**: a helpdesk persona. `ANSWERS` is an ordered list of regexes and
   replies about the site, the mocks, the Flipper apps, the dashboard, the
   music, Rick (comically: 6'13"), the Buffalo Bills, the toys; `GLOSSARY`
   defines terms (exact term first, loose match after the answers); `calc()`
   does sums; it knows the time and some small talk. From turn 3 it drops
   omens. On turn 5, or on a trigger word, it reveals the hack, describing
   it for a phone or a desktop as appropriate.
2. **dungeon**: a Zork-style parser (LOOK, EXAMINE, TAKE, DROP, USE, GIVE,
   TALK, MAP, HINT, directions) over rooms made of the site: the page, the
   footer, the menu, the SAP vault, the EDI corridor, the mock bank,
   /dev/reality, the dashboard, the Willamette gauge, the Flipper nest, the
   arena, the media loft, the elf bazaar, inside the Julia set. The puzzle
   chain: an 850 from the vault, fed to the altar in the corridor, gives a
   997, which opens the gate to the bank; the bank's statement names the
   token; the Flipper at the loft's RFID reader opens the bazaar; the elves
   are cold and trade for the beanie in the footer's box; REBOOT with the
   token in /dev/reality escapes. `HINT` knows where you are in the chain.
3. **ending**: a banner, the stats and a rank, the `elves` event that puts the
   elves' palette on the strip and dreams the home page's photo through a
   Julia set (`js/hero.js`; both check `localStorage.elf`), a local high score
   table (`rickbot-scores`), and the guest book.

## The guest book

Web 0.9 style, shared. `SIGN` opens a prefilled GitHub issue on this repo
titled `guestbook: NAME`. `guestbook.yml` runs on issue events and daily,
compiles the open ones with `tools/guestbook.py` (the house entry, RICK with
69,420,000 points, first) into `guestbook.json` on the `sky-data` branch, and
the chat reads it from raw.githubusercontent.com, falling back to
`data/guestbook.json`. Close an issue to take an entry out.

## Hooks from the other toys

Other components reach into the dungeon rather than the other way round:
the arena room's `FIGHT` loads `arena/arena-engine.js` and the presets on
demand and runs a match headlessly in the log; `/dev/reality` has a hatch,
and `NOCLIP` links down to the backrooms; the bot's answers about the arena
and the backrooms read their `localStorage` to say how you did. The tab
wears a 🤖👋 and wiggles until it has been opened once (`rickbot-seen`).

## Gematria

"The number of X" or "gematria of X" counts the word by Agrippa's Latin
table (A 1 … K 10 … T 100 … Z 500, with J, U and W as he counted the
consonant I and V), shows the working, and points at the talisman press,
which traces the same number on a planet's square.

## The hour

"What sign is the moon in", "horoscope", "is mercury retrograde", "what's
rising" get the sky from `js/zodiac.js`, fetched on the first asking: each
of the seven with its degree, its decan and the decan's tarot card, the
ascendant over Portland; "draw me a card" or "tarot" cuts the deck for one
card, named with its Book T title, and points at the deck for Waite's
reading and the card the Sun stands in.

"I Ching" or "hexagram", "year of the" or "fire horse" or "four pillars",
and "lenormand" or "grand tableau" each point at their room in the temple.

"Whose hour is it" (or "which planetary hour", "hour of mars", "whose day
is it") gets the planetary hour from `js/hours.js`, fetched on the first
asking and answered through the promise queue: the planet, which hour of
whose day, when it ends and what follows. The same module tunes the
temple's drone and prints the paper's table.

## The shelf

Ask rickbot for a passage, or for a book on the temple's shelf by its
title or its author ("what does kropotkin say"), and it fetches the
library's manifest (`temple/texts/index.json`, once, on the first
question), picks the book, fetches the local text, quotes a real paragraph
of it (140 to 420 characters, not a footnote, not capitals, not the
bookseller's catalogue at the back of a scan), and attributes it to the
wrong author, with the link to the right book. Asked for any book, it
takes one of the shelf's "where to start" picks (`pick` in the manifest)
two times in three. A reply can be a promise:
the queue keeps "rickbot is reading" up until it resolves; the shelf rule
is the first in `ANSWERS` and declines (returns null) when nothing on the
shelf is meant, so the other rules are tried; and the reveal never quotes
a promise.
