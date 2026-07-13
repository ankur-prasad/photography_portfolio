#!/usr/bin/env python3
"""Build the print-shop catalog from the live Prodigi account (READ-ONLY:
GET /products + POST /quotes — never /orders).

    tools/.venv/bin/python tools/build_print_catalog.py

For every approved finish family, validates candidate size SKUs, reads their
attributes (frame colors, wraps, finishes) and real product dimensions, quotes
wholesale cost (items + shipping) to DE, derives retail, and writes
site/public/data/print-catalog.json for the shop UI.

Retail rule: ceil(wholesale * 3.3 / 10) * 10 - 1  (e.g. 49.70 -> 169).
Manual overrides: tools/print_prices.json  { "<SKU>": <retailEUR>, ... }

GOTCHA (learned the hard way): some products (acrylic) REJECT quotes that pass
their own default attributes — on failure we retry with empty attributes.
"""
import json, math, os, re, urllib.request

API = "https://api.prodigi.com/v4.0"
ROOT = os.path.expanduser("~/photography_portfolio")
OUT = f"{ROOT}/site/public/data/print-catalog.json"
OVERRIDES_PATH = f"{ROOT}/tools/print_prices.json"


def api_key():
    for line in open(f"{ROOT}/site/.env.local"):
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


def quote_de(sku, attrs):
    """Quote to DE; on failure retry with empty attributes (acrylic quirk)."""
    for attempt_attrs in (attrs, {}):
        s, q = call("POST", "/quotes", {
            "shippingMethod": "Standard", "destinationCountryCode": "DE",
            "items": [{"sku": sku, "copies": 1, "attributes": attempt_attrs,
                        "assets": [{"printArea": "default"}]}],
        })
        if s == 200 and q.get("quotes"):
            c = q["quotes"][0]["costSummary"]
            return float(c["items"]["amount"]) + float(c["shipping"]["amount"])
    return None


# Approved finishes (Ankur, 2026-07-09) — order = UI order.
# sizes are candidate tokens; invalid ones are skipped by validation.
RECT = ["8X10", "8X12", "11X14", "12X16", "12X18", "16X20", "16X24",
        "18X24", "20X28", "20X30", "24X32", "24X36", "28X40"]
SQ = ["8X8", "10X10", "12X12", "16X16", "20X20", "24X24", "30X30"]

FAMILIES = [
    dict(key="print", label="Print only", type="print", prefix="GLOBAL-HPR",
         desc="Hahnemühle Photo Rag — museum-grade cotton paper, ready to frame",
         frameCm=0, sizes=RECT + SQ),
    dict(key="box-frame", label="Box framed", type="box-frame", prefix="GLOBAL-BOX",
         desc="Deep box frame with white mount — black, white or natural wood",
         frameCm=4, sizes=RECT + SQ + ["28X40", "40X40", "50X50"]),
    dict(key="canvas", label="Canvas", type="canvas", prefix="ECO-CAN",
         desc="Stretched canvas, image wraps the edge, ready to hang",
         frameCm=2, sizes=RECT + SQ),
    dict(key="framed-canvas", label="Framed canvas", type="framed-canvas", prefix="ECO-FRA-CAN",
         desc="Float-framed canvas — gallery presentation in six frame colours",
         frameCm=4, sizes=RECT + SQ),
    dict(key="acrylic", label="Acrylic", type="acrylic", prefix="GLOBAL-MOU-ACRY",
         desc="Print behind 4mm acrylic glass — vivid, frameless, modern",
         frameCm=0, sizes=["8X8", "8X12", "12X12", "12X16", "16X24", "16X48", "20X30", "24X36"]),
    dict(key="dibond", label="Metal (Dibond)", type="dibond", prefix="MOU-DI",
         desc="Aluminium composite — sleek, rigid, frameless",
         frameCm=0,
         sizes=["15X20", "20X30", "30X40", "30X30", "40X40", "40X60", "50X50",
                 "50X75", "60X90", "10X46", "15X71", "20X97", "30X91"]),
]

overrides = json.load(open(OVERRIDES_PATH)) if os.path.exists(OVERRIDES_PATH) else {}


def retail_for(sku, wholesale):
    if sku in overrides:
        return overrides[sku]
    return int(math.ceil(wholesale * 3.3 / 10) * 10 - 1)


catalog = []
for fam in FAMILIES:
    entry = dict(key=fam["key"], label=fam["label"], desc=fam["desc"],
                 type=fam["type"], frameCm=fam["frameCm"], colors=[], options={}, sizes=[])
    for token in fam["sizes"]:
        sku = f"{fam['prefix']}-{token}"
        s, d = call("GET", f"/products/{sku}")
        if s != 200:
            continue
        prod = d.get("product", {})
        pdim = prod.get("productDimensions") or {}
        w, h, units = pdim.get("width"), pdim.get("height"), pdim.get("units", "in")
        if not (w and h):  # fall back to token (inches for GLOBAL, cm for MOU-DI)
            a, b = token.split("X")
            w, h = float(a), float(b)
            units = "cm" if fam["prefix"] == "MOU-DI" else "in"
        to_cm = 2.54 if units == "in" else 1.0
        w_cm, h_cm = round(w * to_cm), round(h * to_cm)
        attrs_all = prod.get("attributes") or {}
        defaults = {k: (v[0] if v else None) for k, v in attrs_all.items()}
        wholesale = quote_de(sku, defaults)
        if wholesale is None:
            print(f"  skip (unquotable): {sku}")
            continue
        if not entry["colors"] and attrs_all.get("color"):
            entry["colors"] = attrs_all["color"]
        if not entry["options"]:
            entry["options"] = {k: v for k, v in attrs_all.items() if len(v) > 1 and k != "color"}
        long_cm, short_cm = max(w_cm, h_cm), min(w_cm, h_cm)
        entry["sizes"].append(dict(
            sku=sku, longCm=long_cm, shortCm=short_cm,
            aspect=round(long_cm / short_cm, 4),
            label=f"{short_cm} × {long_cm} cm",
            wholesaleEUR=round(wholesale, 2),
            retailEUR=retail_for(sku, wholesale),
        ))
    entry["sizes"].sort(key=lambda s: s["longCm"] * s["shortCm"])
    if entry["sizes"]:
        catalog.append(entry)
        print(f"{fam['label']:16s} {len(entry['sizes'])} sizes | colors: {entry['colors'] or '-'} | "
              f"opts: {list(entry['options']) or '-'}")
    else:
        print(f"{fam['label']:16s} NO VALID SIZES — dropped")

json.dump({"finishes": catalog}, open(OUT, "w"), ensure_ascii=False, indent=1)
total = sum(len(f["sizes"]) for f in catalog)
print(f"\nwrote {OUT}: {len(catalog)} finishes, {total} size SKUs")
