import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { motion } from "framer-motion";
import { locations } from "../data/locations";

const DEG = Math.PI / 180;
const ACCENT = new THREE.Color("#e0452f");
const R = 1;

function latLngToVec3(lat: number, lng: number, radius = R): THREE.Vector3 {
  const phi = (90 - lat) * DEG;
  const theta = (lng + 180) * DEG;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

export default function Globe() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0); // bump to rebuild after WebGL context loss

  const targetRot = useRef({ x: 0.18, y: 0 });
  const draggingRef = useRef(false);
  const lastRef = useRef({ x: 0, y: 0 });
  const autoRef = useRef(true);
  const retryRef = useRef(0);

  useEffect(() => {
    const mount = mountRef.current!;
    let w = mount.clientWidth;
    let h = mount.clientHeight;
    if (!w || !h) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100);
    camera.position.z = 3.1;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(w, h);
    mount.appendChild(renderer.domElement);

    const globe = new THREE.Group();
    scene.add(globe);

    // base sphere — deep navy, slightly lit so it reads as a solid body
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(R, 64, 64),
      new THREE.MeshBasicMaterial({ color: 0x1a1b24 })
    );
    globe.add(sphere);

    // dotted continents — sampled from an equirectangular land/ocean mask
    // (ocean = white/bright, land = black/dark) so the globe reads as Earth.
    const dotMat = new THREE.PointsMaterial({
      color: 0xe6eaf2,
      size: 0.03,
      sizeAttenuation: true,
      transparent: true,
      opacity: 1,
    });
    let landDots: THREE.Points | null = null;
    const maskImg = new Image();
    maskImg.onload = () => {
      const cw = 720;
      const chh = 360;
      const cnv = document.createElement("canvas");
      cnv.width = cw;
      cnv.height = chh;
      const cx = cnv.getContext("2d", { willReadFrequently: true })!;
      cx.drawImage(maskImg, 0, 0, cw, chh);
      const data = cx.getImageData(0, 0, cw, chh).data;
      const pts: number[] = [];
      const STEP = 1.25; // degrees
      for (let lat = -82; lat <= 82; lat += STEP) {
        for (let lng = -180; lng < 180; lng += STEP) {
          const u = (lng + 180) / 360;
          const vv = (90 - lat) / 180;
          const px = Math.min(cw - 1, (u * cw) | 0);
          const py = Math.min(chh - 1, (vv * chh) | 0);
          const lum = data[(py * cw + px) * 4]; // ocean ~255, land ~0
          if (lum < 110) {
            const p = latLngToVec3(lat, lng, R * 1.004);
            pts.push(p.x, p.y, p.z);
          }
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      landDots = new THREE.Points(g, dotMat);
      globe.add(landDots);
    };
    maskImg.src = "/textures/earth-specular.jpg";

    // graticule (lat / lng wireframe) — faint, just to read the sphere
    const gratMat = new THREE.LineBasicMaterial({
      color: 0x6a6f7d,
      transparent: true,
      opacity: 0.2,
    });
    for (let lat = -60; lat <= 60; lat += 30) {
      const pts: THREE.Vector3[] = [];
      for (let lng = -180; lng <= 180; lng += 4) pts.push(latLngToVec3(lat, lng, R * 1.006));
      globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gratMat));
    }
    for (let lng = -180; lng < 180; lng += 30) {
      const pts: THREE.Vector3[] = [];
      for (let lat = -90; lat <= 90; lat += 4) pts.push(latLngToVec3(lat, lng, R * 1.006));
      globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gratMat));
    }

    // fresnel rim glow — tight ring hugging the silhouette
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.08, 64, 64),
      new THREE.ShaderMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { uColor: { value: new THREE.Color("#e0452f") } },
        vertexShader: `varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `varying vec3 vN; uniform vec3 uColor; void main(){ float i = pow(1.0 - abs(vN.z), 5.0); gl_FragColor = vec4(uColor, i * 0.5); }`,
      })
    );
    scene.add(glow);

    // soft radial sprite texture (so halos are circular glows, not squares)
    const glowCanvas = document.createElement("canvas");
    glowCanvas.width = glowCanvas.height = 64;
    const gctx = glowCanvas.getContext("2d")!;
    const grad = gctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.35, "rgba(255,255,255,0.55)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    gctx.fillStyle = grad;
    gctx.fillRect(0, 0, 64, 64);
    const glowTex = new THREE.CanvasTexture(glowCanvas);

    // markers + pins
    const markerMeshes: THREE.Mesh[] = [];
    const haloSprites: THREE.Sprite[] = [];
    locations.forEach((l) => {
      const surf = latLngToVec3(l.coordinates[0], l.coordinates[1], R * 1.01);
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.026, 16, 16),
        new THREE.MeshBasicMaterial({ color: ACCENT })
      );
      dot.position.copy(surf);
      globe.add(dot);
      markerMeshes.push(dot);
      // thin radial beam from surface outward
      const beamEnd = latLngToVec3(l.coordinates[0], l.coordinates[1], R * 1.1);
      globe.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([surf, beamEnd]),
          new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.55 })
        )
      );
      // glowing circular halo sprite
      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTex,
          color: ACCENT,
          transparent: true,
          opacity: 0.7,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      halo.position.copy(surf);
      halo.scale.setScalar(0.14);
      globe.add(halo);
      haloSprites.push(halo);
    });

    // route arcs between consecutive shoots
    const arcMat = new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.45 });
    for (let i = 0; i < locations.length - 1; i++) {
      const a = latLngToVec3(locations[i].coordinates[0], locations[i].coordinates[1]).normalize();
      const b = latLngToVec3(locations[i + 1].coordinates[0], locations[i + 1].coordinates[1]).normalize();
      const pts: THREE.Vector3[] = [];
      const steps = 48;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const v = new THREE.Vector3().copy(a).lerp(b, t).normalize();
        const lift = 1 + Math.sin(t * Math.PI) * 0.18; // arc altitude
        pts.push(v.multiplyScalar(R * lift));
      }
      globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), arcMat));
    }

    let raf = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      const dt = clock.getDelta();
      if (autoRef.current && !draggingRef.current) targetRot.current.y += dt * 0.12;
      globe.rotation.y += (targetRot.current.y - globe.rotation.y) * Math.min(1, dt * 5);
      globe.rotation.x += (targetRot.current.x - globe.rotation.x) * Math.min(1, dt * 5);
      const pulse = 1 + Math.sin(clock.elapsedTime * 2.5) * 0.18;
      markerMeshes.forEach((m) => m.scale.setScalar(pulse));
      haloSprites.forEach((h) => h.scale.setScalar(0.14 * (1 + Math.sin(clock.elapsedTime * 2.5) * 0.28)));
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      w = mount.clientWidth;
      h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    // recover from WebGL context loss (multiple live contexts on the page)
    const canvasEl = renderer.domElement;
    const onLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(raf);
    };
    const onRestored = () => {
      if (retryRef.current < 3) {
        retryRef.current += 1;
        setNonce((n) => n + 1);
      }
    };
    canvasEl.addEventListener("webglcontextlost", onLost, false);
    canvasEl.addEventListener("webglcontextrestored", onRestored, false);

    // expose a focus fn for the list (via closure on the mount element)
    (mount as unknown as { __focus: (i: number | null) => void }).__focus = (i) => {
      if (i === null) {
        autoRef.current = true;
        return;
      }
      autoRef.current = false;
      const [lat, lng] = locations[i].coordinates;
      targetRot.current.y = -(lng + 180) * DEG - Math.PI / 2;
      targetRot.current.x = lat * DEG * 0.6 + 0.1;
    };

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      canvasEl.removeEventListener("webglcontextlost", onLost);
      canvasEl.removeEventListener("webglcontextrestored", onRestored);
      maskImg.onload = null;
      landDots?.geometry.dispose();
      renderer.dispose();
      if (canvasEl.parentNode === mount) mount.removeChild(canvasEl);
    };
  }, [nonce]);

  const focus = (i: number | null) => {
    setActive(i);
    const m = mountRef.current as unknown as { __focus?: (i: number | null) => void };
    m?.__focus?.(i);
  };

  return (
    <section className="globe-sec" id="map">
      <div className="container">
        <motion.div
          className="globe-head"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10% 0px" }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="pillar-no">06</span>
          <h2 className="pillar-title">Where</h2>
          <p className="pillar-blurb">
            Every frame has a place. Eight years across three continents — drag
            the globe, or trace the route below.
          </p>
        </motion.div>

        <div className="globe-layout">
          <motion.div
            className="globe-stage"
            initial={{ opacity: 0, scale: 0.92 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-10% 0px" }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          >
            <div
              ref={mountRef}
              className="globe-canvas"
              onPointerDown={(e) => {
                draggingRef.current = true;
                autoRef.current = false;
                lastRef.current = { x: e.clientX, y: e.clientY };
                (e.currentTarget as HTMLDivElement).style.cursor = "grabbing";
              }}
              onPointerUp={(e) => {
                draggingRef.current = false;
                (e.currentTarget as HTMLDivElement).style.cursor = "grab";
              }}
              onPointerLeave={() => (draggingRef.current = false)}
              onPointerMove={(e) => {
                if (!draggingRef.current) return;
                targetRot.current.y += (e.clientX - lastRef.current.x) * 0.006;
                targetRot.current.x = Math.max(
                  -1,
                  Math.min(1, targetRot.current.x + (e.clientY - lastRef.current.y) * 0.006)
                );
                lastRef.current = { x: e.clientX, y: e.clientY };
              }}
            />
          </motion.div>

          <motion.ul
            className="globe-list"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10% 0px" }}
            transition={{ duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            {locations.map((l, i) => (
              <li
                key={l.id}
                className={active === i ? "active" : ""}
                onMouseEnter={() => focus(i)}
                onMouseLeave={() => focus(null)}
              >
                <span className="globe-place">{l.place}</span>
                <span className="globe-region">
                  {l.region} · {l.years}
                </span>
                <span className="globe-note">{l.note}</span>
              </li>
            ))}
          </motion.ul>
        </div>
      </div>
    </section>
  );
}
