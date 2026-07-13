#!/usr/bin/env python3
"""Probe the Prodigi catalog: which wall-art / book SKUs exist on this account,
what they cost wholesale (incl. shipping to DE), and what attributes they need.

READ-ONLY: uses GET /products/{sku} and POST /quotes only — never /orders.

    tools/.venv/bin/python tools/prodigi_catalog.py
"""
import json, os, re, urllib.request

API = "https://api.prodigi.com/v4.0"


def api_key():
    env = os.path.expanduser("~/photography_portfolio/site/.env.local")
    for line in open(env):
        m = re.match(r"PRODIGI_API_KEY=(.+)", line.strip())
        if m:
            return m.group(1)
    raise SystemExit("PRODIGI_API_KEY not found in site/.env.local")


KEY = api_key()


def call(method, path, body=None):
    req = urllib.request.Request(
        f"{API}{path}",
        data=json.dumps(body).encode() if body else None,
        headers={"X-API-Key": KEY, "Content-Type": "application/json"},
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, {}
    except Exception as e:
        return 0, {"error": str(e)}


# candidate SKUs per category — sizes in inches (Prodigi is inch-based).
CANDIDATES = {
    "Fine art print":   ["GLOBAL-FAP-12X16", "GLOBAL-FAP-16X24", "GLOBAL-FAP-24X36",
                          "GLOBAL-HPR-12X16", "GLOBAL-HPR-16X24"],
    "Framed print":     ["GLOBAL-CFP-12X16", "GLOBAL-CFP-16X24", "GLOBAL-CFP-24X36",
                          "GLOBAL-CFPM-16X24", "GLOBAL-FRA-BOX-16X24"],
    "Canvas":           ["GLOBAL-CAN-12X16", "GLOBAL-CAN-16X24", "GLOBAL-CAN-24X36"],
    "Framed canvas":    ["GLOBAL-FCAN-16X24", "GLOBAL-FRA-CAN-16X24", "GLOBAL-CAN-FRA-16X24"],
    "Acrylic":          ["GLOBAL-ACR-12X16", "GLOBAL-ACR-16X24", "GLOBAL-APAN-16X24"],
    "Metal / aluminium":["GLOBAL-MET-12X16", "GLOBAL-MET-16X24", "GLOBAL-ALU-16X24",
                          "GLOBAL-CMD-16X24"],
    "Poster":           ["GLOBAL-EMA-16X24", "GLOBAL-PAP-16X24", "GLOBAL-POS-16X24"],
    "Photo book":       ["BOOK-A4-L-HARD", "BOOK-A4L-H", "GLOBAL-BOOK-A4L",
                          "PBK-A4-L-H", "BOOK-8X8-HARD", "PHOTOBOOK-A4L"],
}


def default_attrs(detail):
    """Pick the first valid value for every required attribute."""
    out = {}
    for name, values in (detail.get("attributes") or {}).items():
        if values:
            out[name] = values[0]
    return out


results = {}
for category, skus in CANDIDATES.items():
    for sku in skus:
        status, d = call("GET", f"/products/{sku}")
        if status != 200:
            continue
        prod = d.get("product", {})
        attrs = default_attrs(prod)
        qbody = {
            "shippingMethod": "Standard",
            "destinationCountryCode": "DE",
            "items": [{
                "sku": sku, "copies": 1,
                "attributes": attrs,
                "assets": [{"printArea": "default"}],
            }],
        }
        qs, q = call("POST", "/quotes", qbody)
        cost = ship = cur = None
        if qs == 200 and q.get("quotes"):
            quote = q["quotes"][0]
            c = quote.get("costSummary", {})
            cost = c.get("items", {}).get("amount")
            ship = c.get("shipping", {}).get("amount")
            cur = c.get("items", {}).get("currency")
        results.setdefault(category, []).append({
            "sku": sku,
            "desc": (prod.get("description") or "")[:60],
            "attributes": {k: v for k, v in (prod.get("attributes") or {}).items()},
            "chosen": attrs,
            "itemCost": cost, "shipping": ship, "currency": cur,
        })

print(json.dumps(results, indent=2, ensure_ascii=False))
found = sum(len(v) for v in results.values())
print(f"\n== {found} valid SKUs across {len(results)} categories ==")
