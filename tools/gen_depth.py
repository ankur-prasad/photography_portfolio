#!/usr/bin/env python3
"""Generate depth maps for hero images using Depth Anything V2 Small (MPS)."""
import os, glob, sys
import torch
from PIL import Image
from transformers import pipeline

SELECTS = os.path.expanduser("~/photography_portfolio/assets/selects")
OUT = os.path.expanduser("~/photography_portfolio/assets/depth")
os.makedirs(OUT, exist_ok=True)

HEROES = [
    "min__0961",   # White Sands lone figure
    "land__1146",  # Gran Canaria haze layers
    "land__1268",  # Koenigssee
    "land__0798",  # Horseshoe Bend
    "land__0762",  # Grand Canyon sunrise
    "geo__0517",   # One WTC vertical
    "geo__0648",   # Oculus abstract
    "night__0080", # light trails
    "night__0603", # NYC night skyline
    "auto__1461",  # Jaguar E-Type beauty
    "auto__1432",  # E-Type rolling
    "min__0339",   # frozen lake figure
]

device = "mps" if torch.backends.mps.is_available() else "cpu"
pipe = pipeline("depth-estimation", model="depth-anything/Depth-Anything-V2-Small-hf",
                device=device)

for key in HEROES:
    matches = glob.glob(f"{SELECTS}/{key}__*.jpg")
    if not matches:
        print(f"MISS {key}")
        continue
    src = matches[0]
    out = f"{OUT}/{os.path.basename(src)[:-4]}__depth.png"
    if os.path.exists(out):
        print(f"skip {key}")
        continue
    im = Image.open(src).convert("RGB")
    im.thumbnail((1536, 1536))
    depth = pipe(im)["depth"]  # PIL Image, near=bright
    depth = depth.resize(im.size)
    depth.save(out)
    print(f"ok   {key} -> {os.path.basename(out)} ({im.size[0]}x{im.size[1]})")
print("done")
