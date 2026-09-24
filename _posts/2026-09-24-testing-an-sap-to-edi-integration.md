---
layout: post
title: "Testing an SAP-to-EDI Integration Without SAP or a Trading Partner"
date: 2026-09-24
---

Every company that buys things through SAP and trades with suppliers over EDI has a piece of middleware in between. It reads purchase orders out of SAP, turns them into X12 850s, sends them to the supplier, and takes the supplier's 855 (the purchase order acknowledgment) back into SAP. It is usually the least tested code in the building, because testing it properly needs two things that are hard to get: an SAP system you are allowed to break, and a supplier willing to misbehave on cue.

[mock-sap](https://github.com/rseufert/mock-sap) and [mock-edi](https://github.com/rseufert/mock-edi) are those two things. This post walks through a small integration and a test suite for it that runs in under a second with no SAP license, no VPN, and no supplier on the phone.

## The integration

The code under test is `po_bridge.py`, about 150 lines of standard-library Python. It does two jobs:

```
send:     SAP PO (OData)  ──▶  X12 850  ──▶  supplier
receive:  SAP  ◀──  ORDRSP IDoc  ◀──  X12 855  ◀──  supplier
```

To **send**, it reads the purchase order from SAP's `API_PURCHASEORDER_PROCESS_SRV` OData service, looks up the supplier's part number for each material, and writes an 850. One detail matters later: the SAP item number (`00010`, `00020`) goes into `PO101`, the line identifier, so the supplier's answer can be matched back to the right SAP item.

```python
for item in items:
    # PO101 carries the SAP item number, so the 855 can be matched back
    body.append("PO1*%s*%d*EA*%s**VP*%s" % (
        item["PurchaseOrderItem"], float(item["OrderQuantity"]),
        item["NetPriceAmount"], SUPPLIER_PART[item["Material"]]))
```

To **receive**, it collects 855s from the supplier, reads each line's `ACK` segment (`IA` accepted, `IQ` quantity changed, `IR` rejected), and posts the result into SAP as an `ORDRSP` IDoc. Anything that isn't a clean confirmation comes back as an exception for a buyer to look at.

## Running the mocks

```bash
pip install mock-sap mock-edi
mock-sap --port 8000 &
mock-edi --port 8080 &
```

mock-sap serves the purchase order service with real Gateway wire shapes (CSRF tokens, `{"d": ...}` envelopes, decimals as strings) and accepts inbound IDocs. mock-edi plays the supplier: send it an 850 and it answers with a 997, an 855, an 856 and an 810, validated against its own X12 dictionary.

## The tests

Each test resets both mocks, creates a fresh purchase order in SAP for 100 widgets and 40 brackets, and then drives the bridge. The interesting part is that the supplier's behaviour is one `PATCH` away.

```python
def supplier_behaves(self, behaviour):
    control(EDI, "PATCH", "/_mock/partners/ACME", {"behaviour": behaviour})
```

### The happy path

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

### The supplier ships short

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

### The supplier refuses a line

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

### The supplier says nothing

```python
def test_silent_supplier_leaves_nothing_to_post(self):
    self.supplier_behaves("no-ack")
    self.bridge.send(self.po)

    self.assertEqual(self.bridge.receive(), {})
    self.assertEqual(self.ordrsp_idocs(), [])
```

A supplier that never answers is the failure that actually costs money, because nothing looks wrong. With `no-ack`, you can build and test the chase-up logic (alert when a PO has gone N hours without an 855) instead of discovering you need it.

### SAP is down when the answer arrives

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

## Running it

```bash
$ python3 -m unittest -v test_po_bridge
test_rejected_line_reaches_sap ... ok
test_sap_outage_does_not_lose_the_confirmation ... ok
test_short_shipment_is_raised_as_an_exception ... ok
test_silent_supplier_leaves_nothing_to_post ... ok
test_supplier_confirms_everything ... ok

----------------------------------------------------------------------
Ran 5 tests in 0.148s

OK
```

Five scenarios, two systems, under a second. The full code is here: [po_bridge.py](/examples/po-bridge/po_bridge.py) and [test_po_bridge.py](/examples/po-bridge/test_po_bridge.py).

Neither mock implements real business logic, and that's the point. The integration's job is to move documents between two systems correctly and to survive when either one misbehaves. That's exactly what these tests cover.
