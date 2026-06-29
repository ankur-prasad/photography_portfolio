# Ankur Prasad — Photography × AI Portfolio

A lead-generation portfolio that *is* the proof of skill: cinematic, depth-driven, engineered from scratch. Photographs you can step into.

## What's here

```
photography_portfolio/
├── site/                 # the website (React 18 + TS + Vite + react-three-fiber)
│   ├── src/
│   │   ├── components/    # Hero, Intro, Work, AILab, Services, Contact, Nav
│   │   ├── components/DepthScene.tsx   # custom WebGL parallax shader
│   │   ├── lib/useLenis.ts             # smooth scroll
│   │   └── data/photos.ts              # generated manifest (heroes + galleries)
│   └── public/{photos,web,depth}/      # full-res, web-res, and AI depth maps
├── assets/
│   ├── selects/          # 85 curated web-res exports (2560px)
│   └── depth/            # 12 AI depth maps for the hero/lab pieces
├── contact-sheets/       # 36 labeled contact sheets summarizing all 1,503 source images
└── tools/
    ├── gen_depth.py      # Depth Anything V2 (MPS) → depth maps
    ├── prep_site_assets.py  # build public/ assets + photos.ts manifest
    └── .venv/            # isolated python env for the depth model
```

## Run it

```bash
cd site
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → site/dist
```

## The concept

Five bodies of work, curated from a 1,503-image archive (2016–2025):
**Night & Light · Land & Layers · Geometry · Stillness · Motion.**

The **AI Photo Lab** is the differentiator — every hero photo is run through a
monocular depth network (Depth Anything V2) and rebuilt as a 2.5D scene with a
custom WebGL shader. Move your cursor and the photo shifts perspective; click
*Enter this photo* to step inside it. This seeds a future AI-imaging service line.

## Regenerating assets (when you swap in your own edits)

1. Drop edited JPEGs into `assets/selects/` (keep the `tag__id__name.jpg` naming).
2. Regenerate depth for any new heroes: `tools/.venv/bin/python tools/gen_depth.py`
3. Rebuild the manifest + public assets: `python3 tools/prep_site_assets.py`

The site picks up the new `photos.ts` automatically.

## Note on the current images

The 85 selects are **default RAW renders** (via macOS `sips`) with no Lightroom
edits applied. For launch, export your edited versions and drop them in per the
steps above — it's a clean swap. The structure, motion, and depth all stay.
