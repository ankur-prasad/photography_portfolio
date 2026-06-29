#!/usr/bin/env python3
"""Regenerate src/data/photos.ts WITH per-photo metadata. Safe to re-run; does
NO file operations. Merges:
  - pillar membership (ASSIGN, must match rebuild_gallery.py)
  - EXIF read from site/public/photos/*.jpg  (camera, lens, settings, year)
  - tools/photo_meta.json  — hand-authored {title, location, story, print} by stem
"""
import os, re, json, collections
from PIL import Image
from PIL.ExifTags import TAGS

ROOT = os.path.expanduser("~/photography_portfolio")
PHOTOS, DATA = f"{ROOT}/site/public/photos", f"{ROOT}/site/src/data/photos.ts"
SIDECAR = f"{ROOT}/tools/photo_meta.json"

PILLARS = {
    "dark":  ("After Dark",    "Astro, light trails, the moon — the hours most cameras sleep."),
    "long":  ("The Long View", "Distance rendered as haze — ridgelines, canyons, the scale of land."),
    "hard":  ("Hard Lines",    "Cities and structure — glass, grids and deliberate geometry."),
    "far":   ("Far Afield",    "Places worth the journey — ruins, landmarks and far horizons."),
    "speed": ("At Speed",      "Machines, roads and motion held still for a thousandth of a second."),
    "still": ("Held Still",    "Negative space and quiet — sand, water, the frames between."),
}
ORDER = ["dark","long","hard","far","speed","still"]
HEROES = ["ANK09879","ANK00164","ANK01938","ANK09500","ANK09212","ANK08837","ANK03010","20160503_164015"]
CAMERA = {"ILCE-7M2": "Sony α 7 II", "SM-G920F": "Samsung Galaxy S6"}

# pillar membership by ORIGINAL filename (matches rebuild_gallery.py)
ASSIGN = {
    "20160503_164015.jpg":"dark","ANK00325.jpg":"dark","ANK00330.jpg":"dark","ANK01923.jpg":"dark",
    "ANK02413.jpg":"dark","ANK01925 (3).jpg":"dark","ANK03670.jpg":"dark","ANK03953.jpg":"dark",
    "DSC00247.ARW.jpg":"dark","ANK08119.jpg":"dark","DSC02809.jpg":"dark","DSC02774.jpg":"dark",
    "DSC00274-EDIT.jpg":"dark","DSC00253.jpg":"dark",
    "ANK00003.jpg":"long","ANK00009.jpg":"long","ANK09969.jpg":"long","ANK01938.jpg":"long",
    "ANK01856.jpg":"long","ANK03364.jpg":"long","ANK03368.jpg":"long","ANK03352.jpg":"long",
    "ANK03396.jpg":"long","ANK09500.jpg":"long","ANK09501.jpg":"long","ANK09470-Enhanced-NR.jpg":"long",
    "ANK09579.jpg":"long","ANK09731.jpg":"long","ANK09748.jpg":"long","ANK09564-Pano.jpg":"long",
    "ANK09543-PANO.jpg":"long","ANK02917-Pano.jpg":"long","ANK02940.jpg":"long","ANK02923.jpg":"long",
    "ANK00528-Pano.jpg":"long","DSC01660.jpg":"long","DSC00427.jpg":"long","DSC01739.jpg":"long",
    "DSC05009.jpg":"long","ANK09879 (1).jpg":"long",
    "ANK08834.jpg":"hard","ANK08837.jpg":"hard","ANK08964-Pano.jpg":"hard","ANK08960.jpg":"hard",
    "ANK09117.jpg":"hard","ANK08909.jpg":"hard","ANK09062.jpg":"hard","DSC03852 (1).jpg":"hard",
    "DSC05199.jpg":"hard","ANK09243.jpg":"hard","ANK09212.jpg":"hard","ANK09220.jpg":"hard",
    "ANK03755-Enhanced-NR.jpg":"hard","ANK03944.jpg":"hard","ANK09153.jpg":"hard","ANK08090.jpg":"hard",
    "DSC04086.jpg":"hard","ANK09313.jpg":"hard",
    "ANK00246.jpg":"far","ANK00257.jpg":"far","ANK00285 (1).jpg":"far","ANK02676.jpg":"far",
    "ANK02673.jpg":"far","ANK03010.jpg":"far","ANK03002.jpg":"far","ANK03441.jpg":"far",
    "ANK03458.jpg":"far","ANK03580.jpg":"far","ANK03575.jpg":"far","IMG_20160811_235132.jpg":"far",
    "ANK02998.jpg":"far","ANK03675.jpg":"far",
    "ANK07505 (1).jpg":"speed","ANK07684.jpg":"speed","ANK09866.jpg":"speed","ANK09947.jpg":"speed",
    "ANK02304.jpg":"speed","ANK00017.jpg":"speed","ANK00049.jpg":"speed","ANK00661.jpg":"speed",
    "ANK00685.jpg":"speed","ANK00014.jpg":"speed","ANK09994.jpg":"speed",
    "ANK00158.jpg":"still","ANK00164.jpg":"still","ANK00153.jpg":"still","ANK00641.jpg":"still",
    "ANK01596.jpg":"still","ANK09357.jpg":"still","ANK02879.jpg":"still","DSC02274.jpg":"still",
    "ANK02315.jpg":"still","ANK09346.jpg":"still",
}

def clean_stem(fn):
    s = os.path.splitext(fn)[0]
    s = re.sub(r"\.ARW$", "", s, flags=re.I)
    s = re.sub(r"\s*\(\d+\)\s*$", "", s)
    s = re.sub(r"~\d+$", "", s)
    return s.strip()

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
    if base.get("Model"): out["camera"] = CAMERA.get(base["Model"], base["Model"])
    if ifd.get("LensModel"): out["lens"] = str(ifd["LensModel"]).strip()
    date = ifd.get("DateTimeOriginal") or base.get("DateTime")
    if date: out["year"] = str(date)[:4]
    parts = []
    if ifd.get("FocalLength"): parts.append(f"{round(float(ifd['FocalLength']))}mm")
    if ifd.get("FNumber"): parts.append(f"f/{float(ifd['FNumber']):g}")
    if ifd.get("ExposureTime"): parts.append(fmt_shutter(ifd["ExposureTime"]))
    iso = ifd.get("ISOSpeedRatings")
    if iso: parts.append(f"ISO {iso[0] if isinstance(iso,(list,tuple)) else iso}")
    if parts: out["settings"] = " · ".join(parts)
    return out

sidecar = json.load(open(SIDECAR)) if os.path.exists(SIDECAR) else {}
norm_to_pillar = {clean_stem(o) + ".jpg": p for o, p in ASSIGN.items()}
present = sorted(f for f in os.listdir(PHOTOS) if f.lower().endswith(".jpg"))
hero_ids = set(HEROES)

galleries = collections.defaultdict(list)
meta = {}
for fn in present:
    pillar = norm_to_pillar.get(fn)
    if not pillar:
        print("UNMAPPED (skipped):", fn); continue
    src = f"/web/{fn}"
    galleries[pillar].append(src)
    stem = os.path.splitext(fn)[0]
    m = exif_for(f"{PHOTOS}/{fn}")
    sc = sidecar.get(stem, {})
    for key in ("title", "location", "story"):
        if sc.get(key): m[key] = sc[key]
    m["print"] = sc.get("print", True)
    if stem in hero_ids: m["depthId"] = stem
    meta[src] = m
for k in galleries: galleries[k].sort()

heroes = [{"photo": f"/photos/{h}.jpg", "web": f"/web/{h}.jpg",
           "depth": f"/depth/{h}__depth.png", "id": h} for h in HEROES]

ts  = "// generated by tools/build_manifest.py\n"
ts += "export interface DepthHero { photo: string; web: string; depth: string; id: string }\n"
ts += "export const heroes: DepthHero[] = " + json.dumps(heroes, indent=2) + ";\n\n"
ts += "export interface Pillar { key: string; no: string; title: string; blurb: string }\n"
ts += "export const pillars: Pillar[] = [\n"
for i, k in enumerate(ORDER, 1):
    t, b = PILLARS[k]
    ts += f'  {{ key: "{k}", no: "{i:02d}", title: {json.dumps(t)}, blurb: {json.dumps(b)} }},\n'
ts += "];\n\n"
ts += ("export interface PhotoMeta { title?: string; location?: string; story?: string; "
       "year?: string; camera?: string; lens?: string; settings?: string; print?: boolean; "
       "depthId?: string }\n")
ts += "export const meta: Record<string, PhotoMeta> = " + json.dumps(meta, indent=2, ensure_ascii=False) + ";\n\n"
ts += "export const galleries: Record<string, string[]> = {\n"
for k in ORDER:
    ts += f'  "{k}": {json.dumps(galleries[k])},\n'
ts += "};\n"
open(DATA, "w").write(ts)

named = sum(1 for m in meta.values() if m.get("title"))
located = sum(1 for m in meta.values() if m.get("location"))
print(f"wrote {DATA}: {len(meta)} photos | titles {named} | locations {located} | heroes {len(heroes)}")
print("counts:", {k: len(galleries[k]) for k in ORDER})
