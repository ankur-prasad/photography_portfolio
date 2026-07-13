#!/usr/bin/env python3
"""Generate depth maps for the hero images (Depth Anything V2 Small, MPS).
Reads originals from assets/originals/<Pillar>/ (recursive), writes
site/public/depth/<stem>__depth.png."""
import os, glob
import torch
from PIL import Image
from transformers import pipeline

PHOTOS = os.path.expanduser("~/photography_portfolio/assets/originals")
OUT = os.path.expanduser("~/photography_portfolio/site/public/depth")
os.makedirs(OUT, exist_ok=True)

HEROES = ["ANK09879", "ANK00164", "ANK01938", "ANK09500",
          "ANK09212", "ANK08837", "ANK03010", "20160503_164015"]

# drop stale depth maps from the old photo set
for old in glob.glob(f"{OUT}/*.png"):
    os.remove(old)

device = "mps" if torch.backends.mps.is_available() else "cpu"
print("device:", device)
pipe = pipeline("depth-estimation", model="depth-anything/Depth-Anything-V2-Small-hf", device=device)

for stem in HEROES:
    matches = glob.glob(f"{PHOTOS}/*/{stem}.jpg") or glob.glob(f"{PHOTOS}/{stem}.jpg")
    if not matches:
        print("MISS", stem); continue
    src = matches[0]
    im = Image.open(src).convert("RGB")
    im.thumbnail((1536, 1536))
    depth = pipe(im)["depth"].resize(im.size)
    depth.save(f"{OUT}/{stem}__depth.png")
    print(f"ok   {stem} ({im.size[0]}x{im.size[1]})")
print("done")
