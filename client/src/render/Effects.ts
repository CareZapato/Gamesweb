import * as THREE from 'three';
import { getWeapon, type Vec3, WeaponId } from '@arena/shared';
import { createFlashMaterial, WEAPON_COLORS } from './WeaponModels';

interface Tracer {
  mesh: THREE.Mesh;
  life: number;
  max: number;
}

/** Continuous beam of the plasma weapon: a thin white core inside a wider coloured glow. */
interface Beam {
  core: THREE.Mesh;
  glow: THREE.Mesh;
  life: number;
}

const MAX_BEAMS = 10;
/** How long a beam stays visible after its last refresh (a little over one server tick). */
const BEAM_LIFE = 0.1;

interface Blast {
  core: THREE.Mesh;
  ring: THREE.Mesh;
  t: number;
  radius: number;
}

interface Flash {
  sprite: THREE.Sprite;
  life: number;
}

const MAX_PARTICLES = 1500;

/**
 * Pooled visual effects: tracers, impact sparks, explosions, muzzle flashes and projectile meshes.
 * Everything is preallocated so firing does not create garbage.
 */
export class Effects {
  readonly group = new THREE.Group();
  private tracers: Tracer[] = [];
  private beams = new Map<number, Beam>();
  private beamGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5);
  private blasts: Blast[] = [];
  private flashes: Flash[] = [];
  private light = new THREE.PointLight(0xffa040, 0, 18, 1.6);
  private lightLife = 0;

  private pPos = new Float32Array(MAX_PARTICLES * 3);
  private pCol = new Float32Array(MAX_PARTICLES * 3);
  private pVel = new Float32Array(MAX_PARTICLES * 3);
  private pLife = new Float32Array(MAX_PARTICLES);
  private pGrav = new Float32Array(MAX_PARTICLES);
  private pNext = 0;
  private points: THREE.Points;
  private disposables: { dispose(): void }[] = [];

  private rocketGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.5, 8).rotateX(Math.PI / 2);
  private grenadeGeo = new THREE.SphereGeometry(0.12, 10, 8);
  private rocketMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.7, roughness: 0.4, emissive: 0x441100 });
  private grenadeMat = new THREE.MeshStandardMaterial({ color: 0x3a4a2a, metalness: 0.4, roughness: 0.6, emissive: 0x332200 });
  private projMeshes = new Map<number, { mesh: THREE.Mesh; seen: number; last: THREE.Vector3 }>();
  private frame = 0;

  private poolScale = 1;
  private maxTracers = 64;

  constructor(private budget: number) {
    // Object3D.lookAt points +Z at the target, so the box must grow along +Z from its origin
    const tracerGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5);
    this.disposables.push(tracerGeo, this.beamGeo, this.rocketGeo, this.grenadeGeo, this.rocketMat, this.grenadeMat);
    for (let i = 0; i < 64; i++) {
      const m = new THREE.Mesh(tracerGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.visible = false;
      this.group.add(m);
      this.tracers.push({ mesh: m, life: 0, max: 1 });
      this.disposables.push(m.material as THREE.Material);
    }
    const sphere = new THREE.SphereGeometry(1, 16, 12);
    const ring = new THREE.RingGeometry(0.85, 1, 32).rotateX(-Math.PI / 2);
    this.disposables.push(sphere, ring);
    for (let i = 0; i < 8; i++) {
      const core = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      const r = new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ color: 0xffd080, transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
      core.visible = r.visible = false;
      this.group.add(core, r);
      this.blasts.push({ core, ring: r, t: 1, radius: 1 });
      this.disposables.push(core.material as THREE.Material, r.material as THREE.Material);
    }
    const flashMat = createFlashMaterial();
    this.disposables.push(flashMat, flashMat.map!);
    for (let i = 0; i < 12; i++) {
      const s = new THREE.Sprite(flashMat);
      s.visible = false;
      this.group.add(s);
      this.flashes.push({ sprite: s, life: 0 });
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3).setUsage(THREE.DynamicDrawUsage));
    const pm = new THREE.PointsMaterial({ size: 0.09, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.points = new THREE.Points(geo, pm);
    this.points.frustumCulled = false;
    this.group.add(this.points);
    this.disposables.push(geo, pm);
    for (let i = 0; i < MAX_PARTICLES; i++) this.pPos[i * 3 + 1] = -9999;

    this.group.add(this.light);
  }

  setBudget(b: number) {
    this.budget = b;
  }

  setQualityProfile(poolScale: number, particlePointSize: number) {
    this.poolScale = poolScale;
    this.maxTracers = Math.max(8, Math.floor(64 * poolScale));
    (this.points.material as THREE.PointsMaterial).size = particlePointSize;
  }

  /** @param power 0..1 charge of a Lanza Cuásar shot (thicker and longer lived the more charge). */
  tracer(from: Vec3, to: Vec3, weapon: number, power = 1) {
    if (Math.random() > this.poolScale) return;
    const t = this.tracers.slice(0, this.maxTracers).find((x) => x.life <= 0) ?? this.tracers[0];
    const len = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
    if (len < 0.5) return;
    const charged = weapon === WeaponId.Charge;
    const thick = charged ? 0.02 + 0.06 * power : weapon === WeaponId.Sniper ? 0.05 : weapon === WeaponId.Shotgun ? 0.012 : 0.02;
    t.mesh.position.set(from.x, from.y, from.z);
    t.mesh.lookAt(to.x, to.y, to.z);
    t.mesh.scale.set(thick, thick, len);
    (t.mesh.material as THREE.MeshBasicMaterial).color.setHex(WEAPON_COLORS[weapon] ?? 0xffffff);
    t.max = charged ? 0.3 + 0.4 * power : weapon === WeaponId.Sniper ? 0.45 : 0.08;
    t.life = t.max;
    t.mesh.visible = true;
  }

  /**
   * Continuous beam (Hilo Aurora). Call it every tick the beam is on; it fades by itself shortly
   * after the last call. One beam per shooter (`id`), so many players can fire at once.
   */
  beam(id: number, from: Vec3, to: Vec3, weapon: number, life = BEAM_LIFE) {
    const len = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
    if (len < 0.3) return;
    let b = this.beams.get(id);
    if (!b) {
      if (this.beams.size >= MAX_BEAMS) return;
      const mk = (color: number, opacity: number) => {
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
        this.disposables.push(mat);
        const m = new THREE.Mesh(this.beamGeo, mat);
        m.frustumCulled = false;
        m.visible = false;
        this.group.add(m);
        return m;
      };
      b = { core: mk(0xffffff, 0.95), glow: mk(0xffffff, 0.4), life: 0 };
      this.beams.set(id, b);
    }
    (b.glow.material as THREE.MeshBasicMaterial).color.setHex(WEAPON_COLORS[weapon] ?? 0xffffff);
    const flicker = 0.75 + Math.random() * 0.5;
    for (const [m, w] of [[b.core, 0.016 * flicker], [b.glow, 0.07 * flicker]] as const) {
      m.position.set(from.x, from.y, from.z);
      m.lookAt(to.x, to.y, to.z);
      m.scale.set(w, w, len);
      m.visible = true;
    }
    b.life = life;
  }

  private spawnParticle(p: Vec3, v: Vec3, color: THREE.Color, life: number, gravity: number) {
    const i = this.pNext;
    this.pNext = (this.pNext + 1) % MAX_PARTICLES;
    this.pPos[i * 3] = p.x;
    this.pPos[i * 3 + 1] = p.y;
    this.pPos[i * 3 + 2] = p.z;
    this.pVel[i * 3] = v.x;
    this.pVel[i * 3 + 1] = v.y;
    this.pVel[i * 3 + 2] = v.z;
    this.pCol[i * 3] = color.r;
    this.pCol[i * 3 + 1] = color.g;
    this.pCol[i * 3 + 2] = color.b;
    this.pLife[i] = life;
    this.pGrav[i] = gravity;
  }

  sparks(p: Vec3, normal: Vec3 | null, count: number, colorHex = 0xffc070) {
    const n = Math.max(1, Math.round(count * this.budget));
    const c = new THREE.Color(colorHex);
    for (let i = 0; i < n; i++) {
      const v = { x: (Math.random() - 0.5) * 5, y: Math.random() * 4, z: (Math.random() - 0.5) * 5 };
      if (normal) {
        v.x += normal.x * 3;
        v.y += normal.y * 3;
        v.z += normal.z * 3;
      }
      this.spawnParticle(p, v, c, 0.25 + Math.random() * 0.35, 14);
    }
  }

  blood(p: Vec3) {
    this.sparks(p, null, 8, 0xff3030);
  }

  explosion(p: Vec3, weapon: number) {
    const cfg = getWeapon(weapon);
    const radius = cfg.kind === 'projectile' ? cfg.projectile.explosionRadius : 3;
    const b = this.blasts.find((x) => x.t >= 1) ?? this.blasts[0];
    b.t = 0;
    b.radius = radius;
    b.core.position.set(p.x, p.y, p.z);
    b.ring.position.set(p.x, p.y + 0.05, p.z);
    b.core.visible = b.ring.visible = true;
    const n = Math.round(60 * this.budget);
    const fire = new THREE.Color(0xffa040);
    const smoke = new THREE.Color(0x553322);
    for (let i = 0; i < n; i++) {
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize();
      const s = 4 + Math.random() * 9;
      this.spawnParticle(p, { x: dir.x * s, y: dir.y * s + 2, z: dir.z * s }, i % 3 === 0 ? smoke : fire, 0.4 + Math.random() * 0.6, 6);
    }
    this.light.position.set(p.x, p.y + 0.5, p.z);
    this.light.intensity = 220;
    this.lightLife = 0.25;
  }

  muzzleFlash(p: Vec3, size = 0.45) {
    const f = this.flashes.find((x) => x.life <= 0) ?? this.flashes[0];
    f.sprite.position.set(p.x, p.y, p.z);
    f.sprite.scale.setScalar(size);
    f.sprite.material.rotation = Math.random() * Math.PI;
    f.life = 0.05;
    f.sprite.visible = true;
  }

  /**
   * Shows projectiles by id. Call once per frame with the current set of positions; meshes
   * not refreshed this frame are removed.
   */
  beginProjectiles() {
    this.frame++;
  }

  projectile(id: number, weapon: number, x: number, y: number, z: number) {
    let e = this.projMeshes.get(id);
    if (!e) {
      const mesh = new THREE.Mesh(weapon === WeaponId.Rocket ? this.rocketGeo : this.grenadeGeo, weapon === WeaponId.Rocket ? this.rocketMat : this.grenadeMat);
      this.group.add(mesh);
      e = { mesh, seen: this.frame, last: new THREE.Vector3(x, y, z) };
      this.projMeshes.set(id, e);
    }
    e.seen = this.frame;
    const dx = x - e.last.x,
      dy = y - e.last.y,
      dz = z - e.last.z;
    if (dx * dx + dy * dy + dz * dz > 1e-6) {
      e.mesh.lookAt(e.mesh.position.x + dx, e.mesh.position.y + dy, e.mesh.position.z + dz);
      // smoke / glow trail
      if (Math.random() < (weapon === WeaponId.Rocket ? 0.9 : 0.3) * this.budget) {
        this.spawnParticle(
          { x, y, z },
          { x: (Math.random() - 0.5) * 0.6, y: 0.4, z: (Math.random() - 0.5) * 0.6 },
          new THREE.Color(weapon === WeaponId.Rocket ? 0xff9040 : 0xffe060),
          0.35,
          -1,
        );
      }
    }
    e.last.set(x, y, z);
    e.mesh.position.set(x, y, z);
  }

  endProjectiles() {
    for (const [id, e] of this.projMeshes) {
      if (e.seen !== this.frame) {
        e.mesh.removeFromParent();
        this.projMeshes.delete(id);
      }
    }
  }

  update(dt: number) {
    for (const t of this.tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      (t.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, t.life / t.max);
      if (t.life <= 0) t.mesh.visible = false;
    }
    for (const b of this.beams.values()) {
      if (b.life <= 0) continue;
      b.life -= dt;
      if (b.life <= 0) b.core.visible = b.glow.visible = false;
    }
    for (const b of this.blasts) {
      if (b.t >= 1) continue;
      b.t = Math.min(1, b.t + dt * 2.6);
      const s = b.radius * (0.25 + 0.75 * Math.sqrt(b.t));
      b.core.scale.setScalar(s * 0.7);
      b.ring.scale.setScalar(s * 1.1);
      (b.core.material as THREE.MeshBasicMaterial).opacity = (1 - b.t) * 0.9;
      (b.ring.material as THREE.MeshBasicMaterial).opacity = (1 - b.t) * 0.7;
      if (b.t >= 1) b.core.visible = b.ring.visible = false;
    }
    for (const f of this.flashes) {
      if (f.life <= 0) continue;
      f.life -= dt;
      if (f.life <= 0) f.sprite.visible = false;
    }
    if (this.lightLife > 0) {
      this.lightLife -= dt;
      this.light.intensity = Math.max(0, (this.lightLife / 0.25) * 220);
    }
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.pLife[i] <= 0) continue;
      this.pLife[i] -= dt;
      if (this.pLife[i] <= 0) {
        this.pPos[i * 3 + 1] = -9999;
        continue;
      }
      this.pVel[i * 3 + 1] -= this.pGrav[i] * dt;
      this.pPos[i * 3] += this.pVel[i * 3] * dt;
      this.pPos[i * 3 + 1] += this.pVel[i * 3 + 1] * dt;
      this.pPos[i * 3 + 2] += this.pVel[i * 3 + 2] * dt;
    }
    const geo = this.points.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }

  dispose() {
    for (const e of this.projMeshes.values()) e.mesh.removeFromParent();
    this.projMeshes.clear();
    for (const d of this.disposables) d.dispose();
    this.group.removeFromParent();
  }
}
