#!/usr/bin/env python3
"""Determine, per approved finish, which countries Prodigi can actually
deliver to — so the shop only offers shipping to countries that will really
work, instead of a single guessed list applied to every finish.

READ-ONLY (POST /quotes only — never /orders). For each finish, quotes ONE
representative SKU against every candidate country; a successful quote means
that finish's print lab network covers that country.

    tools/.venv/bin/python tools/check_country_availability.py

Patches the existing site/public/data/print-catalog.json in place, adding a
"countries" array (ISO codes) to each finish. Does NOT touch pricing/sizes —
run build_print_catalog.py first if those need regenerating.
"""
import json, os, re, urllib.request

API = "https://api.prodigi.com/v4.0"
ROOT = os.path.expanduser("~/photography_portfolio")
CATALOG_PATH = f"{ROOT}/site/public/data/print-catalog.json"


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


def deliverable(sku, attrs, country):
    """True if a quote succeeds for this sku+country. Retries with empty
    attrs on failure (acrylic-style quirk — see build_print_catalog.py)."""
    for attempt_attrs in (attrs, {}):
        s, q = call("POST", "/quotes", {
            "shippingMethod": "Standard", "destinationCountryCode": country,
            "items": [{"sku": sku, "copies": 1, "attributes": attempt_attrs,
                        "assets": [{"printArea": "default"}]}],
        })
        if s == 200 and q.get("quotes"):
            return True
    return False


# one representative SKU per approved finish (mid-size, in stock per the
# generated catalog) — country coverage is a property of the finish's print
# lab network, not the specific size, so one probe per finish is sufficient.
REPRESENTATIVE = {
    "print": "GLOBAL-HPR-16X24",
    "box-frame": "GLOBAL-BOX-16X24",
    "canvas": "ECO-CAN-16X24",
    "framed-canvas": "ECO-FRA-CAN-16X24",
    "acrylic": "GLOBAL-MOU-ACRY-16X24",
    "dibond": "MOU-DI-20X30",
}

# candidate countries — the set currently offered in the shop. Extend this
# list to test broader coverage; each entry costs one Prodigi API call per finish.
CANDIDATES = ["DE", "AT", "CH", "FR", "IT", "ES", "NL", "BE", "LU", "GB", "IE",
              "US", "CA", "AU", "NZ", "SE", "DK", "NO", "FI", "PL", "PT"]


def default_attrs(sku):
    s, d = call("GET", f"/products/{sku}")
    if s != 200:
        return {}
    prod = d.get("product", {})
    return {k: (v[0] if v else None) for k, v in (prod.get("attributes") or {}).items()}


catalog = json.load(open(CATALOG_PATH))
results = {}
for finish in catalog["finishes"]:
    key = finish["key"]
    sku = REPRESENTATIVE.get(key)
    if not sku:
        print(f"  no representative SKU for {key}, skipping")
        continue
    attrs = default_attrs(sku)
    ok = []
    for country in CANDIDATES:
        if deliverable(sku, attrs, country):
            ok.append(country)
    finish["countries"] = ok
    results[key] = ok
    print(f"{key:14s} ({sku}): {len(ok)}/{len(CANDIDATES)} -> {ok}")

json.dump(catalog, open(CATALOG_PATH, "w"), ensure_ascii=False, indent=1)
print(f"\nwrote countries[] into {CATALOG_PATH}")

# sanity: report the intersection too, for reference
common = set(CANDIDATES)
for v in results.values():
    common &= set(v)
print("countries where EVERY finish ships:", sorted(common))
