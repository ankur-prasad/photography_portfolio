#!/usr/bin/env node
/* Repair GLB bufferView alignment: rewrites the BIN chunk so every bufferView
 * starts at a 4-byte-aligned offset (glTF spec). split_body_glb.cjs wrote
 * unaligned views, which three.js tolerates but gltf-transform rejects.
 * Data per view is copied byte-identically — only offsets/padding change. */
const fs = require("fs");

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error("usage: repair_glb_alignment.cjs in.glb out.glb");
  process.exit(1);
}

const buf = fs.readFileSync(inPath);
if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error("not a GLB");

// chunk 0: JSON
const jsonLen = buf.readUInt32LE(12);
if (buf.readUInt32LE(16) !== 0x4e4f534a) throw new Error("first chunk not JSON");
const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString("utf8"));

// chunk 1: BIN
const binHeaderOff = 20 + jsonLen;
const binLen = buf.readUInt32LE(binHeaderOff);
if (buf.readUInt32LE(binHeaderOff + 4) !== 0x004e4942) throw new Error("second chunk not BIN");
const bin = buf.slice(binHeaderOff + 8, binHeaderOff + 8 + binLen);

// re-lay bufferViews at 4-byte-aligned offsets
const views = json.bufferViews || [];
let cursor = 0;
const parts = [];
let moved = 0;
for (const v of views) {
  if (cursor % 4) {
    const pad = 4 - (cursor % 4);
    parts.push(Buffer.alloc(pad));
    cursor += pad;
  }
  const start = v.byteOffset || 0;
  const data = bin.slice(start, start + v.byteLength);
  if ((v.byteOffset || 0) !== cursor) moved++;
  v.byteOffset = cursor;
  parts.push(data);
  cursor += v.byteLength;
}
const newBin = Buffer.concat(parts);
json.buffers[0].byteLength = newBin.length;

// serialize (chunks padded to 4 bytes per spec)
let jsonOut = Buffer.from(JSON.stringify(json), "utf8");
if (jsonOut.length % 4) jsonOut = Buffer.concat([jsonOut, Buffer.from(" ".repeat(4 - (jsonOut.length % 4)))]);
let binOut = newBin;
if (binOut.length % 4) binOut = Buffer.concat([binOut, Buffer.alloc(4 - (binOut.length % 4))]);

const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonOut.length + 8 + binOut.length, 8);
const jsonChunkHeader = Buffer.alloc(8);
jsonChunkHeader.writeUInt32LE(jsonOut.length, 0);
jsonChunkHeader.writeUInt32LE(0x4e4f534a, 4);
const binChunkHeader = Buffer.alloc(8);
binChunkHeader.writeUInt32LE(binOut.length, 0);
binChunkHeader.writeUInt32LE(0x004e4942, 4);

fs.writeFileSync(outPath, Buffer.concat([header, jsonChunkHeader, jsonOut, binChunkHeader, binOut]));
console.log(`repaired: ${views.length} bufferViews, ${moved} realigned`);
