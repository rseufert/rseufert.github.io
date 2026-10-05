---
layout: post
title: "A Direct Debit Can Still Come Back"
date: 2026-10-05
description: >-
  Collecting by direct debit against mock-bank: a pain.008 the bank half
  rejects on arrival, and a collection that is credited and then sent back three
  business days later. Why credited is not the same as collected, and how to
  test the return without waiting for one.
image: /blog/bank_dd_returned_film.png
---

<figure class="film">
	<a class="play" href="/blog/bank_dd_film.gif" data-poster-ms="22100" title="play the film"><img src="/blog/bank_dd_film.png" width="800" height="450" alt="ACME sends mock-bank the bank's own sample file of four direct debits to collect in euro, and the bank's status report rejects two with a reason for each: one debtor, a seeded account, has 12.50 against the 340.00 asked, and the other's account is closed. The bank's own queue says a credit notification is due on the settlement day, which the film shows as a promise. The capture then advances the bank's clock twice: the other two collections, one from an account the bank does not hold, which it treats as being at another bank, and one from Eurodis, an account it does hold and has nothing against, are booked and credited to ACME in the credit notification, which keeps the promise, and then in a statement closing at 127750.50. The rejected two appear in neither."></a>
	<figcaption>four direct debits, half of them rejected <span>drawn by mock-films from a real run</span></figcaption>
</figure>

Until these two films, every mock-bank film was money going out: a file of payments, the same in NACHA, a payment that comes back. This one goes the other way. ACME is the creditor, and the file it sends is a `pain.008` with four direct debits, collecting from four debtors under their mandates. mock-films drew it from a real run, and the amounts are the ones in the sample file mock-bank ships, so you can send the same file yourself (see [Run it](#run-it)). Click it to play.

## Half of it fails on arrival

Two of the four are refused before any money moves, in the `pain.002` that answers the file:

- `DD-2026-0102` is `AM04`: Globex, a debtor account the bank holds, has 12.50, and the collection asks for 340.00.
- `DD-2026-0103` is `AC04`: Initech's account is closed.

So the file's status is `PART`, neither `ACCP` nor `RJCT`. A collector that reads the file's status and stops there books four collections or none, and both are wrong. The answer that matters is the one per collection.

The other two are accepted. One debtor is at another bank, so there is nothing this bank can know about it, and the other is Eurodis, an account the bank holds and has nothing against. On the settlement day, Thursday 1 October, both are booked, a `camt.054` credits them to ACME, and the day's statement closes at 127,750.50. The rejected two appear in neither.

## Credited is not collected

<figure class="film">
	<a class="play" href="/blog/bank_dd_returned_film.gif" title="play the film"><img src="/blog/bank_dd_returned_film.png" width="800" height="450" loading="lazy" alt="ACME collects 1500.50 euro by direct debit from Eurodis, whose account the script has set to send a collection back after the mock's default of three business days. The bank accepts it, and its queue says a credit notification is due on the settlement day, which the film shows as a promise. The clock moves to that day: the collection is booked, the credit notification keeps the promise, and the bank now owes two more messages, a return and a debit notification, both due the Tuesday after the weekend. The clock moves to that Tuesday and the bank keeps both: the return gives the reason AC04, with the dates it settled and was returned, and the debit takes the 1500.50 back out of ACME's account. A day later a statement closes at 125000.00, where the one before it closed at 126500.50."></a>
	<figcaption>a direct debit collected, credited, then sent back <span>drawn by mock-films from a real run</span></figcaption>
</figure>

The second film is the case worth the trouble. Eurodis's collection of 1,500.50 is accepted, settled and credited, exactly like the first film's. Then, three business days later, it comes back.

Nothing about the credit warned that it might. Once it books, the bank owes two more messages, both due the Tuesday after the weekend: a `pacs.004` returning the collection with the reason `AC04` and the dates it settled and was returned, and a `camt.054` debit taking the 1,500.50 back out of ACME's account. The statement before the return closed at 126,500.50, and the one after it closes at 125,000.00.

It is the mirror image of [the returned payment](/mock-bank/), where a payment ACME sent comes back. There, money that left returns; here, money that arrived leaves again. Both look settled at the moment most code decides they are.

## What that means for the code that receives it

A credited collection feels like cash, and the code around it usually treats it that way: the customer's invoice is closed against the credit, the dunning stops, the order ships. The return arrives days later, as a different message, and has to undo all of that. So these are the tests a collector needs, and the two films make them cheap:

- **Read each collection's outcome, not the file's.** A `PART` file has both kinds in it.
- **Close nothing on the `pain.002`.** Accepted means the bank will try. The credit is the `camt.054` on the settlement day.
- **Expect the credit to be taken back.** A return names the original `EndToEndId`, so the invoice it paid can be found and reopened. It should read as paid and returned, not as never paid, because what happens next (chase the customer, collect again, ask for a new mandate) depends on which.
- **Reconcile against the statement after the return**, not the one before it.

Three business days is the gentle version. Under SEPA Core a debtor can ask for an authorised collection back for eight weeks after it was debited, with no reason needed.

## Run it

The sample file collects for ACME from the four accounts mock-bank starts with, so nothing needs setting up except the one behaviour that sends Eurodis's collection back. Run it from a clone of [mock-bank](https://github.com/rseufert/mock-bank), or from its unpacked source archive on PyPI, which carries the sample too:

```bash
pip install "mock-bank>=0.7"
mock-bank --port 8090 --clock 2026-09-30T09:00 &

curl -s -X PATCH http://127.0.0.1:8090/_mock/accounts/EURODIS \
     -H 'Content-Type: application/json' -d '{"behaviour": "return-later"}'
curl -s --data-binary @tests/samples/pain008_four_collections.xml \
     http://127.0.0.1:8090/payments
curl -s -X POST "http://127.0.0.1:8090/_mock/advance?to=2026-10-08"
curl -s http://127.0.0.1:8090/_mock/accounts/ACME/statements
```

The `pain.002` comes back `PART`, two accepted and two rejected. ACME's statement for 1 October closes at 127,750.50, with both accepted collections, and the one for 6 October at 126,250.00, after the return has taken 1,500.50 back. `GET /_mock/collections` lists `DD-2026-0104` as `returned`, with `AC04`.

`return-later` defaults to three business days and `AC04`. `"parameters": {"days": 5, "reason": "MD06"}` changes either, and `end_to_end_id` limits it to one collection. The other accepted collection, from a debtor at another bank, stays booked; `POST /_mock/collections/DD-2026-0101/refuse` with `{"reason": "MD01"}` is that bank saying no, which rejects it before settlement and sends it back after.

None of this waits for a calendar. `POST /_mock/advance` moves the bank's clock, and the credit, the return and the statements all come due on it, so a week of banking runs in under a second.

*Checked on 5 October 2026 against mock-bank 0.7.0.*

<script src="/js/films.js" defer></script>
