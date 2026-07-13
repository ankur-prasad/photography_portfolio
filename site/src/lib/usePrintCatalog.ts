import { useEffect, useState } from "react";
import type { PrintCatalog } from "../data/printConfig";

// The print catalog (finishes / sizes / colors / prices) is generated from the
// live Prodigi account by tools/build_print_catalog.py and fetched once.
// Module-level cache: every consumer shares one request.
let cache: PrintCatalog | null = null;
let pending: Promise<PrintCatalog> | null = null;

export function loadPrintCatalog(): Promise<PrintCatalog> {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = fetch("/data/print-catalog.json")
      .then((r) => {
        if (!r.ok) throw new Error(`print-catalog.json ${r.status}`);
        return r.json();
      })
      .then((d: PrintCatalog) => (cache = d));
  }
  return pending;
}

/** Returns the print catalog, or null on the first frame while it loads. */
export function usePrintCatalog(): PrintCatalog | null {
  const [data, setData] = useState<PrintCatalog | null>(cache);
  useEffect(() => {
    if (!data) loadPrintCatalog().then(setData).catch((e) => console.error("[print-catalog]", e));
  }, [data]);
  return data;
}
