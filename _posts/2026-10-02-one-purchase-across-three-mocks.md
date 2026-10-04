---
layout: post
title: "One Purchase Across Three Mocks"
date: 2026-10-02
description: >-
  A purchase order in SAP, carried through an EDI supplier and a bank until the
  bank's statement clears it, against mock-sap, mock-edi and mock-bank. What
  that chain shows that no pair of the mocks could, and the duplicate invoice
  that only the third mock makes visible.
image: /blog/p2p_film.png
---

<figure class="film">
	<a class="play" href="/blog/p2p_film.gif" title="play the film"><img src="/blog/p2p_film.png" width="800" height="450" alt="Four lanes: SAP, ACME, mock-edi as the supplier, and mock-bank; between the mocks runs the procure_to_pay example from the installed mock-bank package, driven by the capture script, which derived the Monday the run starts on, emptied the bank's holidays, and created the purchase order in SAP before the film starts. Act one, on Monday 2026-10-05: ACME's 850 goes to the supplier, and it acknowledges, confirms, packs, sends the despatch advice, raises invoice INV9000002 and sends the 810. Act two: the example posts that invoice to SAP as an INVOIC, and SAP posts it and owes EUR 1250.00. Act three: the script advances the bank's clock to Wednesday 2026-11-04, the day SAP says the invoice is due; the example sends a pain.001 with one payment, which the bank accepts, books and reports; the clock moves a day, the statement arrives, the example posts it to SAP as a FINSTA01 and SAP clears INV9000002. 22 empty statements are posted on the way and are not drawn, and the supplier is not told it was paid: the example sends no remittance advice."></a>
	<figcaption>one purchase across all three mocks <span>drawn by mock-films from a real run</span></figcaption>
</figure>

mock-films drew that film from a real run; click it to play. It has four lanes (SAP, the buyer ACME, mock-edi playing the supplier, and mock-bank), and one purchase crosses all of them:

```
SAP  ──850──▶  supplier          a purchase order becomes an EDI order
     ◀──855/856/810──  supplier  confirmed, shipped, invoiced
SAP  ◀──INVOIC──                 matched, posted, and now owed
     ──pain.001──▶  bank         a payment run selects what is due
SAP  ◀──FINSTA01◀──camt.053──    the statement clears what was paid
```

Every arrow in it is something one of the other worked examples already does with two mocks. [PO bridge](/examples/#po-bridge) sends the order, [Invoice check](/examples/#invoice-check) posts the invoice, [Payment run](/examples/#payment-run) pays it and reads the statement back. [Procure to pay](/examples/#procure-to-pay) strings them together, and it exists for what only shows up between them.

## What the film shows

The run starts on Monday 2026-10-05. ACME's 850 goes to the supplier, which acknowledges it, confirms it, packs it, sends the despatch advice, and raises invoice INV9000002. The example posts that invoice into SAP as an `INVOIC`, and SAP now owes EUR 1250.00.

Then the bank's clock moves to Wednesday 2026-11-04, the day SAP says the invoice is due. The payment run sends a `pain.001` with one payment; the bank accepts it, books it and reports the debit. The clock moves a day, Thursday's statement arrives, the example posts it to SAP as a `FINSTA01`, and SAP clears INV9000002. On the way, 22 empty statements were posted for the days nothing happened, and the film leaves them out.

## Each pair was green while the chain was broken

The example was written to find bugs, and it found three, in code whose own tests were passing:

- An `INVOIC` that named no supplier, so it posted and created nothing owed.
- A mock that answered "posted" for having posted nothing.
- An order placed in EUR that came back invoiced in dollars.

None of them showed up between two mocks, because each pair's tests check what the *next* system received, not what it could do with it. An invoice SAP accepts but can't pay looks fine until something tries to pay it.

## The same invoice twice

This is the one worth the whole exercise. A supplier retries an invoice after the first was taken, or a restarted middleware posts it again. Two things look like they catch it, and neither does.

**Upstream**, a restarted middleware has forgotten its ship notices as well as what it posted. An invoice arriving on its own is blocked for billing more than was shipped, `item 00010 bills 100, shipped 0`. That isn't the duplicate being caught; it's a second thing being missing. Resend the despatch advice with the invoice, as a partner replaying a batch would, and it posts again.

**Downstream**, within one payment run, a second item with a reference already seen is skipped, so two payments in one file can't share an `EndToEndId`. It looks caught. In the next run the first payment has cleared, the second item is alone, and it is paid.

So neither end is checking. Each is forgetting or deduplicating for its own reasons, and the second payment goes out through the gap. SAP won't answer the question unasked either: a duplicate check in SAP is configuration, so mock-sap files both, and a mock that invented a check would hide exactly this bug.

The fix is to ask the system of record. Does SAP already hold a supplier invoice with this number, from this supplier?

```python
def already_posted(self, reference, supplier):
    query = urllib.parse.urlencode({"$filter": (
        "SupplierInvoiceIDByInvcgParty eq '%s' and InvoicingParty eq '%s'"
        % (odata_string(reference), odata_string(supplier))),
        "$format": "json"})
    found = self.sap.request("GET", "%s?%s" % (SUPPLIER_INVOICES, query))
    return bool(found["d"]["results"])
```

It survives a restart because SAP is where the answer lives. It is per supplier, because an invoice number is only unique within one. And `odata_string` doubles any quote in the number, because `O'BRIEN-014` is a supplier's invoice number, not OData syntax.

## What it doesn't do

It never tells the supplier it was paid. That takes a remittance advice, an X12 820 or EDIFACT `REMADV`, and the film ends with SAP and the bank agreeing and the supplier none the wiser. That is why a supplier keeps dunning you for an invoice you paid. mock-edi has received both since 0.6.0, so the gap is in the example now, not the mocks.

## Run it

The example and its tests ship in the mock-bank wheel, so there is nothing to clone:

```bash
pip install "mock-bank>=0.6" "mock-sap>=0.14" "mock-edi>=0.7"
mock-sap --port 8000 &
mock-edi --port 8080 &
mock-bank --port 8090 --clock 2026-10-02T16:00 &
python3 -m unittest -v mockbank.examples.test_procure_to_pay
```

Ten tests, among them the loop end to end, the duplicate paid without the check and refused with it, a price disagreement blocked before any money moves, a short shipment paid for what shipped, and a payment the bank rejects leaving the invoice owed. The code is [procure_to_pay.py](https://github.com/rseufert/mock-bank/blob/main/examples/procure_to_pay.py), and the tests are [beside it](https://github.com/rseufert/mock-bank/blob/main/examples/test_procure_to_pay.py).

*Checked on 2 October 2026 against mock-sap 0.14.0, mock-edi 0.7.0 and mock-bank 0.6.0.*

<script src="/js/films.js" defer></script>
