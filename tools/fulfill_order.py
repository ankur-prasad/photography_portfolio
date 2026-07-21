#!/usr/bin/env python3
"""Fulfill ONE paid order via Prodigi — human-gated, never automatic.

Prodigi has NO sandbox for this account (confirmed: the API key is LIVE).
Every call to POST /orders here is a REAL, billable, shippable order. This
script requires you to type the exact order id back as confirmation before
it does that — there is no --yes / --force flag, on purpose.

Usage:
    tools/.venv/bin/python tools/fulfill_order.py --order '<json>' [--dry-run]

The order JSON is NOT read from the database by this script (it holds no
Supabase key) — fetch the order's fields via the Supabase MCP / dashboard
first, then pass them in. Expected shape:
    {
      "id": "<orders.id>",
      "photo": "ANK01938",
      "sku": "GLOBAL-BOX-16X24",
      "shipping_name": "...",
      "shipping_address": {"line1":"...", "line2":null, "city":"...",
                            "postal_code":"...", "state":null, "country":"DE"},
      "customer_email": "...",
      "color": "natural",         <- from orders.color, OMIT if the finish has no colors
      "option_value": "ImageWrap" <- from orders.option_value, OMIT if the finish has no options
    }

IMPORTANT: pass through orders.color / orders.option_value exactly as stored —
these are what the customer actually picked at checkout. Without them this
script would silently fall back to Prodigi's generic default attribute
(e.g. always "black"), which could ship the wrong physical product.

What it does:
  1. Locates the full-res original locally (assets/originals/<Pillar>/<photo>.jpg)
  2. Uploads it to the private Supabase `print-originals` bucket via a signed
     URL (brokered by the fulfillment-storage edge function — never touches
     the service_role key directly)
  3. Gets a 48h signed download URL for that upload (Prodigi fetches from this)
  4. Re-quotes via Prodigi with the REAL shipping country (final safety check —
     the shop already restricts to probed-deliverable countries, but re-verify
     against the actual address before spending real money)
  5. Prints exactly what would be ordered + the price, and stops
  6. With --dry-run: stops here. Otherwise: asks you to type the order id
     back verbatim to confirm, THEN calls Prodigi POST /orders.
  7. Prints the Prodigi order id/status — YOU update `orders.status` via the
     Supabase MCP/dashboard; this script does not touch the database.
"""
import argparse, glob, hashlib, json, os, re, sys, urllib.request

ROOT = os.path.expanduser("~/photography_portfolio")
ORIGINALS = f"{ROOT}/assets/originals"
CATALOG_PATH = f"{ROOT}/site/public/data/print-catalog.json"


def env(name):
    for line in open(f"{ROOT}/site/.env.local"):
        m = re.match(rf"{name}=(.+)", line.strip())
        if m:
            return m.group(1)
    raise SystemExit(f"{name} not found in site/.env.local")


PRODIGI_KEY = env("PRODIGI_API_KEY")
SUPABASE_URL = env("VITE_SUPABASE_URL")
FULFILLMENT_SECRET = env("FULFILLMENT_ADMIN_SECRET")

PRODIGI_API = "https://api.prodigi.com/v4.0"
STORAGE_FN = f"{SUPABASE_URL}/functions/v1/fulfillment-storage"


def prodigi(method, path, body=None):
    req = urllib.request.Request(
        f"{PRODIGI_API}{path}",
        data=json.dumps(body).encode() if body else None,
        headers={"X-API-Key": PRODIGI_KEY, "Content-Type": "application/json"},
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, {"raw": e.read().decode(errors="replace")}


def storage(action, path):
    req = urllib.request.Request(
        STORAGE_FN,
        data=json.dumps({"action": action, "path": path}).encode(),
        headers={"Content-Type": "application/json", "X-Fulfillment-Secret": FULFILLMENT_SECRET},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def find_original(photo_stem):
    matches = glob.glob(f"{ORIGINALS}/*/{photo_stem}.jpg")
    if not matches:
        raise SystemExit(f"No original found for '{photo_stem}' under {ORIGINALS}/*/")
    if len(matches) > 1:
        raise SystemExit(f"Multiple originals match '{photo_stem}': {matches}")
    return matches[0]


def catalog_lookup(sku):
    catalog = json.load(open(CATALOG_PATH))
    for finish in catalog["finishes"]:
        for size in finish["sizes"]:
            if size["sku"] == sku:
                return finish, size
    raise SystemExit(f"SKU '{sku}' not found in {CATALOG_PATH}")


def upload_original(local_path, dest_path):
    up = storage("upload-url", dest_path)
    data = open(local_path, "rb").read()
    req = urllib.request.Request(up["url"], data=data, method="PUT",
                                  headers={"Content-Type": "image/jpeg"})
    with urllib.request.urlopen(req, timeout=120) as r:
        if r.status not in (200, 201):
            raise SystemExit(f"Upload failed: HTTP {r.status}")
    print(f"  uploaded {len(data)/1e6:.1f}MB -> {dest_path}")
    dl = storage("download-url", dest_path)
    return dl["url"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--order", required=True, help="order JSON, see module docstring")
    ap.add_argument("--dry-run", action="store_true", help="stop before placing the real order")
    args = ap.parse_args()
    order = json.loads(args.order)

    oid, photo, sku = order["id"], order["photo"], order["sku"]
    addr = order["shipping_address"]
    finish, size = catalog_lookup(sku)

    print(f"=== Order {oid} ===")
    print(f"  {finish['label']} — {size['label']}  (SKU {sku})")
    print(f"  ship to: {order.get('shipping_name','?')}, {addr['line1']}, "
          f"{addr['city']} {addr['postal_code']}, {addr['country']}")

    if addr["country"] not in (finish.get("countries") or []):
        print(f"  WARNING: {addr['country']} was not in the probed-deliverable list "
              f"for {finish['label']} at catalog-build time. Re-quoting will confirm either way.")

    local = find_original(photo)
    print(f"  original: {local} ({os.path.getsize(local)/1e6:.1f}MB)")

    print("  uploading + generating signed URL...")
    asset_url = upload_original(local, f"orders/{oid}/{photo}.jpg")

    # final live re-quote against the REAL destination, before spending anything
    s, prod = prodigi("GET", f"/products/{sku}")
    if s != 200:
        raise SystemExit(f"Could not fetch product {sku}: {prod}")
    attrs = {k: (v[0] if v else None) for k, v in (prod.get("product", {}).get("attributes") or {}).items()}

    # Override with what the CUSTOMER actually chose at checkout — never trust
    # the product's generic defaults for anything the shop let them pick.
    if finish.get("colors"):
        chosen_color = order.get("color")
        if not chosen_color:
            raise SystemExit(f"{finish['label']} has colour options {finish['colors']} but "
                              f"the order JSON has no 'color' field — refusing to guess.")
        if chosen_color not in finish["colors"]:
            raise SystemExit(f"order color '{chosen_color}' is not one of {finish['colors']} for {finish['label']}.")
        attrs["color"] = chosen_color
    if finish.get("options"):
        opt_key = next(iter(finish["options"]))
        chosen_opt = order.get("option_value")
        if not chosen_opt:
            raise SystemExit(f"{finish['label']} has '{opt_key}' options {finish['options'][opt_key]} but "
                              f"the order JSON has no 'option_value' field — refusing to guess.")
        if chosen_opt not in finish["options"][opt_key]:
            raise SystemExit(f"order option '{chosen_opt}' is not one of {finish['options'][opt_key]} for {finish['label']}.")
        attrs[opt_key] = chosen_opt
    print(f"  attributes to order: {attrs}")

    qs, quote = prodigi("POST", "/quotes", {
        "shippingMethod": "Standard", "destinationCountryCode": addr["country"],
        "items": [{"sku": sku, "copies": 1, "attributes": attrs, "assets": [{"printArea": "default"}]}],
    })
    if qs != 200 or not (quote.get("quotes")):
        # acrylic-style quirk: some SKUs only quote with empty attrs
        qs, quote = prodigi("POST", "/quotes", {
            "shippingMethod": "Standard", "destinationCountryCode": addr["country"],
            "items": [{"sku": sku, "copies": 1, "attributes": {}, "assets": [{"printArea": "default"}]}],
        })
    if qs != 200 or not quote.get("quotes"):
        raise SystemExit(f"NOT DELIVERABLE to {addr['country']} — refusing to order. {quote}")
    cost = quote["quotes"][0]["costSummary"]
    wholesale = float(cost["items"]["amount"]) + float(cost["shipping"]["amount"])
    print(f"  Prodigi re-quote OK: wholesale €{wholesale:.2f} incl. shipping "
          f"(you charged the customer €{size['retailEUR']})")

    order_body = {
        "shippingMethod": "Standard",
        "idempotencyKey": oid,
        "merchantReference": oid,
        "recipient": {
            "name": order.get("shipping_name") or "Customer",
            "email": order.get("customer_email"),
            "address": {
                "line1": addr["line1"], "line2": addr.get("line2"),
                "townOrCity": addr["city"], "postalOrZipCode": addr["postal_code"],
                "stateOrCounty": addr.get("state"), "countryCode": addr["country"],
            },
        },
        "items": [{
            "sku": sku, "copies": 1, "sizing": "fillPrintArea",
            "attributes": attrs,
            "assets": [{"url": asset_url, "printArea": "default"}],
        }],
    }

    print("\n--- Would POST to Prodigi /orders: ---")
    print(json.dumps({**order_body, "items": [{**order_body["items"][0],
          "assets": [{"url": "<signed-url-omitted>", "printArea": "default"}]}]}, indent=2))

    if args.dry_run:
        print("\n--dry-run: stopping before order placement.")
        return

    print(f"\nThis places a REAL Prodigi order (wholesale ~€{wholesale:.2f}, live account, no sandbox).")
    typed = input(f"Type the order id to confirm ({oid}): ").strip()
    if typed != oid:
        print("Order id did not match — aborted, nothing was ordered.")
        return

    s, result = prodigi("POST", "/orders", order_body)
    if s not in (200, 201):
        print(f"\nPRODIGI ORDER FAILED (HTTP {s}):")
        print(json.dumps(result, indent=2))
        sys.exit(1)

    prodigi_order = result.get("order", {})
    print(f"\nORDER PLACED. Prodigi order id: {prodigi_order.get('id')}  status: {prodigi_order.get('status')}")
    print(f"Now update Supabase: orders.status='fulfilled', prodigi_order_id='{prodigi_order.get('id')}' "
          f"where id='{oid}'.")


if __name__ == "__main__":
    main()
