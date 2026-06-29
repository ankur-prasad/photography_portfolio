# Reference Sites — Teardown & Pattern Report

Studied 2026-06-14 by visiting each site live (structure, interactions, tech probed in-browser).
Use this as the design/technical base for Ankur's portfolio (`~/photography_portfolio`).

> **Ethics note:** we clone *structure, layout patterns, and interaction techniques* — never their
> photos, copy, or brand assets. All content stays Ankur's.

---

## Tier 1 — Clone targets

### 1. Brady Perron — bradyperron.com  *(photo/video portfolio)*
- **Tech:** Next.js (Turbopack). Custom WebGL/canvas-free DOM motion (no global GSAP/Lenis exposed — bundled).
- **What it is:** An anti-grid, gallery-like portfolio. Stark **white** canvas, tiny serif wordmark
  bottom-left (`bradyperron`), micro nav bottom-right (`list / grid / about`).
- **Signature interactions:**
  - **Hero = scattered media canvas.** Work thumbnails (video + stills) float at varying scales,
    overlapping, asymmetric, with huge negative space. Feels like loose prints on a light table.
  - **"List" view = concave fanned arc.** Project thumbnails fan along the bottom in a curved arc
    (like a spread deck of cards); a centered **vertical list of project titles** fades in/out, the
    active one enlarged with wide letter-spacing. Toggles to "grid".
- **Type/color:** White bg, near-black text, tiny UI type, enormous letter-spacing on active title.
  Media does all the talking.
- **Steal:** the fanned-arc index; the scattered floating-media hero; confidence to use *white* space.

### 2. 35mm — lab.chakibmzn.com/35mm  *(experimental WebGL story)*
- **Tech:** **Astro + Three.js** (1 `<canvas>`), lil-gui (debug), fonts: Super Sans VF (display) +
  **B612 Mono** (HUD).
- **What it is:** A dark, cinematic, **scroll-scrubbed 3D story** about the Canon F-1. Not a gallery —
  a narrative experience. Single fixed viewport; scroll drives the WebGL timeline (document doesn't scroll).
- **Signature interactions:**
  - Wireframe 3D camera **rotates and explodes** into parts as you scroll (lens, pentaprism, focus screen).
  - **Annotation leader-lines:** dotted lines point from parts to labels ("Pentaprism", "Focus Screen Box").
  - Synced long-form body copy in left/right mono columns appears with scroll position.
  - **Cinematic HUD chrome:** live `120fps / 1512×806` readout (top-left), recording `00:00:31` timer +
    dot (top-right), corner brackets framing the viewport, a **timeline scrubber/ruler** with a ▼ playhead
    at the bottom.
- **Type/color:** `#141414` bg, thin white wireframe, single **orange** accent for labels/active. Monospace body.
- **Steal:** scroll-as-timeline; annotation leader-lines (perfect for the AI depth Lab); the entire
  camera-HUD chrome vocabulary; mono + one-accent restraint.

---

## Tier 2 — First-class inspiration

### 3. mfrports — mfrports.com/portfolio  *(complete photo BUSINESS)*
- **Tech:** Vite SPA (single bundle). Fonts: **Satoshi** (display) + **Lora** (serif) + Inter. Multilingual (EN/DE).
- **What it is:** The most *commercial/complete* reference. Floating pill nav top-center:
  `Home · Portfolio · About · Pricing · FAQ · Blog · Planner` + language switcher.
- **Structure/IA:** Filterable portfolio (dropdown "show all"), 3-col grid of tall rounded photo cards,
  plus full business surface: **Pricing, FAQ, Blog, a booking Planner**.
- **Color:** dark navy (oklch), rounded cards, soft.
- **Steal:** the *business completeness* — this is the lead-gen funnel model (pricing/FAQ/booking) that
  Ankur's goal needs. Less inspiring visually, most useful structurally.

### 4. Tom Carder Media — tomcardermedia.com  *(brand-film studio)*
- **Tech:** **Webflow + GSAP + Lenis + jQuery + HLS.js** (streaming video) + Finsweet attributes.
- **Signature interactions:**
  - **Intro reveal:** two small floating thumbnails expand/animate into the full hero.
  - Full-bleed **video hero** (`Let's make moving pictures.`) in massive condensed bold type.
  - **Images embedded *inline* within headline text** — photos sit between the words of a sentence
    ("From bold `[img]` brands to everyday `[img]` teams we work…"). Distinctive editorial device.
  - Outlined mono uppercase **pill nav** (`WHAT WE DO`, `OUR JOURNEY`, `TAKE THE NEXT STEP →`).
- **Type/color:** Off-white (#eee) editorial sections + dark video hero, **orange** accent, huge condensed display.
- **Steal:** inline-image-in-headline; intro thumbnail-expand reveal; HLS for fast video; the "take the next step" CTA framing.

### 5. Kookie (KOOKIE Kollective) — kookie-kollective.com  *(production / VFX house)*
- **Tech:** **Webflow + GSAP + jQuery**, extremely video-heavy (25 `<video>`).
- **Signature interactions:**
  - **Intro: video masked through giant "KOOKIE" letterforms** on black (text-as-video-mask).
  - Body = **scroll-swapped giant statements** ("WE IMAGINE" → "WE PRODUCE" …) centered, massive black type on light grey.
  - HUD chrome again: section counter `001 — ABOUT US`, `KOOKIE +`, corner social links (IG/LINKEDIN/VIMEO),
    `● REC` bottom-right, `+ + +` divider motif.
- **Steal:** video-masked-by-type hero; scroll-cycling statement headlines; the REC/recording chrome motif.

### 6. Thomas Mamfredas — thomasmamfredas.com  *(videographer/photographer)*
- **Tech:** Custom — **GSAP + Lenis + jQuery + 2 `<canvas>`** (WebGL image/transition effects), 11 videos. (Not Webflow.)
- **Signature interactions:**
  - Full-bleed **B&W cinematic video hero** (high-contrast portrait).
  - Monogram `T \ M`; **`//`-prefixed mono nav** (`// WEDDINGS  // WORKS  // COMMERCIAL  // STORIES  // WORK WITH ME`).
  - Huge **bottom-anchored name** as primary type; philosophy paragraph bottom-right.
  - **Camera-UI motifs** — a focus-bracket reticle in the center of the hero; vertical "Honors" + Awwwards badge.
  - Canvas×2 = likely WebGL hover/transition distortion on media.
- **Steal:** `//` mono nav; service-segmented IA (weddings/commercial/works/stories + "work with me");
  camera focus-reticle motif; B&W cinematic restraint.

---

## Cross-site DNA (the shared playbook)

1. **Cinematic "camera/film" HUD chrome** is the dominant identity device: `● REC`, fps/resolution
   readouts, recording timers, corner brackets, section counters (`001`), focus reticles, scrubber rulers.
   (35mm, Kookie, Thomas.) Cheap to build, instantly premium, and on-theme for a *photographer*.
2. **Huge display type as the hero content** — condensed/bold, often the name or a 3-word manifesto.
   Secondary text is **mono or wide-letter-spaced uppercase**, frequently prefixed (`//`, `001`, `+`).
3. **Two aesthetic poles:** stark **light canvas** (Brady, Tom's editorial sections) vs **dark cinematic**
   (35mm, Kookie, Thomas). Pick one and commit. One accent color max (orange recurs).
4. **Smooth scroll (Lenis) + GSAP ScrollTrigger** is near-universal for the polished tier.
5. **Video-forward**, served via **HLS.js** for performance; lots of `<video>` autoplay loops.
6. **An intro reveal moment** is expected: masked-text video, expanding thumbnails, or a wireframe build.
7. **Anti-grid / asymmetry & negative space** (Brady especially) reads as "gallery", not "template".
8. **Awwwards badges** — these are all award winners; the bar is experiential, not just pretty.

## Tech stack cheat-sheet (technique → how)

| Want this | Use |
|---|---|
| Buttery smooth scroll | **Lenis** (already in our site) |
| Scroll-triggered / scrubbed timelines | **GSAP + ScrollTrigger** (Webflow tier) or Framer Motion `useScroll` (our tier) |
| 3D / exploded models / wireframe | **Three.js** (we have it) — 35mm uses Astro+Three |
| Fast looping/streaming video | **HLS.js**, `<video autoplay muted loop playsinline>` |
| Bespoke experimental (full control) | hand-coded **Next.js** (Brady) or **Astro+Three** (35mm) |
| Fast polished agency build | **Webflow + GSAP + Lenis + Finsweet** (Tom, Kookie) |
| WebGL hover/transition distortion | a 2nd `<canvas>` w/ shaders (Thomas) — OGL/custom GLSL |

## Recommendations for Ankur's site (vs current build)

Our build is already in the **dark-cinematic + WebGL + scroll-cinema** camp — same family as 35mm /
Kookie / Thomas. Highest-leverage additions, in order:

1. **Add cinematic HUD chrome** — a fixed frame: `● REC`-style dot, a frame/section counter, corner
   brackets, maybe a subtle fps/coords readout. Ties the whole site to the *camera/photographer*
   identity and unifies hero + galleries + AI Lab. (Borrow 35mm/Kookie/Thomas.) **Cheap, high identity.**
2. **Annotation leader-lines in the AI Lab** — label the depth/parts of an "enter the photo" piece the
   way 35mm labels camera parts. Makes the AI tech legible and impressive. (Borrow 35mm.)
3. **A "Works" index with a fanned-arc or scattered view** — an alternative to the pillar grid for
   browsing all shoots. (Borrow Brady Perron.)
4. **`//`-prefixed mono nav + a mono caption face** — pairs with our Space Grotesk; add a mono
   (e.g. B612 Mono / Geist Mono) for HUD/captions. (Borrow Thomas / 35mm.)
5. **Intro reveal** — optional masked-photo-through-wordmark or expanding-thumbnails open. (Kookie/Tom.)
   Keep it skippable/fast — Ankur explicitly does NOT want a blocking gate.
6. **Inline-image-in-headline** for the intro statement. (Borrow Tom Carder.)
7. **Business completeness for the funnel** — keep Services + Contact; consider Pricing/FAQ later for
   the lead-gen goal. (Borrow mfrports.)

Stack stays: React + Vite + Framer Motion + Lenis + Three.js (no need to switch to Webflow — we get
the same look hand-coded, which itself is the web-design proof Ankur wants to sell).
