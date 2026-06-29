import { useEffect } from "react";

/**
 * Sets the document <title> and (optionally) the meta description for a route,
 * restoring the previous values on unmount. SPA-only (Google renders JS, so
 * per-route metadata is indexed; non-JS scrapers fall back to index.html).
 */
export function usePageTitle(title: string, description?: string) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    const meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    const prevDesc = meta?.content;
    if (meta && description) meta.content = description;

    return () => {
      document.title = prevTitle;
      if (meta && prevDesc !== undefined) meta.content = prevDesc;
    };
  }, [title, description]);
}
