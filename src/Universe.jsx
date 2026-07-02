import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/*
 * The Universe — your days rendered as a galaxy.
 *
 * Each day with data is a star on a slow spiral through space, colored by that
 * morning's recovery (sage / brass / ember). You drift among them as a violet
 * energy ball. Click a star to autopilot to it; arriving opens that day as a
 * star system — the recovery as its sun, your metrics as orbiting planets —
 * with the day's numbers, logs, and journal beside it.
 *
 * Controls: drag to look · W A S D / arrows to fly · click a star to travel.
 */

const COLORS = {
  obsidian: 0x0d0d10, ember: 0xc2453b, brass: 0xc49a4a, sage: 0x8fa67e,
  steel: 0x7e9bb3, plum: 0x8a7ba6, violet: 0xb48aff, bone: 0xe9e4d9,
};
const recHex = (r) => (r == null ? 0x5e5c58 : r < 34 ? COLORS.ember : r < 67 ? COLORS.brass : COLORS.sage);
const recCss = (r) => (r == null ? "#5E5C58" : r < 34 ? "#C2453B" : r < 67 ? "#C49A4A" : "#8FA67E");

const PLANET_DEFS = [
  { key: "hrv", label: "HRV", unit: "ms", color: 0x7e9bb3, css: "#7E9BB3", norm: (v) => v / 120 },
  { key: "rhr", label: "Resting HR", unit: "bpm", color: 0xc2453b, css: "#C2453B", norm: (v) => v / 90 },
  { key: "sleepPerf", label: "Sleep", unit: "%", color: 0x8a7ba6, css: "#8A7BA6", norm: (v) => v / 100 },
  { key: "sleepHours", label: "Sleep dur.", unit: "h", color: 0x8a7ba6, css: "#8A7BA6", norm: (v) => v / 10 },
  { key: "strain", label: "Strain", unit: "", color: 0xc49a4a, css: "#C49A4A", norm: (v) => v / 21 },
  { key: "respRate", label: "Resp. rate", unit: "rpm", color: 0x8c8a84, css: "#8C8A84", norm: (v) => v / 22 },
];

function glowTexture(hex) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  const col = new THREE.Color(hex);
  const rgb = `${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)}`;
  g.addColorStop(0, `rgba(255,255,255,0.9)`);
  g.addColorStop(0.25, `rgba(${rgb},0.65)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export default function Universe({ days }) {
  const mountRef = useRef(null);
  const [hover, setHover] = useState(null);       // {x, y, date, recovery}
  const [system, setSystem] = useState(null);     // {date, metrics, logs, journal, planets}
  const exitRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    /* ---- data ---- */
    const dates = Object.keys(days || {}).sort().filter((d) => {
      const m = days[d]?.metrics || {};
      return Object.values(m).some((v) => v != null);
    });

    /* ---- scene ---- */
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(COLORS.obsidian, 0.0014);
    const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 3000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setClearColor(COLORS.obsidian);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const resize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);

    scene.add(new THREE.AmbientLight(0xffffff, 0.35));

    /* ---- distant dust ---- */
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(1800 * 3);
    for (let i = 0; i < 1800; i++) {
      const r = 400 + Math.random() * 700;
      const t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1);
      dustPos[i * 3] = r * Math.sin(p) * Math.cos(t);
      dustPos[i * 3 + 1] = r * Math.cos(p) * 0.6;
      dustPos[i * 3 + 2] = r * Math.sin(p) * Math.sin(t);
    }
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
    scene.add(new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0x3a3a48, size: 1.4, sizeAttenuation: true })));

    /* ---- galaxy of days ---- */
    const galaxy = new THREE.Group();
    scene.add(galaxy);
    const starMeshes = [];
    const glowCache = {};
    const getGlow = (hex) => (glowCache[hex] ||= glowTexture(hex));

    dates.forEach((date, i) => {
      const m = days[date].metrics;
      const hex = recHex(m.recovery);
      const angle = i * 0.55;
      const radius = 40 + i * 5;
      const pos = new THREE.Vector3(
        Math.cos(angle) * radius,
        Math.sin(i * 0.9) * 10,
        Math.sin(angle) * radius
      );
      const star = new THREE.Mesh(
        new THREE.SphereGeometry(1.6, 20, 20),
        new THREE.MeshBasicMaterial({ color: hex })
      );
      star.position.copy(pos);
      star.userData = { date, recovery: m.recovery, phase: Math.random() * Math.PI * 2 };
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlow(hex), transparent: true, depthWrite: false }));
      glow.scale.setScalar(10);
      star.add(glow);
      galaxy.add(star);
      starMeshes.push(star);
    });

    /* ---- the traveler: purple energy ball ---- */
    const player = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 24, 24),
      new THREE.MeshBasicMaterial({ color: COLORS.violet })
    );
    const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(COLORS.violet), transparent: true, depthWrite: false }));
    aura.scale.setScalar(9);
    player.add(core, aura);
    const startIdx = Math.max(0, starMeshes.length - 1);
    if (starMeshes[startIdx]) {
      player.position.copy(starMeshes[startIdx].position).add(new THREE.Vector3(0, 6, 24));
    } else {
      player.position.set(0, 6, 60);
    }
    scene.add(player);
    const playerLight = new THREE.PointLight(COLORS.violet, 1.4, 90);
    player.add(playerLight);

    /* ---- system group (built on entry) ---- */
    const systemGroup = new THREE.Group();
    scene.add(systemGroup);
    let mode = "galaxy";
    let orbiters = [];

    const buildSystem = (date) => {
      // clear
      while (systemGroup.children.length) systemGroup.remove(systemGroup.children[0]);
      orbiters = [];
      const day = days[date];
      const m = day.metrics || {};
      const center = new THREE.Vector3(0, 400, 0); // far from galaxy

      const sunHex = recHex(m.recovery);
      const sun = new THREE.Mesh(
        new THREE.SphereGeometry(4 + (m.recovery || 40) / 25, 28, 28),
        new THREE.MeshBasicMaterial({ color: sunHex })
      );
      sun.position.copy(center);
      const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlow(sunHex), transparent: true, depthWrite: false }));
      sunGlow.scale.setScalar(34);
      sun.add(sunGlow);
      systemGroup.add(sun);

      const present = PLANET_DEFS.filter((p) => m[p.key] != null);
      present.forEach((p, i) => {
        const orbitR = 12 + i * 6;
        const size = 0.8 + Math.min(1, Math.max(0.1, p.norm(m[p.key]))) * 1.8;
        const planet = new THREE.Mesh(
          new THREE.SphereGeometry(size, 18, 18),
          new THREE.MeshBasicMaterial({ color: p.color })
        );
        const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlow(p.color), transparent: true, depthWrite: false }));
        g.scale.setScalar(size * 4.5);
        planet.add(g);
        systemGroup.add(planet);

        // orbit ring
        const pts = [];
        for (let a = 0; a <= 64; a++) {
          const t = (a / 64) * Math.PI * 2;
          pts.push(new THREE.Vector3(center.x + Math.cos(t) * orbitR, center.y, center.z + Math.sin(t) * orbitR));
        }
        const ring = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: 0x2a2a33, transparent: true, opacity: 0.7 })
        );
        systemGroup.add(ring);

        orbiters.push({ mesh: planet, r: orbitR, speed: 0.5 - i * 0.055, phase: Math.random() * Math.PI * 2, center });
      });

      player.position.copy(center).add(new THREE.Vector3(0, 8, 46));
      yaw = 0; pitch = -0.15;

      setSystem({
        date,
        metrics: m,
        logs: day.logs || [],
        journal: day.journal || null,
        planets: present.map((p, i) => ({ ...p, value: m[p.key], orbit: i + 1 })),
      });
      mode = "system";
      galaxy.visible = false;
    };

    const exitSystem = () => {
      mode = "galaxy";
      galaxy.visible = true;
      setSystem(null);
      const idx = starMeshes.length - 1;
      if (starMeshes[idx]) player.position.copy(starMeshes[idx].position).add(new THREE.Vector3(0, 6, 24));
    };
    exitRef.current = exitSystem;

    /* ---- controls ---- */
    let yaw = 0, pitch = -0.1;
    let dragging = false, lastX = 0, lastY = 0, downX = 0, downY = 0;
    const keys = {};
    let autopilot = null; // target Vector3 + date

    const onDown = (e) => {
      dragging = true;
      lastX = downX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
      lastY = downY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    };
    const onMove = (e) => {
      const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
      const y = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
      if (dragging) {
        yaw -= (x - lastX) * 0.005;
        pitch = Math.max(-1.2, Math.min(1.2, pitch - (y - lastY) * 0.004));
        lastX = x; lastY = y;
      } else if (mode === "galaxy" && e.clientX != null) {
        // hover raycast
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((x - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((y - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(starMeshes, false)[0];
        if (hit) {
          setHover({ x: x - rect.left, y: y - rect.top, date: hit.object.userData.date, recovery: hit.object.userData.recovery });
          renderer.domElement.style.cursor = "pointer";
        } else {
          setHover(null);
          renderer.domElement.style.cursor = "grab";
        }
      }
    };
    const onUp = (e) => {
      const x = e.clientX ?? e.changedTouches?.[0]?.clientX ?? 0;
      const y = e.clientY ?? e.changedTouches?.[0]?.clientY ?? 0;
      const wasClick = Math.abs(x - downX) < 6 && Math.abs(y - downY) < 6;
      dragging = false;
      if (wasClick && mode === "galaxy") {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((x - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((y - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(starMeshes, false)[0];
        if (hit) autopilot = { target: hit.object.position.clone(), date: hit.object.userData.date };
      }
    };
    const onKey = (e, downState) => { keys[e.key.toLowerCase()] = downState; };
    const kd = (e) => onKey(e, true);
    const ku = (e) => onKey(e, false);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const el = renderer.domElement;
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    el.style.cursor = "grab";
    el.style.touchAction = "none";

    /* ---- loop ---- */
    const clock = new THREE.Clock();
    let raf;
    const fwd = new THREE.Vector3(), right = new THREE.Vector3();

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      // star pulse
      starMeshes.forEach((s) => {
        const k = 1 + Math.sin(t * 1.6 + s.userData.phase) * 0.12;
        s.scale.setScalar(k);
      });
      // player shimmer
      aura.scale.setScalar(9 + Math.sin(t * 3) * 1.2);
      core.scale.setScalar(1 + Math.sin(t * 4) * 0.06);

      // orbiting planets
      orbiters.forEach((o) => {
        const a = t * o.speed + o.phase;
        o.mesh.position.set(o.center.x + Math.cos(a) * o.r, o.center.y, o.center.z + Math.sin(a) * o.r);
      });

      // camera rig around player
      const camDist = 24;
      const cx = Math.cos(pitch) * Math.sin(yaw), cy = Math.sin(pitch), cz = Math.cos(pitch) * Math.cos(yaw);
      camera.position.set(
        player.position.x - cx * camDist,
        player.position.y - cy * camDist + 4,
        player.position.z - cz * camDist
      );
      camera.lookAt(player.position);

      // movement
      camera.getWorldDirection(fwd);
      right.crossVectors(fwd, camera.up).normalize();
      const speed = 34 * dt;
      if (keys["w"] || keys["arrowup"]) player.position.addScaledVector(fwd, speed);
      if (keys["s"] || keys["arrowdown"]) player.position.addScaledVector(fwd, -speed);
      if (keys["a"] || keys["arrowleft"]) player.position.addScaledVector(right, -speed);
      if (keys["d"] || keys["arrowright"]) player.position.addScaledVector(right, speed);
      if (keys[" "]) player.position.y += speed;
      if (keys["shift"]) player.position.y -= speed;

      // autopilot
      if (autopilot && mode === "galaxy") {
        const to = autopilot.target.clone().sub(player.position);
        const dist = to.length();
        if (dist < 9) {
          const d = autopilot.date;
          autopilot = null;
          buildSystem(d);
        } else {
          player.position.addScaledVector(to.normalize(), Math.min(dist, 60 * dt + dist * 1.5 * dt));
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const hasData = Object.values(days || {}).some((d) => Object.values(d?.metrics || {}).some((v) => v != null));

  return (
    <div className="uni-wrap">
      <style>{UCSS}</style>
      <div className="uni-mount" ref={mountRef} />

      {!hasData && (
        <div className="uni-empty">No days with data yet — the universe is waiting to be born. Sync WHOOP or log a day.</div>
      )}

      {hover && !system && (
        <div className="uni-tip" style={{ left: hover.x + 14, top: hover.y - 10 }}>
          <b style={{ color: recCss(hover.recovery) }}>{hover.recovery != null ? hover.recovery + "%" : "—"}</b> · {hover.date}
        </div>
      )}

      {system && (
        <div className="uni-hud">
          <div className="uni-hud-head">
            <div>
              <div className="uni-date">{new Date(system.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div>
              <div className="uni-rec" style={{ color: recCss(system.metrics.recovery) }}>
                Recovery {system.metrics.recovery != null ? system.metrics.recovery + "%" : "—"}
              </div>
            </div>
            <button className="uni-back" onClick={() => exitRef.current && exitRef.current()}>← Galaxy</button>
          </div>
          <div className="uni-planets">
            {system.planets.map((p) => (
              <div key={p.key} className="uni-planet">
                <span className="uni-dot" style={{ background: p.css }} />
                <span className="uni-plabel">{p.label}</span>
                <span className="uni-pval">{p.value}{p.unit}</span>
                <span className="uni-orbit">orbit {p.orbit}</span>
              </div>
            ))}
          </div>
          {(system.logs.length > 0 || (system.journal && system.journal.text)) && (
            <div className="uni-life">
              {system.logs.map((l) => <span key={l.id} className="uni-log">{l.time} · {l.label}</span>)}
              {system.journal && system.journal.text && <p className="uni-journal">"{system.journal.text}"</p>}
            </div>
          )}
        </div>
      )}

      <div className="uni-controls">drag to look · W A S D to fly · space/shift up & down · click a star to travel</div>
    </div>
  );
}

const UCSS = `
.uni-wrap { position:relative; width:100%; height:72vh; min-height:480px; border:1px solid #2A2A33; border-radius:16px; overflow:hidden; background:#0D0D10; }
.uni-mount { position:absolute; inset:0; }
.uni-mount canvas { display:block; width:100%; height:100%; }
.uni-tip { position:absolute; background:#1C1C23; border:1px solid #2A2A33; color:#E9E4D9; font-size:12px; padding:6px 10px; border-radius:8px; pointer-events:none; font-family:'JetBrains Mono',monospace; white-space:nowrap; z-index:3; }
.uni-hud { position:absolute; top:16px; left:16px; max-width:320px; background:rgba(21,21,26,0.92); border:1px solid #2A2A33; border-radius:14px; padding:16px; z-index:3; backdrop-filter:blur(6px); }
.uni-hud-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:12px; }
.uni-date { font-family:Fraunces,serif; font-size:17px; color:#E9E4D9; }
.uni-rec { font-family:'JetBrains Mono',monospace; font-size:13px; margin-top:2px; }
.uni-back { background:#1C1C23; border:1px solid #2A2A33; color:#E9E4D9; padding:6px 12px; border-radius:8px; font-size:12px; cursor:pointer; white-space:nowrap; }
.uni-back:hover { border-color:#8C8A84; }
.uni-planets { display:flex; flex-direction:column; gap:7px; }
.uni-planet { display:flex; align-items:center; gap:8px; font-size:12.5px; color:#E9E4D9; }
.uni-dot { width:9px; height:9px; border-radius:50%; box-shadow:0 0 8px currentColor; flex:none; }
.uni-plabel { flex:1; color:#8C8A84; }
.uni-pval { font-family:'JetBrains Mono',monospace; }
.uni-orbit { font-size:10px; color:#5E5C58; font-family:'JetBrains Mono',monospace; }
.uni-life { margin-top:12px; padding-top:12px; border-top:1px solid #2A2A33; display:flex; flex-wrap:wrap; gap:6px; }
.uni-log { font-size:11px; color:#8C8A84; background:#1C1C23; border:1px solid #2A2A33; padding:3px 8px; border-radius:10px; }
.uni-journal { font-size:12.5px; color:#E9E4D9; font-style:italic; margin:8px 0 0; line-height:1.5; }
.uni-controls { position:absolute; bottom:12px; left:50%; transform:translateX(-50%); font-size:11px; color:#5E5C58; font-family:'JetBrains Mono',monospace; letter-spacing:.5px; z-index:3; white-space:nowrap; }
.uni-empty { position:absolute; inset:0; display:grid; place-items:center; color:#8C8A84; font-size:14px; z-index:3; padding:24px; text-align:center; }
@media (max-width:760px) {
  .uni-hud { max-width:calc(100% - 32px); }
  .uni-controls { display:none; }
}
`;
