---
layout: post
title: "Three EDI Behaviours You Can't Rehearse With a Real Trading Partner"
date: 2026-09-25
---

The chain everybody demos is 850 → 997 → 855 → 856 → 810. An order goes out, the syntax is acknowledged, the supplier confirms it, the goods ship, the invoice arrives. It is the part of EDI that fits on a slide.

It is also not what most of your integration code is for. The bulk of it exists for the days the chain doesn't run cleanly: the buyer changes the order after you've packed it, the acknowledgment never comes, the same file is picked up twice. Those are the branches that carry the money, and they are exactly the ones you cannot rehearse — a real trading partner misbehaves on its schedule, not on yours, and "could you reject an invoice for me on Tuesday?" is a support ticket and a fortnight.

[mock-edi](https://github.com/rseufert/mock-edi) 0.2.0 added all three. Here they are, with output from a mock started like this:

```bash
pip install "mock-edi>=0.2.0"
mock-edi --port 8080 \
  --drop-dir ./edi/in --pickup-dir ./edi/out \
  --despatch-delay 3600000 --invoice-delay 3600000
```

## 1. The buyer changes the order after you've packed it

A buyer that has placed an order and wants less of it sends an **860**, and the seller answers with an **865**. In EDIFACT the change is an `ORDCHG` — but the answer is an **`ORDRSP`**, the same message that answers an `ORDERS`, because EDIFACT has no change acknowledgment of its own. That asymmetry is the single most common thing to get wrong when porting a mapping from X12 to EDIFACT, and it is worth stating plainly rather than discovering in production.

Send an 860 that cuts line 1 from 100 to 60 and deletes line 2 entirely:

```
POC*1*QD*60**EA*12.50**VP*WIDGET-001~
POC*2*DI*0**EA*0**VP*BRKT-050~
```

and the 865 answers line by line, in the same vocabulary the 855 uses:

```
BCA*00*AC*4500001234**1*20260925***20260925~
POC*1*QD*60**EA*12.50**VP*WIDGET-001*UP*076123400003~
ACK*IA*60*EA*068*20260927~
POC*2*DI*40**EA*4.15**VP*BRKT-050*UP*076123400041~
ACK*IR*0*EA~
REF*ZZ**Line deleted at the buyer's request~
```

Note `POC02` — the seller echoes the verb the buyer used (`QD`, `DI`), rather than flattening everything to "changed", so the buyer can match each answer to the request it made.

**The rule that matters is that a change cannot unmake what has already happened.** A quantity cannot drop below what shipped; a shipped line cannot be deleted; an order that has been invoiced cannot be changed at all. A refused line comes back `IR` with a reason, and the stored order keeps the quantity it already had — reporting the order's *current* state instead would tell the buyer its request had succeeded, which is precisely the bug this is meant to help you find.

### The part that had to change in the mock

A change is only meaningful before the goods leave. That sounds obvious, and it exposed a real design flaw: the delay flags postponed *delivery* while the shipment and invoice were built the instant the order arrived. Nothing could ever be changed, because by the time a change arrived the order was already invoiced.

A despatch delay has to postpone the **packing**, not the posting. So the work is now scheduled rather than done:

```
$ curl -s localhost:8080/_mock/scheduled
despatch   4500001234   due 2026-09-25T01:48:15
invoice    4500001234   due 2026-09-25T01:48:15
```

Nothing has been packed. The change lands in that window, and when the despatch finally comes due it ships what the change left behind — 60 of line 1, and no line 2 at all:

```
LIN*1*VP*WIDGET-001*UP*076123400003~
SN1*1*60*EA**60*EA~
```

With the default delays of zero, none of this is visible: the work still happens before the request returns. The scheduling only matters once you ask for a window, which is the point.

## 2. Nobody acknowledged the invoice

Plenty of tools will send you a 997. Far fewer will *read* one, and the asymmetry hides the most expensive failure in EDI: an invoice that went out and was never acknowledged, sitting unnoticed until someone asks why a supplier hasn't been paid.

mock-edi keeps a list:

```
$ curl -s localhost:8080/_mock/unacknowledged
810  4500001234   group 6   set 0006
856  4500001234   group 5   set 0005
865  4500001234   group 4   set 0004
855  4500001234   group 2   set 0002
```

Two control numbers per row, and both are needed. `AK102` quotes the functional group control number from `GS06`; `AK202` quotes the transaction set control number from `ST02`. **`ST02` is only unique within its group** — matching on it alone finds the wrong document, or none. Send back a 997 that rejects the invoice and it is matched and recorded:

```
810 0006 -> rejected (matched True)
  BIG at segment 2: Segment has data element errors; element 4: Invalid code value ('BADPO')
```

```
$ curl -s localhost:8080/_mock/unacknowledged
['856', '865', '855']
```

A receipt for something the mock never sent comes back `"matched": false` rather than being quietly dropped — a duplicate, a receipt for an undelivered document, or a partner quoting the wrong control number are all real, and all evidence of the bug you are looking for.

`?older-than=60` asks the question an operations team actually asks: not "what is outstanding" but "what has been outstanding long enough to chase". And setting a partner to the `no-ack` behaviour means nothing is ever acknowledged, so the list only grows — which is how you test the chase-up timer that has never once fired in anger.

## 3. The same file, read twice

A great deal of EDI is still a folder. The partner writes a file into it; you pick it up. Every directory integration meets the same two problems, and both are quiet.

**A file still being written must not be read.** The convention is write-then-rename, so the file appears complete or not at all — but not every sender follows it. mock-edi leaves a file alone until it has been untouched for `--drop-settle-ms`, and never reads `.tmp`, `.part` or dotfiles at all. It writes its own output the same way, to a temporary name and then renamed, because recommending a convention you don't follow is poor manners.

**A file that has been read must not be read again.** Read files move to `processed/`, unreadable ones to `failed/`:

```
$ curl -s -X POST localhost:8080/_mock/drop/scan
junk.edi           FAILED    -> not an EDI interchange: expected it to start with ISA (X12)
order-9001.edi     read      -> 997, 855
order-9002.edi     read      -> 997, 855

$ ls edi/in/processed          $ ls edi/in/failed
order-9001.edi                 junk.edi
order-9002.edi
```

Moved, not deleted. A mock that eats the evidence is no use at the moment a test fails. Drop `order-9001.edi` a second time and you get `order-9001-1.edi` beside the first, rather than one overwriting the other.

That `scan` endpoint is the other half of the design. There is a poller, but no test should have to wait for it: `POST /_mock/drop/scan` reads the directory *now* and reports what it found. It exists for the same reason `POST /_mock/advance` does — a test that sleeps is slow and flaky, and a test that advances a clock is neither.

## Why this is worth the trouble

None of these three is exotic. Every EDI integration of any age has met all of them, usually in production, usually at the point where somebody is asking where the money went. What makes them hard to test is not complexity but *availability*: they are other people's failures, on other people's schedules.

A mock that only performs the happy path tests the code you were never worried about.

```bash
pip install mock-edi
mock-edi --port 8080
bash examples/demo.sh
```

The guided tour covers all three, and skips the sections your configuration doesn't enable rather than pretending. There is a walkthrough of a full SAP-to-EDI integration in [the previous post](/blog/2026/09/24/testing-an-sap-to-edi-integration), and the [changelog](https://github.com/rseufert/mock-edi/blob/main/CHANGELOG.md) has the rest.
