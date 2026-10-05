---
layout: post
title: "Testing an SAP-to-EDI Integration Without SAP or a Trading Partner"
date: 2026-09-24
description: >-
  How to test the middleware between SAP and your suppliers' EDI without an SAP
  system or a trading partner: purchase orders out as X12 850s, acknowledgments
  and invoices back in, with mock-sap, mock-edi and mock-bank.
image: /blog/sap_invoices.png
---

Every company that buys things through SAP and trades with suppliers over EDI has a piece of middleware in between. It reads purchase orders out of SAP, turns them into X12 850s, sends them to the supplier, takes the supplier's 855 (the purchase order acknowledgment) back into SAP, and, when the goods ship, checks the supplier's 810 invoice before anyone pays it. It is usually the least tested code in the building, because testing it properly needs two things that are hard to get: an SAP system you are allowed to break, and a supplier willing to misbehave on cue.

[mock-sap](https://github.com/rseufert/mock-sap) and [mock-edi](https://github.com/rseufert/mock-edi) are those two things. This post walks through both halves of a small integration, orders out and invoices in, with test suites that run in under a second with no SAP license, no VPN, and no supplier on the phone.

## Running the mocks

```bash
pip install "mock-sap>=0.13.3" "mock-edi>=0.5.0"
mock-sap --port 8000 &
mock-edi --port 8080 &
```

mock-sap serves the purchase order service with real Gateway wire shapes (CSRF tokens, `{"d": ...}` envelopes, decimals as strings) and accepts inbound IDocs. mock-edi plays the supplier: send it an 850 and it answers with a 997, an 855, an 856 and an 810, validated against its own X12 dictionary.

The two examples live in [mock-acme](https://github.com/rseufert/mock-acme), the package of integrations between the mocks, as `mockacme.po_bridge` and `mockacme.invoice_check`. Its CI runs them against the released mocks, and every night against each mock's `main`, so they keep working as new versions come out. (Until 5 October 2026 they lived in mock-edi's and mock-sap's `examples/`; see the note at the end.)

## Part one: orders out, confirmations in

The code under test is `po_bridge.py`, about 150 lines of standard-library Python. It does two jobs:

```
send:     SAP PO (OData)  ──▶  X12 850  ──▶  supplier
receive:  SAP  ◀──  ORDRSP IDoc  ◀──  X12 855  ◀──  supplier
```

To **send**, it reads the purchase order from SAP's `API_PURCHASEORDER_PROCESS_SRV` OData service, looks up the supplier's part number for each material, and writes an 850. One detail matters later: the SAP item number (`00010`, `00020`) goes into `PO101`, the line identifier, so the supplier's answer can be matched back to the right SAP item.

```python
for item in items:
    # PO101 carries the SAP item number, so the 855 can be matched back
    body.append("PO1*%s*%s*EA*%s**VP*%s" % (
        item["PurchaseOrderItem"], x12_quantity(item["OrderQuantity"]),
        item["NetPriceAmount"], SUPPLIER_PART[item["Material"]]))
```

To **receive**, it collects 855s from the supplier, reads each line's `ACK` segment (`IA` accepted, `IQ` quantity changed, `IR` rejected), and posts the result into SAP as an `ORDRSP` IDoc. Anything that isn't a clean confirmation comes back as an exception for a buyer to look at.

### The tests

Each test resets both mocks, creates a fresh purchase order in SAP for 100 widgets and 40 brackets, and then drives the bridge. The interesting part is that the supplier's behaviour is one `PATCH` away.

```python
def supplier_behaves(self, behaviour):
    control(EDI, "PATCH", "/_mock/partners/ACME", {"behaviour": behaviour})
```

#### The happy path

```python
def test_supplier_confirms_everything(self):
    summary = self.bridge.send(self.po)
    self.assertTrue(summary["accepted"])
    self.assertEqual(summary["transactionSets"][0]["findings"], [])

    result = self.bridge.receive()[self.po]
    self.assertEqual(result["lines"], {"00010": ("confirmed", 100.0),
                                       "00020": ("confirmed", 40.0)})
    self.assertEqual(result["exceptions"], [])
    self.assertEqual(len(self.ordrsp_idocs()), 1)
```

The `findings` assertion is quietly the most useful line here. mock-edi validates every inbound document, so a malformed ISA, a bad segment count, or an invalid code shows up as a test failure instead of as a rejected 997 from a real supplier three weeks after go-live.

#### The supplier ships short

```python
def test_short_shipment_is_raised_as_an_exception(self):
    self.supplier_behaves("short-ship")
    self.bridge.send(self.po)

    result = self.bridge.receive()[self.po]
    self.assertNotEqual(result["exceptions"], [])
    for item in result["exceptions"]:
        status, quantity = result["lines"][item]
        self.assertEqual(status, "short")
        self.assertLess(quantity, {"00010": 100, "00020": 40}[item])
```

With `short-ship`, the supplier confirms 80 of the 100 widgets and 32 of the 40 brackets, and the bridge flags both lines.

#### The supplier refuses a line

```python
def test_rejected_line_reaches_sap(self):
    self.supplier_behaves("reject-line")
    self.bridge.send(self.po)

    result = self.bridge.receive()[self.po]
    rejected = [i for i, (status, _) in result["lines"].items() if status == "rejected"]
    self.assertEqual(len(rejected), 1)
    # the IDoc SAP received says so too (E1EDP01 ACTION 003)
    idoc = control(SAP, "GET", "/sap/bc/idoc/" + result["idoc"])
    self.assertIn("<POSEX>%s</POSEX><ACTION>003</ACTION>" % rejected[0], idoc["payload"])
```

This one checks both ends: the bridge noticed the rejection, and the IDoc that landed in SAP carries it on the right item. mock-sap keeps every inbound IDoc, so the test can read back exactly what SAP was sent.

#### The supplier says nothing

```python
def test_silent_supplier_leaves_nothing_to_post(self):
    self.supplier_behaves("no-ack")
    self.bridge.send(self.po)

    self.assertEqual(self.bridge.receive(), {})
    self.assertEqual(self.ordrsp_idocs(), [])
```

A supplier that never answers is the failure that actually costs money, because nothing looks wrong. With `no-ack`, you can build and test the chase-up logic (alert when a PO has gone N hours without an 855) instead of discovering you need it.

#### SAP is down when the answer arrives

This is the test that earned its keep.

```python
def test_sap_outage_does_not_lose_the_confirmation(self):
    control(SAP, "POST", "/_mock/faults", {
        "match": "/sap/bc/idoc", "method": "POST", "status": 503,
        "message": "No dialog work process available", "count": 1})
    self.bridge.send(self.po)

    self.assertEqual(self.bridge.receive(), {})     # SAP was down
    self.assertEqual(len(self.bridge.pending), 1)   # but we kept the 855

    result = self.bridge.receive()                  # next run: SAP is back
    self.assertIn(self.po, result)
    self.assertEqual(self.bridge.pending, [])
    self.assertEqual(len(self.ordrsp_idocs()), 1)
```

The first version of `receive()` collected the 855s and posted each one straight into SAP. Collecting from a mailbox is destructive, so if SAP was unavailable at that moment, the confirmation was simply gone: collected from the supplier, never delivered to SAP, and logged nowhere. The fix is a few lines of store-and-forward, keeping each 855 in `pending` until SAP has taken it:

```python
try:
    receipt = self.sap.request("POST", "/sap/bc/idoc",
                               ordrsp_idoc(po_number, lines), "application/xml")
except urllib.error.HTTPError:
    still_pending.append(doc)          # try again next run
    continue
```

In production `pending` would be a table rather than a list, but the point stands. mock-sap's fault rules (`503`, `423` locked, expired CSRF tokens, timeouts) make this kind of bug cheap to find on a laptop instead of expensive to find in production.

## Part two: invoices in

The same supplier, a few days later, sends an 856 ship notice and an 810 invoice. `invoice_check.py` is the accounts-payable side: it posts an invoice into SAP as an `INVOIC` IDoc only if it passes a three-way match.

```
PO (SAP)  ──┐
856 ship  ──┼──▶  match?  ──▶  yes: INVOIC IDoc into SAP
810 bill  ──┘                  no:  blocked, with reasons
```

The whole check is one function. Every line of the invoice has to agree with the purchase order on price and with the ship notice on quantity, the lines have to add up to the total, and the invoice number must not have been posted before:

```python
if invoice["number"] in self.posted:
    return ["invoice %s has already been posted" % invoice["number"]]
...
for item, (qty, price) in sorted(invoice["lines"].items()):
    total += qty * price
    po_price = Decimal(ordered[item]["NetPriceAmount"])
    if price != po_price:
        found.append("item %s billed at %s, ordered at %s" % (item, price, po_price))
    if qty > shipped.get(item, 0):
        found.append("item %s bills %s, shipped %s" % (item, qty, shipped.get(item, 0)))
tax = invoice.get("tax") or Decimal("0.00")
if total + tax != invoice["total"]:
    found.append("lines add up to %s%s, invoice total is %s" % (
        total, " and tax to %s" % tax if tax else "", invoice["total"]))
```

Money is `Decimal`, never `float`. The 810's `TDS` total carries two implied decimal places (`113280` means 1132.80), which is the kind of detail a real supplier's document tests for you whether you meant it to or not.

### The tests

#### A clean invoice is posted

```python
def test_matching_invoice_is_posted(self):
    po = self.order()

    [result] = self.check.run()
    self.assertEqual((result["po"], result["status"], result["problems"]),
                     (po, "posted", []))
    [idoc] = self.invoice_idocs()
    self.assertEqual((idoc["docnum"], idoc["status"]), (result["idoc"], "53"))
```

Status `53` is SAP's "application document posted". The test reads it back from mock-sap, so it checks what SAP received, not what the code thinks it sent.

#### A short shipment, billed as shipped, is posted

```python
def test_short_shipment_billed_as_shipped_is_posted(self):
    # Checking the invoice against the PO quantity would block this one.
    # The supplier shipped 80 and 32 and billed 80 and 32: that is correct.
    self.supplier_behaves("short-ship")
    self.order()

    [result] = self.check.run()
    self.assertEqual(result["status"], "posted")
```

This is the test that keeps the check honest in the other direction. Matching invoice quantities against the purchase order is the obvious first version, and it blocks every legitimate partial shipment. The invoice has to be matched against what shipped.

#### A price disagreement is blocked

```python
def test_price_disagreement_is_blocked(self):
    # We ordered widgets at 11.00; the supplier's catalogue says 12.50,
    # and a real supplier bills its own price.
    self.order(widget_price="11.00")

    [result] = self.check.run()
    self.assertEqual(result["status"], "blocked")
    self.assertEqual(result["problems"], ["item 00010 billed at 12.50, ordered at 11.00"])
    self.assertEqual(self.invoice_idocs(), [])
```

No `PATCH` needed for this one. mock-edi bills at its own catalogue price whatever the order says, the way real suppliers do, so a purchase order with a stale price is enough to produce the commonest EDI dispute there is.

#### The same invoice, twice, is posted once

```python
def test_duplicate_invoice_is_posted_once(self):
    # A supplier with a retry bug sends the same invoice again a second
    # later.  Release it now rather than sleeping.
    self.supplier_behaves("duplicate-invoice")
    self.order()

    [first] = self.check.run()
    control(EDI, "POST", "/_mock/advance?all")
    [second] = self.check.run()

    self.assertEqual(first["invoice"], second["invoice"])
    self.assertEqual(first["status"], "posted")
    self.assertEqual(second["status"], "blocked")
    self.assertIn("already been posted", second["problems"][0])
    self.assertEqual(len(self.invoice_idocs()), 1)
```

A duplicate invoice is how companies pay twice. mock-edi's `duplicate-invoice` behaviour sends the copy a second after the original, which is realistic and would make a naive test either slow or flaky. `/_mock/advance?all` releases it immediately instead, so the test is neither.

#### SAP takes the IDoc and doesn't post it

```python
def test_an_idoc_sap_would_not_post_is_not_treated_as_posted(self):
    # SAP answers 201 with a docnum and then declines to post the invoice.
    # Reading the docnum and stopping there books an invoice SAP rejected.
    control(SAP, "POST", "/_mock/idoc-posting",
            {"mestyp": "INVOIC", "status": "51",
             "message": "Posting period 08 2026 is not open"})
    self.order()

    [result] = self.check.run()
    self.assertEqual(result["status"], "not posted")
    self.assertIn("status 51", result["problems"][0])

    [idoc] = self.invoice_idocs()
    self.assertEqual(idoc["status"], "51")
    self.assertEqual(self.check.posted, set())
```

This one is newer than the rest of this post, and it is here because it found a real bug in the code above. Posting an IDoc is two events, and SAP reports them separately: the port answers `201` and issues a document number, and *then* the application posts the invoice or doesn't. mock-sap 0.10.0 added `/_mock/idoc-posting` so the second answer can be asked for; the first thing it was pointed at was `invoice_check.py`, which read `DOCNUM` from the receipt and reported `posted` without ever reading `STATUS`.

So an invoice SAP had refused was booked as ready to pay. Worse, its number went into the posted set, so the resend after someone opened the posting period would have looked like a duplicate and been blocked — the invoice would never have posted and nothing would have said so. Both halves are fixed above; the check now requires status `53`.

That is the shape of the failure worth designing tests around. A `503` is loud and retryable, and the bridge in part one already survives one. An accepted IDoc that never posts looks exactly like success from the sending side.

## Running it

```bash
$ git clone https://github.com/rseufert/mock-acme && cd mock-acme
$ pip install -e ".[test]"
$ python3 -m unittest tests.test_po_bridge tests.test_invoice_check
.............................................
----------------------------------------------------------------------
Ran 45 tests in 1.377s

OK
```

The tests start both mocks themselves. When this post was written the same two files were sixteen tests, and all sixteen are among the forty-five; the rest came after, and the note at the end says what they found.

Sixteen scenarios, two systems, under a second, as first written. Six of them were newer than the
rest, and every one came from running this integration against a *third* mock.
Three ask what posting the invoice created rather than what SAP received; three
ask whether the money it created is in the currency anyone agreed on. Neither
question was asked here until a payment run needed an answer. The full code:

- Orders out: [po_bridge.py](/examples/po-bridge/po_bridge.py) and [test_po_bridge.py](/examples/po-bridge/test_po_bridge.py), also in [mock-acme](https://github.com/rseufert/mock-acme/blob/main/mockacme/po_bridge.py)
- Invoices in: [invoice_check.py](/examples/invoice-check/invoice_check.py) and [test_invoice_check.py](/examples/invoice-check/test_invoice_check.py), also in [mock-acme](https://github.com/rseufert/mock-acme/blob/main/mockacme/invoice_check.py)

Both run in mock-acme's CI against all three mocks, so they keep working as the mocks change.

Neither mock implements real business logic, and that's the point. The integration's job is to move documents between two systems correctly and to survive when either one misbehaves. That's exactly what these tests cover.

## Next: paying the invoice

An approved invoice still has to be paid, and that is a third conversation, with a bank. [mock-bank](https://pypi.org/project/mock-bank/) is the counterparty for it. Send it an ISO 20022 `pain.001` payment file and it answers with a `pain.002` that accepts or rejects each payment with a reason code, then a `camt.054` debit notification on the settlement date, then a `camt.053` statement whose balances reconcile. A closed account, an unknown bank or a duplicate file is a `PATCH` away, and `POST /_mock/advance` moves bank time, so settlement day is a test line rather than a wait.

Or send the same payments as a NACHA file, for an account that banks in US formats. The choice is per account, so one file can produce both: an ISO 20022 account gets a `pain.002`, a `pacs.004` and a `camt.053`, and an ACH account gets a plain-text acknowledgement, an R-coded return file and a BAI2 statement. The reason codes line up — `AC04` is `R02`, `RC01` is `R03` — because it is the same decision either way, rendered twice.

```bash
pip install mock-bank
mock-bank --port 8090 &
```

That leg has a worked example now. [`pay_invoices`](https://github.com/rseufert/mock-acme/blob/main/mockacme/pay_invoices.py), now in mock-acme, pays mock-edi's EDIFACT invoices on their due dates and then decides from the bank's answers which ones are paid. Its seven tests are the ways a payment run goes wrong quietly:

- a payment the bank *accepted* treated as paid before the statement shows it
- a retried run that pays twice
- a status report that rejects every payment read as one file-level rejection, losing each payment's reason
- a returned payment that leaves its invoice marked paid
- a payment missing from the statement that nobody notices

[The tests](https://github.com/rseufert/mock-acme/blob/main/tests/test_pay_invoices.py) walk through them.

### The SAP payment run

`pay_invoices` pays invoices that arrived over EDI. A company pays what is in
*SAP*, and that is a different selection with a different set of ways to go
wrong. [`payment_run`](https://github.com/rseufert/mock-acme/blob/main/mockacme/payment_run.py)
does what SAP's `F110` does: select the open supplier items that are due, pay
them in one `pain.001`, and post each `camt.053` back as a `FINSTA01` so SAP
clears what was paid and reopens what came back.

```python
payments = PaymentRun(SAP, BANK, ACME)
run = payments.run(self.monday, "RUN1")
payments.reconcile(run)
```

The `EndToEndId` is the supplier's own invoice number and the `MsgId` is the run
date and identification, the way `F110` builds them. So the bank's answers and
SAP's clearing meet on the same reference, and the same run sent twice is a
duplicate by construction rather than by luck.

#### A payment the bank accepted is not a payment that happened

`pain.002` says *accepted*. It does not say *paid*. The money leaves on the
settlement date, and the statement is what proves it — so an integration that
clears the invoice on the acknowledgment is reporting cash it still has.

```python
run = self.payments.run(self.today, "R1")          # Friday, 16:00
self.advance(self.today + datetime.timedelta(days=1))
self.payments.reconcile(run)
self.assertEqual({i.status for i in run.items}, {"accepted"})
self.advance(self.monday + datetime.timedelta(days=1))
self.payments.reconcile(run)
self.assertEqual({i.status for i in run.items}, {"cleared"})
```

mock-bank settles a 16:00 Friday payment on Monday, because 15:00 is the cutoff
and the weekend is not a business day. Friday's statement arrives and clears
nothing — harmlessly: nothing cleared, nothing it could not place, nothing wrong
with it — and Monday's clears everything. The test takes milliseconds, because
the bank's clock is a number the mock will move for you.

#### A returned payment looks exactly like one never paid

This is the expensive one. Three business days after it settled, a payment can
come back. In SAP the reopened item and an item nobody ever paid are both simply
*open*: pay from that list without looking closer and you pay the returned
invoice a second time; treat it as never sent and you never chase it.

Here `GLX-4711` was paid and came back, and `INI-2026-17` was rejected at the
door for `AC04` and never paid at all:

```python
returned, never = self.cube_item("GLX-4711"), self.cube_item("INI-2026-17")
self.assertEqual((returned["ClearingAccountingDocument"],
                  never["ClearingAccountingDocument"]), ("", ""))
self.assertEqual((returned["ClearingIsReversed"],
                  never["ClearingIsReversed"]), (True, False))
```

One flag tells them apart. mock-bank sends the return as a `pacs.004` and puts it
on the day's statement as a credit whose `RtrInf` names the reason, so the
distinction is in the wire file rather than in a convention (parties and the
original transaction code trimmed):

```xml
<Ntry><Amt Ccy="EUR">1190.00</Amt><CdtDbtInd>CRDT</CdtDbtInd>
  <BookgDt><Dt>2026-10-08</Dt></BookgDt><AcctSvcrRef>MB-RTR-35</AcctSvcrRef>
  <BkTxCd><Domn><Cd>PMNT</Cd><Fmly><Cd>ICDT</Cd><SubFmlyCd>RRTN</SubFmlyCd></Fmly></Domn></BkTxCd>
  <NtryDtls><TxDtls><Refs><MsgId>F110-20261005-RUN1</MsgId>
    <EndToEndId>GLX-4711</EndToEndId></Refs>
    <RtrInf><Rsn><Cd>AC04</Cd></Rsn></RtrInf>
  </TxDtls></NtryDtls></Ntry>
```

`ClearingIsReversed` is how mock-sap carries that through: the clearing document
comes off the open item, so it is payable again, and the flag says it was paid
once and came back. The next run selects it alongside the one never paid, which
is correct — both are owed — and now the run can tell you which is which.

#### A statement that does not add up should stop one payment, not the run

Under the `statement-gap` behaviour the bank leaves one payment off the
statement, the way a real one does when a file is still in flight. The failures
to avoid are a reconciliation that balances the day by adjusting something, and
one that throws and leaves half the run posted.

```python
statuses = sorted(i.status for i in run.items)
self.assertEqual(statuses, ["cleared", "unreconciled"])
missing = [i for i in run.items if i.status == "unreconciled"][0]
self.assertIn("short", missing.reason)
```

Closing balance minus opening minus the entries is checked before anything is
posted to SAP. One payment goes `unreconciled` and its item stays open; the rest
clear. The reason says which payment and by how much — *statement 2 for
2026-10-05 is 238.00 short, which is this payment; the item stays open* — and
when two payments could equally explain the shortfall, both are named rather
than one of them guessed at.

#### Say what went wrong instead of stopping

`run.problems` holds, in words, anything either side *answered* that the run
could not use: the bank replying with something other than `202` or `422`, a
mailbox that answers with an error, SAP refusing a statement. It is neither
raised nor swallowed, and an empty list is what a clean run looks like.

```python
self.assertIn("answered 404 to the payment file", run.problems[0])
self.assertIn("no status report was read", run.problems[1])
self.assertIn("no statement was read", run.problems[2])
```

A host that is *down* is deliberately not in that list. Point the run at a port
nothing is listening on and it raises `URLError` and stops, rather than
recording three sentences and carrying on — `problems` is for an answer it
could not use, not for an absent server. Which of those two you want is a real
design question, and the run answers it one way rather than pretending not to.

### Running the payment run

```bash
$ python3 -m unittest tests.test_payment_run          # in the mock-acme clone
.............s....s...............................
----------------------------------------------------------------------
Ran 50 tests in 1.863s

OK (skipped=2)
```

Twenty-six of those were here when this section was last checked, and they are
described below. The other twenty-four came in mock-acme. Most are about the
payment run's register, its own record of what it has sent, which is what stops
a second run before the statement from paying the same invoice again. The rest
keep money arriving apart from a payment coming back, and post a statement in
its own currency.

Of the twenty-six, thirteen are the behaviours above. The other thirteen came with the ACH
path and with more asking of what happens when something answers badly: five
hold the NACHA file header to its rules, one keeps two runs on the same day in
separate files, two skip here because they need an account that banks in US
formats, three cover a bank or an SAP that answers with an error rather than not
at all, and two make sure a clearing lands on the invoice SAP says it cleared.
That last pair came in mock-bank 0.6.0: two suppliers can both bill `INV-1`, so
the run now matches SAP's answer by accounting document rather than by invoice
number, and says so out loud when a row names none. CI runs the whole suite
both ways, so the ACH path is not merely present.


Thirteen scenarios across three systems. Twelve of them run on real sockets with
nothing stubbed on either side; the thirteenth builds a run in memory, because
naming both candidates for a shortfall is arithmetic and does not need a bank:

```bash
git clone https://github.com/rseufert/mock-acme && cd mock-acme
pip install -e ".[test]"
python3 -m unittest -v tests.test_payment_run
```

The tests start the mocks themselves, the bank on its clock at 16:00 on a
Friday. From mock-bank 0.6 to 0.7 the example also shipped in mock-bank's
wheel, as `mockbank.examples`; it now lives only in mock-acme.

mock-bank's tests need mock-sap 0.13.2 or newer: the open-item cube it
reads is read-only there, as it is in S/4, and a blocked supplier invoice
reaches its open item — which is what makes *a blocked invoice is never
selected* a test rather than a comment.

Under a second for a returned payment, a missed cutoff and a short statement:
three things that are cheap here and expensive to meet for the first time in
production.

### All three at once

`payment_run` pays what is already in SAP. [`procure_to_pay`](https://github.com/rseufert/mock-acme/blob/main/mockacme/procure_to_pay.py)
carries one purchase the whole way instead: the order out as an `850`, the
supplier's answers back, the three-way match, the posting, the payment run and
the statement that clears it. Everything in this post plus the bank, in one test
suite.

It is worth reading for the duplicate. A supplier retries an invoice after the
first was taken, and **two separate things look like they catch it while neither
does**. Upstream, a restarted middleware has forgotten its ship notices as well
as what it posted, so the retry is blocked for billing more than was shipped -
which is a second thing missing, not a check. Downstream, the payment run skips a
repeated reference within one run, and pays it in the next once the first has
cleared. The second payment goes out through the gap between two systems that
were each deduplicating for their own reasons.

The fix is to ask the system of record - does SAP already hold a supplier invoice
with this number, from this supplier - which is one `$filter` and survives a
restart, because SAP is where the answer lives.

## Updates

Newest last. Each one is a date this post was run again rather than reread,
which is the only kind of check worth recording.

*Updated 25 September 2026: [mock-sap 0.11.1](https://pypi.org/project/mock-sap/0.11.1/) and [mock-edi 0.2.1](https://pypi.org/project/mock-edi/0.2.1/) are out, and each release carries one of the two examples in this post. mock-sap 0.10.0 added the last scenario in part two — an IDoc SAP accepts and then declines to post — which found a bug in the invoice check this post describes. Pin 0.11.1 or later: 0.11.0 added business errors on BAPI calls, and 0.11.1 fixes a delta read that could report nothing had changed when something had.*

*Checked again on 27 September 2026 against [mock-sap 0.13.1](https://pypi.org/project/mock-sap/0.13.1/) and [mock-edi 0.5.0](https://pypi.org/project/mock-edi/0.5.0/): all ten tests pass unchanged. The same day, a third mock joined them: [mock-bank](https://github.com/rseufert/mock-bank), for the payment that follows an approved invoice. See [Next: paying the invoice](#next-paying-the-invoice). One thing did change underneath the invoice check: since mock-sap 0.12.0 the `INVOIC` IDoc it posts no longer just lands in SAP, it **creates a supplier invoice and an open payable** - which is exactly what a payment run then selects. 0.13.0 closed that loop: post the bank's statement back as a `FINSTA01` and the invoice it paid is cleared, or reopened if the payment came back. [mock-bank 0.2.0](https://pypi.org/project/mock-bank/0.2.0/) is the other end of it, and there is now a worked SAP payment run: see [the SAP payment run](#the-sap-payment-run).*

*Checked again on 28 September 2026 against [mock-sap 0.13.2](https://pypi.org/project/mock-sap/0.13.2/) and [mock-bank 0.2.0](https://pypi.org/project/mock-bank/0.2.0/). (mock-bank 0.3.0 landed later the same day; these tests do not depend on it.) 0.13.2 matters to part two of this post, and not in a flattering way. The `INVOIC` IDoc `invoice_check` sent named no supplier, so SAP had nobody to owe and created **no supplier invoice and no open payable** — while answering status `53`, *Application document posted*. Every invoice this post's example approved had been booked as posted and left no money owed. The five tests here never caught it because all five asserted what SAP *received*, and none asserted what posting it created. Both halves are fixed in 0.13.2: the IDoc now names the supplier, and an IDoc that posts nothing reports `51` with the segment that was missing rather than claiming success. Three tests were added to ask the question the other five did not, taking it to thirteen. It was found on the first attempt to run all three mocks end to end — four examples using two mocks each could not see it. A third bug came out of the same exercise: the `850` this example sends declared no currency, so a purchase order placed in EUR came back invoiced in dollars and the three-way match compared the figures without noticing they meant different things. mock-bank was the only thing in the chain that objected, refusing the payment because a SEPA transfer is in EUR. Fixed in 0.13.2 as well, with three more tests — hence sixteen above, where there were ten on the 25th.*

*Checked again on 28 September 2026 against the released mocks - [mock-sap 0.13.2](https://pypi.org/project/mock-sap/0.13.2/), [mock-edi 0.5.0](https://pypi.org/project/mock-edi/0.5.0/) and [mock-bank 0.4.0](https://pypi.org/project/mock-bank/0.4.0/) - and two counts above were wrong, both in the same way: true when they were pasted, and never revisited.*

*The run in [Running it](#running-it) says sixteen, and installing the versions this post told you to install gave **thirteen**. The three currency tests were in mock-sap's main branch and in no release, so that block had been run against a checkout rather than against what a reader gets - and the note above claiming the currency fix shipped in 0.13.2 was wrong for the same reason. Fixed by a release the next day; see below.*

*The payment run said thirteen and has been **twenty-three** since mock-bank 0.3.0, one of which skips unless the account banks in US formats. That block now shows the run I made for this note. The sixteen above is left as it is, because the tests behind it exist and only want a release.*

*What 0.4 adds is the direction this post does not cover at all: `POST /_mock/credits` makes money *arrive*, booked on its value date and reported as a `camt.054` and an entry on the day's statement, which still reconciles. Accounts payable has had three mocks for a while; cash application now has something to read.*

*Updated 29 September 2026: [mock-sap 0.13.3](https://pypi.org/project/mock-sap/0.13.3/) is out, and the sixteen above is now what a reader gets. Run from the source archives this post points at, with nothing but released mocks - mock-sap 0.13.3 and mock-edi 0.5.0 - `test_po_bridge` and `test_invoice_check` are **16 tests, OK**. The install line above asks for 0.13.3 for that reason: 0.13.2's copy of the example has eight tests and no currency check, so the floor, not the post, was what made the block unreachable.*

*0.13.3 changes nothing about the mock itself - `mocksap/` is byte-identical to 0.13.2 - and the wheel carries no examples, so it is a release you feel only by reading the example or cloning the repo. Which is the whole point of it: the example is what this post tells you to run.*

*Checked again on 5 October 2026 against [mock-sap 0.16.0](https://pypi.org/project/mock-sap/0.16.0/), [mock-edi 0.7.0](https://pypi.org/project/mock-edi/0.7.0/) and [mock-bank 0.7.0](https://pypi.org/project/mock-bank/0.7.0/), installed from PyPI with the lines in this post. `test_po_bridge` and `test_invoice_check`, from the copies this post links to, are still **16 tests, OK**. The payment run is now **26**, two of them skipped, where [Running the payment run](#running-the-payment-run) said 23 and one skipped. The three new tests came with mock-bank 0.6.0, and that block and the paragraph under it now show this run. Two of them are about an invoice number being only the supplier's own: keyed on it, a run with two suppliers' `INV-1` recorded one clearing against the wrong item and left the other looking unpaid, to be paid again next time. The third skips a reference a BAI2 statement cannot carry back, and is the second skip. [procure_to_pay](/blog/2026/10/02/one-purchase-across-three-mocks) passed its ten against the same three releases the day before.*

*Checked again later the same day against [mock-sap 0.17.1](https://pypi.org/project/mock-sap/0.17.1/), with mock-edi 0.7.0 and mock-bank 0.7.0: still **16 tests, OK**, and the payment run still **26**, two skipped. 0.17.0 changed how a statement posts: three invoices paid to one supplier now clear against one payment document rather than three, and an item's `ClearingItem` points at the line that paid it. None of these tests assumed one document per invoice, so none had to change.*

*Updated 5 October 2026: the examples have moved. Every integration in this post now lives in [mock-acme](https://github.com/rseufert/mock-acme), ACME's middleware as one package, and the mocks removed their copies the same day: `po_bridge` from mock-edi, `invoice_check` from mock-sap, and `pay_invoices`, `payment_run` and `procure_to_pay` from mock-bank, whose 0.7.0 wheel is the last to carry them as `mockbank.examples`. The links, the run commands and the copies under [/examples/](/examples/) now follow mock-acme, and its tests start the three mocks themselves. Run against mock-sap 0.18.0, mock-edi 0.7.0 and mock-bank 0.7.0 from mock-acme at `5f2ee3d`, `po_bridge` and `invoice_check` are **45 tests, OK**, with all sixteen above among them, and the payment run is **50**, two skipped, with all twenty-six among them.*

*The new tests found real bugs. An order for 2.5 was sent to the supplier as 2, because the 850 wrote the quantity with `%d`. The supplier then confirmed, shipped and billed 2, and every document agreed with every other. The block in [Part one](#part-one-orders-out-confirmations-in) now shows the fix. An invoice carrying sales tax was blocked as not adding up, so the total check above now adds the tax in. An invoice for more than was ordered was posted in full when the ship notice agreed with it, because the match never compared it with the order. And a second payment run before the statement paid the same invoice again, because SAP has nothing between open and cleared; the run now keeps a register of what it has sent.*
