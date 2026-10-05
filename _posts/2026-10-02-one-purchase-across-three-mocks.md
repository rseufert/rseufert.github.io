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
	<a class="play" href="/blog/p2p_film.gif" title="play the film"><img src="/blog/p2p_film.png" width="800" height="450" alt="Four lanes: SAP, ACME, mock-edi as the supplier, and mock-bank; between the mocks runs procure_to_pay from the installed mock-acme package, ACME's middleware, driven by the capture script, which derived the Monday the run starts on, emptied the bank's holidays, and created the purchase order in SAP before the film starts. Act one, on Monday 2026-10-12: ACME's 850 goes to the supplier, and it acknowledges, confirms, packs, sends the despatch advice, raises invoice INV9000002 and sends the 810. Act two: the middleware posts that invoice to SAP as an INVOIC, and SAP posts it and owes EUR 1250.00. Act three: the script advances the bank's clock to Wednesday 2026-11-11, the day SAP says the invoice is due; the middleware sends a pain.001 with one payment, which the bank accepts, books and reports; the clock moves a day, the statement arrives, the middleware posts it to SAP as a FINSTA01 and SAP clears INV9000002, with 22 empty statements posted on the way and not drawn. Act four: the script moves the supplier's clock to the bank's day, because a supplier a month behind would take the advice as one for money that has not come; SAP writes a payment advice, the middleware sends it to the supplier as an 820 for EUR 1250.00, and the supplier acknowledges it and records it as advised, which is its word for being told and not a state on the invoice."></a>
	<figcaption>one purchase across all three mocks <span>drawn by mock-films from a real run</span></figcaption>
</figure>

mock-films drew that film from a real run; click it to play. It has four lanes (SAP, the buyer ACME, mock-edi playing the supplier, and mock-bank), and one purchase crosses all of them:

```
SAP  ──850──▶  supplier          a purchase order becomes an EDI order
     ◀──855/856/810──  supplier  confirmed, shipped, invoiced
SAP  ◀──INVOIC──                 matched, posted, and now owed
     ──pain.001──▶  bank         a payment run selects what is due
SAP  ◀──FINSTA01◀──camt.053──    the statement clears what was paid
SAP  ──PEXR2002──▶ 820 ──▶  supplier   and the supplier is told what for
```

Every arrow in it is something one of the other worked examples already does with two mocks. [PO bridge](/examples/#po-bridge) sends the order, [Invoice check](/examples/#invoice-check) posts the invoice, [Payment run](/examples/#payment-run) pays it and reads the statement back, [Remittance](/examples/#remittance) tells the supplier. [Procure to pay](/examples/#procure-to-pay) strings them together, and it exists for what only shows up between them.

## What the film shows

The run starts on Monday 2026-10-12. ACME's 850 goes to the supplier, which acknowledges it, confirms it, packs it, sends the despatch advice, and raises invoice INV9000002. The middleware posts that invoice into SAP as an `INVOIC`, and SAP now owes EUR 1250.00.

Then the bank's clock moves to Wednesday 2026-11-11, the day SAP says the invoice is due. The payment run sends a `pain.001` with one payment; the bank accepts it, books it and reports the debit. The clock moves a day, Thursday's statement arrives, the middleware posts it to SAP as a `FINSTA01`, and SAP clears INV9000002. On the way, 22 empty statements were posted for the days nothing happened, and the film leaves them out.

The fourth act tells the supplier. First the script moves the supplier's clock to the bank's day, and the film shows it doing so: a supplier still on its own clock, a month behind, would take the advice as one for money that has not arrived, and say so. Then SAP writes a payment advice from the payment, the middleware sends it to the supplier as an X12 820 for EUR 1250.00, and the supplier acknowledges it and records it as *advised*. That word is the supplier's, and it means only that it was told. Nothing in the film says the supplier applied the payment to the invoice on its side.

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

Until mock-acme 0.2.0 it didn't tell the supplier it was paid, and the film ended with SAP and the bank agreeing and the supplier none the wiser. That is why a supplier keeps dunning you for an invoice you paid. The fourth act is the fix: the middleware's `advise` step asks SAP for the payment advice (mock-sap writes one from the payment itself, naming every invoice it settled), converts it with [`remittance`](/examples/#remittance) into an 820, and sends it to mock-edi, which says whether it agrees.

What the middleware still doesn't do is take it back. If the bank returns a payment after the supplier was told, SAP reopens the invoice, and the supplier holds an advice saying it was paid. The correction is a reversing 820, and nothing sends one yet.

## Run it

The example and its tests are in [mock-acme](https://github.com/rseufert/mock-acme), the package of integrations between the mocks, and its tests start the three mocks themselves:

```bash
git clone https://github.com/rseufert/mock-acme && cd mock-acme
pip install -e ".[test]"
python3 -m unittest -v tests.test_procure_to_pay
```

Nineteen tests. Among them are the loop end to end, the duplicate paid without the check and refused with it, a price disagreement blocked before any money moves, a short shipment paid for what shipped, and a payment the bank rejects leaving the invoice owed. The other four came with the payment run's register: with one kept on disk, a restarted middleware does not pay again. The last five came with the advice: the supplier is told and agrees, one advice names both invoices a single payment settled, a payment the bank refused is not advised, a payment accepted but not yet on a statement is not advised either, and the advice carries the bank's day, which the supplier judges by its own clock. The code is [procure_to_pay.py](https://github.com/rseufert/mock-acme/blob/main/mockacme/procure_to_pay.py), and the tests are in [tests/test_procure_to_pay.py](https://github.com/rseufert/mock-acme/blob/main/tests/test_procure_to_pay.py).

*Checked on 4 October 2026 against mock-sap 0.16.0, mock-edi 0.7.0 and mock-bank 0.7.0.*

*Checked again on 5 October 2026 against mock-sap 0.17.1: the ten tests pass unchanged. 0.17.0 changed how a statement posts, with one payment document per supplier rather than one per invoice, and added the remittance advice mentioned above.*

*Updated 5 October 2026: the example has moved. It was in mock-bank's `examples/` and its wheel, as `mockbank.examples`; it is now in [mock-acme](https://github.com/rseufert/mock-acme), with the other integrations between the mocks, and the mocks have removed their copies. [Run it](#run-it) says how to run it from there. Against mock-sap 0.18.0, mock-edi 0.7.0 and mock-bank 0.7.0, from mock-acme at `5f2ee3d`, it is fourteen tests, OK. The ten this post described are all among them. mock-bank 0.7.0 still carries the old copy, and the release after it will not.*

*Updated 5 October 2026: mock-films re-cut the film with mock-acme 0.2.0's `procure_to_pay` driving it, where it had run mock-bank's packaged example. No row changed, but every date moved a week, because the run is dated the Monday after the capture: it now starts on Monday 2026-10-12 and pays on Wednesday 2026-11-11. mock-acme 0.2.0 also tells the supplier what was paid, so [What it doesn't do](#what-it-doesnt-do) now says what the middleware does and what it still doesn't. Against mock-sap 0.18.0, mock-edi 0.7.0 and mock-bank 0.7.0, from mock-acme 0.2.0 at `c538e72`, it is nineteen tests, OK.*

*Updated 5 October 2026, later: mock-films added the fourth act, so the film now ends with the supplier told, and [What the film shows](#what-the-film-shows) describes it. The supplier's lane now shows its clock in every act; the rows and dates of the first three acts are unchanged. The film runs 65.7 seconds, up from 51.2.*

<script src="/js/films.js" defer></script>
