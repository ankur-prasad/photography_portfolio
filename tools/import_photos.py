#!/usr/bin/env python3
"""ONE-COMMAND photo import: folder-per-pillar source -> site assets.

    tools/.venv/bin/python tools/import_photos.py --source <dir>

The source dir contains pillar folders (e.g. from Google Drive):
    Night/  Nature/  Ocean/  City/  Cars/  Patterns/  People/  ME-for about/

What it does:
  - folder name = pillar (FOLDERS config below; Cars folds into City,
    "ME-for about" goes to public/about/ for the About page, not a pillar)
  - normalizes filenames: "ANK0285 (1).jpg" -> "ANK0285.jpg", drops ".ARW"/"~N"
  - emits public/web/    1400px jpg(q82)+webp  (lightbox / LCP)
  - emits public/mid/     960px jpg(q78)+webp  (retina grid cells)
  - emits public/thumbs/  480px jpg(q75)+webp  (1x grid cells / mobile)
  - emits public/data/photos.json  {pillars, galleries, meta}  (fetched at
    runtime — keeps 371-photo metadata OUT of the JS bundle)
  - emits src/data/photos.ts  slim: pillars + heroes only (critical path)
  - merges EXIF (camera/lens/settings/year) + tools/photo_meta.json sidecar
  - NEVER copies originals into public/ — full-res stays in the source dir

Incremental: web/thumb files are only regenerated when missing; stale outputs
for photos no longer in the source are pruned.
"""
import os, re, sys, glob, json, argparse, collections
from PIL import Image
from PIL.ExifTags import TAGS

ROOT = os.path.expanduser("~/photography_portfolio")
PUB = f"{ROOT}/site/public"
WEB, MID, THUMBS, DATA_DIR = f"{PUB}/web", f"{PUB}/mid", f"{PUB}/thumbs", f"{PUB}/data"
ABOUT_DIR = f"{PUB}/about"
TS_OUT = f"{ROOT}/site/src/data/photos.ts"
SIDECAR = f"{ROOT}/tools/photo_meta.json"

# folder name (as on disk) -> (pillar key, display title, blurb).
# Folders mapping to the same key fold together (Cars -> City).
# Order here = pillar order on the site. Folders absent from the source are skipped.
FOLDERS = {
    "Night":        ("dark",   "Night",    "Astro, light trails, the moon — the hours most cameras sleep."),
    "Nature":       ("long",   "Nature",   "Distance rendered as haze — ridgelines, canyons, the scale of land."),
    "Ocean":        ("ocean",  "Ocean",    "Open water and what moves through it — waves, salt and fins."),
    "City":         ("hard",   "City",     "Cities and structure — glass, grids and deliberate geometry."),
    "Cars":         ("hard",   None,       None),  # folds into City
    "Travel":       ("far",    "Travel",   "Places worth the journey — ruins, landmarks and far horizons."),
    "Motion":       ("speed",  "Motion",   "Machines, roads and motion held still for a thousandth of a second."),
    "People":       ("people", "People",   "Faces and figures — the moments people give away without noticing."),
    "Patterns":     ("still",  "Patterns", "Negative space and quiet — sand, water, the frames between."),
    "ME-for about": ("_about", None,       None),  # About-page portraits, not a pillar
}

# depth heroes (by normalized stem) — validated against the imported set.
HEROES = ["ANK09879", "ANK00164", "ANK01938", "ANK09500",
          "ANK09212", "ANK08837", "ANK03010", "20160503_164015"]

CAMERA = {"ILCE-7M2": "Sony α 7 II", "SM-G920F": "Samsung Galaxy S6"}
IMG_EXT = (".jpg", ".jpeg", ".png", ".heic")


def clean_stem(fn):
    s = os.path.splitext(fn)[0]
    s = re.sub(r"\.ARW$", "", s, flags=re.I)
    s = re.sub(r"\s*\(\d+\)\s*$", "", s)
    s = re.sub(r"~\d+$", "", s)
    s = re.sub(r"\s+", "_", s.strip())
    return s


def fmt_shutter(exp):
    exp = float(exp)
    return f"{exp:g}s" if exp >= 1 else f"1/{round(1/exp)}s"


def exif_for(path):
    out = {}
    try:
        ex = Image.open(path).getexif()
        base = {TAGS.get(k, k): v for k, v in ex.items()}
        ifd = {TAGS.get(k, k): v for k, v in ex.get_ifd(0x8769).items()}
    except Exception:
        return out
    if base.get("Model"):
        out["camera"] = CAMERA.get(base["Model"], base["Model"])
    if ifd.get("LensModel"):
        out["lens"] = str(ifd["LensModel"]).strip()
    date = ifd.get("DateTimeOriginal") or base.get("DateTime")
    if date:
        out["year"] = str(date)[:4]
    parts = []
    if ifd.get("FocalLength"): parts.append(f"{round(float(ifd['FocalLength']))}mm")
    if ifd.get("FNumber"): parts.append(f"f/{float(ifd['FNumber']):g}")
    if ifd.get("ExposureTime"): parts.append(fmt_shutter(ifd["ExposureTime"]))
    iso = ifd.get("ISOSpeedRatings")
    if iso: parts.append(f"ISO {iso[0] if isinstance(iso, (list, tuple)) else iso}")
    if parts:
        out["settings"] = " · ".join(parts)
    return out


def render(src, dst, max_px, quality, fmt):
    im = Image.open(src)
    im = im.convert("RGB")
    im.thumbnail((max_px, max_px))
    im.save(dst, fmt, quality=quality, method=6) if fmt == "WEBP" else im.save(dst, fmt, quality=quality, optimize=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", required=True, help="dir containing pillar folders")
    args = ap.parse_args()
    src_root = os.path.expanduser(args.source)
    assert os.path.isdir(src_root), f"no such dir: {src_root}"

    for d in (WEB, MID, THUMBS, DATA_DIR):
        os.makedirs(d, exist_ok=True)

    # ---- collect: folder -> files, normalize, dedupe ----
    by_stem = {}           # stem -> (src_path, pillar_key)
    order_keys, pillar_def = [], {}
    about_files = []
    for folder, (key, title, blurb) in FOLDERS.items():
        fdir = os.path.join(src_root, folder)
        if not os.path.isdir(fdir):
            continue
        files = sorted(f for f in os.listdir(fdir) if f.lower().endswith(IMG_EXT))
        if key == "_about":
            about_files = [os.path.join(fdir, f) for f in files]
            continue
        if title and key not in pillar_def:
            pillar_def[key] = (title, blurb)
            order_keys.append(key)
        elif key not in pillar_def:
            # folding folder (e.g. Cars) seen before its primary — register later
            pass
        for f in files:
            stem = clean_stem(f)
            if stem in by_stem:
                print(f"  dupe skipped: {folder}/{f} (stem {stem} already from {by_stem[stem][0]})")
                continue
            by_stem[stem] = (os.path.join(fdir, f), key)
    # ensure folding keys registered even if primary folder absent
    for folder, (key, title, blurb) in FOLDERS.items():
        if key not in pillar_def and title and any(k == key for _, k in by_stem.values()):
            pillar_def[key] = (title, blurb)
            order_keys.append(key)

    print(f"import: {len(by_stem)} photos across {len(order_keys)} pillars"
          + (f" + {len(about_files)} about portraits" if about_files else ""))

    # ---- render web + thumbs (incremental) ----
    made = 0
    valid = set()
    for stem, (src, key) in sorted(by_stem.items()):
        outs = [
            (f"{WEB}/{stem}.jpg",    1400, 82, "JPEG"),
            (f"{WEB}/{stem}.webp",   1400, 82, "WEBP"),
            (f"{MID}/{stem}.jpg",     960, 78, "JPEG"),
            (f"{MID}/{stem}.webp",    960, 78, "WEBP"),
            (f"{THUMBS}/{stem}.jpg",  480, 75, "JPEG"),
            (f"{THUMBS}/{stem}.webp", 480, 75, "WEBP"),
        ]
        for dst, px, q, fmt in outs:
            valid.add(dst)
            if not os.path.exists(dst):
                render(src, dst, px, q, fmt)
                made += 1
    # prune stale outputs
    pruned = 0
    for d in (WEB, MID, THUMBS):
        for f in glob.glob(f"{d}/*"):
            if f not in valid:
                os.remove(f); pruned += 1
    print(f"rendered {made} files, pruned {pruned} stale")

    # ---- about portraits ----
    if about_files:
        os.makedirs(ABOUT_DIR, exist_ok=True)
        for i, src in enumerate(about_files, 1):
            dst = f"{ABOUT_DIR}/ankur-{i}.jpg"
            if not os.path.exists(dst):
                render(src, dst, 1400, 82, "JPEG")
        print(f"about portraits -> public/about/ ({len(about_files)})")

    # ---- metadata ----
    sidecar = json.load(open(SIDECAR)) if os.path.exists(SIDECAR) else {}
    galleries = collections.defaultdict(list)
    meta = {}
    hero_ids = set(HEROES)
    for stem, (src, key) in sorted(by_stem.items()):
        web_src = f"/web/{stem}.jpg"
        galleries[key].append(web_src)
        m = exif_for(src)
        sc = sidecar.get(stem, {})
        for k in ("title", "location", "story"):
            if sc.get(k):
                m[k] = sc[k]
        m["print"] = sc.get("print", True)
        if stem in hero_ids:
            m["depthId"] = stem
        # Rendered pixel size of the /web/ variant. The 3D scenes need an aspect
        # ratio BEFORE the first frame is drawn (a quad has to be sized to
        # something), and bestSizes() in printConfig picks a different SKU list
        # per aspect. Without this both fall back to assuming 3:2, which is
        # wrong for 37 of the 93 photos (21 are portrait, 5 are panoramas).
        try:
            with Image.open(f"{WEB}/{stem}.jpg") as im:
                m["w"], m["h"] = im.size
        except OSError:
            pass
        meta[web_src] = m

    pillars = [{"key": k, "no": f"{i:02d}", "title": pillar_def[k][0], "blurb": pillar_def[k][1]}
               for i, k in enumerate(order_keys, 1)]

    heroes, missing_heroes = [], []
    for h in HEROES:
        if h in by_stem:
            heroes.append({"web": f"/web/{h}.jpg", "depth": f"/depth/{h}__depth.png", "id": h})
        else:
            missing_heroes.append(h)
    if missing_heroes:
        print(f"WARNING: depth heroes missing from source (dropped): {missing_heroes}")

    # ---- outputs ----
    json.dump({"pillars": pillars, "galleries": {k: galleries[k] for k in order_keys}, "meta": meta},
              open(f"{DATA_DIR}/photos.json", "w"), ensure_ascii=False)

    ts = "// generated by tools/import_photos.py — slim critical-path data.\n"
    ts += "// galleries + per-photo meta live in /data/photos.json (see lib/usePhotos).\n"
    ts += "export interface DepthHero { web: string; depth: string; id: string }\n"
    ts += "export const heroes: DepthHero[] = " + json.dumps(heroes, indent=2) + ";\n\n"
    ts += "export interface Pillar { key: string; no: string; title: string; blurb: string }\n"
    ts += "export const pillars: Pillar[] = " + json.dumps(pillars, indent=2, ensure_ascii=False) + ";\n\n"
    ts += ("export interface PhotoMeta { title?: string; location?: string; story?: string; "
           "year?: string; camera?: string; lens?: string; settings?: string; print?: boolean; "
           "depthId?: string; w?: number; h?: number }\n")
    ts += "export interface PhotoData { pillars: Pillar[]; galleries: Record<string, string[]>; "
    ts += "meta: Record<string, PhotoMeta> }\n"
    open(TS_OUT, "w").write(ts)

    titled = sum(1 for m in meta.values() if m.get("title"))
    print(f"wrote photos.json ({len(meta)} photos, {titled} titled) + slim photos.ts")
    print("counts:", {k: len(galleries[k]) for k in order_keys})


if __name__ == "__main__":
    main()
