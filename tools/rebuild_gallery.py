#!/usr/bin/env python3
"""Rebuild the gallery around the new hand-picked photos (6 new pillars).
  - moves non-keeps to public/photos/_setaside/   (reversible)
  - normalizes keep filenames: 'ANK0285 (1).jpg'->'ANK0285.jpg', drops '.ARW'
  - regenerates 1400px web jpg + webp into public/web/
  - emits site/src/data/photos.ts  (galleries by pillar + heroes)
Depth maps are generated separately (gen_depth_new.py). Run from anywhere.
"""
import os, re, glob, shutil, subprocess, json, collections
from PIL import Image

ROOT = os.path.expanduser("~/photography_portfolio")
PHOTOS, WEB, DEPTH = f"{ROOT}/site/public/photos", f"{ROOT}/site/public/web", f"{ROOT}/site/public/depth"
DATA = f"{ROOT}/site/src/data/photos.ts"
SETASIDE = f"{PHOTOS}/_setaside"

PILLARS = {
    "dark":  ("After Dark",    "Astro, light trails, the moon — the hours most cameras sleep."),
    "long":  ("The Long View", "Distance rendered as haze — ridgelines, canyons, the scale of land."),
    "hard":  ("Hard Lines",    "Cities and structure — glass, grids and deliberate geometry."),
    "far":   ("Far Afield",    "Places worth the journey — ruins, landmarks and far horizons."),
    "speed": ("At Speed",      "Machines, roads and motion held still for a thousandth of a second."),
    "still": ("Held Still",    "Negative space and quiet — sand, water, the frames between."),
}
ORDER = ["dark","long","hard","far","speed","still"]

# final approved mapping (original filename -> pillar). keeps only.
ASSIGN = {
    # After Dark
    "20160503_164015.jpg":"dark","ANK00325.jpg":"dark","ANK00330.jpg":"dark","ANK01923.jpg":"dark",
    "ANK02413.jpg":"dark","ANK01925 (3).jpg":"dark","ANK03670.jpg":"dark","ANK03953.jpg":"dark",
    "DSC00247.ARW.jpg":"dark","ANK08119.jpg":"dark","DSC02809.jpg":"dark","DSC02774.jpg":"dark",
    "DSC00274-EDIT.jpg":"dark","DSC00253.jpg":"dark",
    # The Long View
    "ANK00003.jpg":"long","ANK00009.jpg":"long","ANK09969.jpg":"long","ANK01938.jpg":"long",
    "ANK01856.jpg":"long","ANK03364.jpg":"long","ANK03368.jpg":"long","ANK03352.jpg":"long",
    "ANK03396.jpg":"long","ANK09500.jpg":"long","ANK09501.jpg":"long","ANK09470-Enhanced-NR.jpg":"long",
    "ANK09579.jpg":"long","ANK09731.jpg":"long","ANK09748.jpg":"long","ANK09564-Pano.jpg":"long",
    "ANK09543-PANO.jpg":"long","ANK02917-Pano.jpg":"long","ANK02940.jpg":"long","ANK02923.jpg":"long",
    "ANK00528-Pano.jpg":"long","DSC01660.jpg":"long","DSC00427.jpg":"long","DSC01739.jpg":"long",
    "DSC05009.jpg":"long","ANK09879 (1).jpg":"long",
    # Hard Lines
    "ANK08834.jpg":"hard","ANK08837.jpg":"hard","ANK08964-Pano.jpg":"hard","ANK08960.jpg":"hard",
    "ANK09117.jpg":"hard","ANK08909.jpg":"hard","ANK09062.jpg":"hard","DSC03852 (1).jpg":"hard",
    "DSC05199.jpg":"hard","ANK09243.jpg":"hard","ANK09212.jpg":"hard","ANK09220.jpg":"hard",
    "ANK03755-Enhanced-NR.jpg":"hard","ANK03944.jpg":"hard","ANK09153.jpg":"hard","ANK08090.jpg":"hard",
    "DSC04086.jpg":"hard","ANK09313.jpg":"hard",
    # Far Afield
    "ANK00246.jpg":"far","ANK00257.jpg":"far","ANK00285 (1).jpg":"far","ANK02676.jpg":"far",
    "ANK02673.jpg":"far","ANK03010.jpg":"far","ANK03002.jpg":"far","ANK03441.jpg":"far",
    "ANK03458.jpg":"far","ANK03580.jpg":"far","ANK03575.jpg":"far","IMG_20160811_235132.jpg":"far",
    "ANK02998.jpg":"far","ANK03675.jpg":"far",
    # At Speed
    "ANK07505 (1).jpg":"speed","ANK07684.jpg":"speed","ANK09866.jpg":"speed","ANK09947.jpg":"speed",
    "ANK02304.jpg":"speed","ANK00017.jpg":"speed","ANK00049.jpg":"speed","ANK00661.jpg":"speed",
    "ANK00685.jpg":"speed","ANK00014.jpg":"speed","ANK09994.jpg":"speed",
    # Held Still
    "ANK00158.jpg":"still","ANK00164.jpg":"still","ANK00153.jpg":"still","ANK00641.jpg":"still",
    "ANK01596.jpg":"still","ANK09357.jpg":"still","ANK02879.jpg":"still","DSC02274.jpg":"still",
    "ANK02315.jpg":"still","ANK09346.jpg":"still",
}

# heroes for the depth "step-into" feature (by normalized stem). VIEWFINDER = home hero.
HEROES = ["ANK09879","ANK00164","ANK01938","ANK09500","ANK09212","ANK08837","ANK03010","20160503_164015"]
VIEWFINDER = "ANK09879"

def clean_stem(fn):
    s = os.path.splitext(fn)[0]
    s = re.sub(r"\.ARW$", "", s, flags=re.I)
    s = re.sub(r"\s*\(\d+\)\s*$", "", s)
    s = re.sub(r"~\d+$", "", s)
    return s.strip()

# ---- validate before touching anything ----
present = {f for f in os.listdir(PHOTOS) if os.path.isfile(os.path.join(PHOTOS, f))}
missing = [f for f in ASSIGN if f not in present]
assert not missing, f"ASSIGN references missing files: {missing}"
newnames = {}
seen = {}
for orig, pillar in ASSIGN.items():
    nfn = clean_stem(orig) + ".jpg"
    assert nfn not in seen or seen[nfn] == orig, f"name collision: {nfn} <- {orig} & {seen[nfn]}"
    seen[nfn] = orig
    newnames[orig] = nfn
for h in HEROES:
    assert any(clean_stem(o) == h for o in ASSIGN), f"hero {h} not in keeps"
print(f"validated: {len(ASSIGN)} keeps, {len(present)} files present")

# ---- 1. set aside non-keeps ----
os.makedirs(SETASIDE, exist_ok=True)
moved = 0
for f in sorted(present):
    if f not in ASSIGN:
        shutil.move(os.path.join(PHOTOS, f), os.path.join(SETASIDE, f)); moved += 1
print(f"set aside {moved} non-keeps -> {SETASIDE}")

# ---- 2. normalize keep filenames ----
for orig, nfn in newnames.items():
    if orig != nfn:
        shutil.move(os.path.join(PHOTOS, orig), os.path.join(PHOTOS, nfn))

# ---- 3. regenerate web + webp ----
for old in glob.glob(f"{WEB}/*.jpg") + glob.glob(f"{WEB}/*.webp"):
    os.remove(old)
for nfn in newnames.values():
    src, web = os.path.join(PHOTOS, nfn), os.path.join(WEB, nfn)
    subprocess.run(["sips","-s","format","jpeg","-s","formatOptions","82","-Z","1400",
                    src, "--out", web], capture_output=True)
    Image.open(web).convert("RGB").save(os.path.join(WEB, clean_stem(nfn)+".webp"),
                                        "WEBP", quality=82, method=6)
print(f"generated {len(newnames)} web jpg+webp")

# ---- 4. emit manifest ----
galleries = collections.defaultdict(list)
for orig, nfn in newnames.items():
    galleries[ASSIGN[orig]].append(f"/web/{nfn}")
for k in galleries: galleries[k].sort()

heroes = []
for h in HEROES:
    nfn = h + ".jpg"
    heroes.append({"photo": f"/photos/{nfn}", "web": f"/web/{nfn}",
                   "depth": f"/depth/{h}__depth.png", "id": h})

ts  = "// generated by tools/rebuild_gallery.py\n"
ts += "export interface DepthHero { photo: string; web: string; depth: string; id: string }\n"
ts += "export const heroes: DepthHero[] = " + json.dumps(heroes, indent=2) + ";\n\n"
ts += "export interface Pillar { key: string; no: string; title: string; blurb: string }\n"
ts += "export const pillars: Pillar[] = [\n"
for i, k in enumerate(ORDER, 1):
    title, blurb = PILLARS[k]
    ts += f'  {{ key: "{k}", no: "{i:02d}", title: {json.dumps(title)}, blurb: {json.dumps(blurb)} }},\n'
ts += "];\n\n"
ts += "export const galleries: Record<string, string[]> = {\n"
for k in ORDER:
    ts += f'  "{k}": {json.dumps(galleries[k])},\n'
ts += "};\n"
open(DATA, "w").write(ts)
print("wrote", DATA)
print("counts:", {k: len(galleries[k]) for k in ORDER}, "heroes:", len(heroes))
print("VIEWFINDER hero id:", VIEWFINDER)
