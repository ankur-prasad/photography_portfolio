#!/usr/bin/env python3
"""First-pass categorization + curation of the hand-picked photos.
Reads public/photos, applies the ASSIGN map (keeps only), treats everything
else as a cut, validates names, and renders per-pillar review sheets to /tmp.
Nothing is moved or deleted — this only produces review artifacts."""
import os, math, collections
from PIL import Image, ImageDraw, ImageFont

PHOTOS = os.path.expanduser("~/photography_portfolio/site/public/photos")
OUT = "/tmp/pillars"; os.makedirs(OUT, exist_ok=True)

PILLARS = {
    "dark":  ("After Dark",   "Astro, light trails, the moon — the hours most cameras sleep."),
    "long":  ("The Long View","Distance as haze, ridgelines and canyons, the scale of land."),
    "hard":  ("Hard Lines",   "Cities and structure — glass, grids and deliberate geometry."),
    "far":   ("Far Afield",   "Places worth the journey — ruins, landmarks, far horizons."),
    "speed": ("At Speed",     "Machines, roads and motion held still for a thousandth of a second."),
    "still": ("Held Still",   "Negative space and quiet — sand, water, the frames between."),
}

# keeps only: filename -> pillar
ASSIGN = {
    # --- After Dark ---
    "20160503_164013.jpg":"dark","ANK00325.jpg":"dark","ANK00330.jpg":"dark",
    "ANK01923.jpg":"dark","ANK02413.jpg":"dark","ANK01925 (3).jpg":"dark",
    "ANK03670.jpg":"dark","ANK03953.jpg":"dark","DSC00247.ARW.jpg":"dark",
    "ANK08119.jpg":"dark","DSC02809.jpg":"dark","DSC02774.jpg":"dark",
    "DSC00274-EDIT.jpg":"dark","DSC00253.jpg":"dark",
    # --- The Long View ---
    "ANK00003.jpg":"long","ANK00009.jpg":"long","ANK09969.jpg":"long",
    "ANK01938.jpg":"long","ANK01856.jpg":"long","ANK03364.jpg":"long",
    "ANK03368.jpg":"long","ANK03352.jpg":"long","ANK03396.jpg":"long",
    "ANK09500.jpg":"long","ANK09501.jpg":"long","ANK09470-Enhanced-NR.jpg":"long",
    "ANK09579.jpg":"long","ANK09731.jpg":"long","ANK09748.jpg":"long",
    "ANK09564-Pano.jpg":"long","ANK09543-PANO.jpg":"long","ANK02917-Pano.jpg":"long",
    "ANK02940.jpg":"long","ANK02923.jpg":"long","ANK00528-Pano.jpg":"long",
    "DSC01660.jpg":"long","DSC00427.jpg":"long","DSC01739.jpg":"long","DSC05009.jpg":"long",
    # --- Hard Lines ---
    "ANK08834.jpg":"hard","ANK08837.jpg":"hard","ANK08964-Pano.jpg":"hard",
    "ANK08960.jpg":"hard","ANK09117.jpg":"hard","ANK08909.jpg":"hard",
    "ANK09062.jpg":"hard","DSC03852 (1).jpg":"hard","DSC05199.jpg":"hard",
    "ANK09243.jpg":"hard","ANK09212.jpg":"hard","ANK09220.jpg":"hard",
    "ANK03755-Enhanced-NR.jpg":"hard","ANK03944.jpg":"hard","ANK09153.jpg":"hard",
    "ANK08090.jpg":"hard","DSC04086.jpg":"hard","ANK09313.jpg":"hard",
    # --- Far Afield ---
    "ANK00246.jpg":"far","ANK00257.jpg":"far","ANK00285 (1).jpg":"far",
    "ANK02676.jpg":"far","ANK02673.jpg":"far","ANK03010.jpg":"far","ANK03002.jpg":"far",
    "ANK03441.jpg":"far","ANK03458.jpg":"far","ANK03580.jpg":"far","ANK03575.jpg":"far",
    "IMG_20160811_235132.jpg":"far","ANK02998.jpg":"far","ANK03675.jpg":"far",
    # --- At Speed ---
    "ANK07505 (1).jpg":"speed","ANK07684.jpg":"speed","ANK09866.jpg":"speed",
    "ANK09947.jpg":"speed","ANK02304.jpg":"speed","ANK00017.jpg":"speed",
    "ANK00049.jpg":"speed","ANK00661.jpg":"speed","ANK00685.jpg":"speed",
    "ANK00014.jpg":"speed","ANK09879 (1).jpg":"speed","ANK09994.jpg":"speed",
    # --- Held Still ---
    "ANK00158.jpg":"still","ANK00164.jpg":"still","ANK00153.jpg":"still",
    "ANK00641.jpg":"still","ANK01596.jpg":"still","ANK09357.jpg":"still",
    "ANK02879.jpg":"still","DSC02274.jpg":"still","ANK02315.jpg":"still","ANK09346.jpg":"still",
}

allfiles = sorted(f for f in os.listdir(PHOTOS) if f.lower().endswith((".jpg",".jpeg")))
missing = [f for f in ASSIGN if f not in allfiles]
print("ASSIGN entries that DON'T match a real file (fix these):", missing or "none")

keeps = collections.defaultdict(list)
for f in allfiles:
    if f in ASSIGN: keeps[ASSIGN[f]].append(f)
cuts = [f for f in allfiles if f not in ASSIGN]

print(f"\nTotal jpgs: {len(allfiles)}   KEEP: {sum(len(v) for v in keeps.values())}   CUT: {len(cuts)}")
for k,(title,_) in PILLARS.items():
    print(f"  {title:14s} {len(keeps[k])}")

def sheet(name, files, cols=4):
    if not files: return
    CW,CH,LBL,PAD = 360,250,24,8
    rows = math.ceil(len(files)/cols); cw,ch = CW+PAD, CH+LBL+PAD
    img = Image.new("RGB",(cw*cols+PAD, ch*rows+PAD),(16,16,18)); d=ImageDraw.Draw(img)
    try: font=ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf",15)
    except Exception: font=ImageFont.load_default()
    for i,f in enumerate(files):
        r,c=divmod(i,cols); x,y=PAD+c*cw, PAD+r*ch
        try:
            im=Image.open(os.path.join(PHOTOS,f)).convert("RGB"); im.thumbnail((CW,CH))
            img.paste(im,(x+(CW-im.width)//2, y+(CH-im.height)//2))
        except Exception as e: d.text((x+6,y+6),f"ERR {e}",fill=(255,80,80),font=font)
        d.text((x+4,y+CH+4),f,fill=(220,220,210),font=font)
    img.save(f"{OUT}/{name}.jpg",quality=88)

for k,(title,_) in PILLARS.items():
    sheet(f"pillar_{k}", keeps[k])
sheet("CUT", cuts, cols=5)
print(f"\nReview sheets in {OUT}/  (pillar_*.jpg + CUT.jpg)")
