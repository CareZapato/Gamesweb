import * as THREE from 'three';
import { type FlagSnap, FlagState, type MapDef, type PickupKind } from '@arena/shared';
import { TEAM_COLORS } from './Character';
import { WEAPON_COLORS } from './WeaponModels';

const padGeo = new THREE.CylinderGeometry(0.6, 0.7, 0.06, 12);
const padMat = new THREE.MeshBasicMaterial({ color: 0x2a3446 });

const sharedMats = {
  healthCore: new THREE.MeshBasicMaterial({ color: 0xff3a4a }),
  healthBigCore: new THREE.MeshBasicMaterial({ color: 0x30ff70 }),
  healthShell: new THREE.MeshLambertMaterial({ color: 0xf2f5f7, transparent: true, opacity: 0.55 }),
  healthCap: new THREE.MeshLambertMaterial({ color: 0xd8dde2 }),
  shieldCell: new THREE.MeshLambertMaterial({ color: 0x2a9cff, emissive: 0x0a3a80, transparent: true, opacity: 0.85 }),
  shieldBigCell: new THREE.MeshLambertMaterial({ color: 0x8a7aff, emissive: 0x2a1a90, transparent: true, opacity: 0.85 }),
  shieldFrame: new THREE.MeshBasicMaterial({ color: 0xbfe6ff }),
  ammoBox: new THREE.MeshLambertMaterial({ color: 0x3d4a32 }),
  ammoStrip: new Map<number, THREE.MeshBasicMaterial>(),
  pole: new THREE.MeshLambertMaterial({ color: 0xcfd6df }),
};

const ammoStrip = (weapon: number) => {
  let m = sharedMats.ammoStrip.get(weapon);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: WEAPON_COLORS[weapon] ?? 0xffffff });
    sharedMats.ammoStrip.set(weapon, m);
  }
  return m;
};

const pickupMesh = (kind: PickupKind, weapon: number): THREE.Object3D => {
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material) => g.add(new THREE.Mesh(geo, mat));
  switch (kind) {
    case 'health':
    case 'healthBig': {
      // upright med capsule: glass shell, glowing core, metal caps (red = small, green = big)
      const s = kind === 'healthBig' ? 1.35 : 1;
      add(new THREE.CylinderGeometry(0.2 * s, 0.2 * s, 0.5 * s, 12), sharedMats.healthShell);
      add(new THREE.CylinderGeometry(0.11 * s, 0.11 * s, 0.46 * s, 8), kind === 'healthBig' ? sharedMats.healthBigCore : sharedMats.healthCore);
      for (const y of [-0.28, 0.28]) {
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.22 * s, 0.08 * s, 12), sharedMats.healthCap);
        cap.position.y = y * s;
        g.add(cap);
      }
      break;
    }
    case 'shield':
    case 'shieldBig': {
      // hexagonal energy cell standing on its edge (blue = small, violet = big)
      const s = kind === 'shieldBig' ? 1.35 : 1;
      const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.34 * s, 0.34 * s, 0.12 * s, 6).rotateX(Math.PI / 2), kind === 'shieldBig' ? sharedMats.shieldBigCell : sharedMats.shieldCell);
      const frame = new THREE.Mesh(new THREE.TorusGeometry(0.36 * s, 0.03 * s, 4, 6), sharedMats.shieldFrame);
      frame.rotation.z = Math.PI / 6;
      g.add(cell, frame);
      if (kind === 'shieldBig') {
        const inner = new THREE.Mesh(new THREE.TorusGeometry(0.2 * s, 0.025 * s, 4, 6), sharedMats.shieldFrame);
        inner.rotation.z = Math.PI / 6;
        inner.position.z = 0.07 * s;
        g.add(inner);
      }
      break;
    }
    case 'ammo': {
      add(new THREE.BoxGeometry(0.55, 0.32, 0.36), sharedMats.ammoBox);
      add(new THREE.BoxGeometry(0.57, 0.08, 0.38), ammoStrip(weapon));
      break;
    }
  }
  return g;
};

const beaconTexture = (color: number): THREE.CanvasTexture => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  g.strokeStyle = 'rgba(0,0,0,0.8)';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(32, 60);
  g.lineTo(8, 14);
  g.lineTo(56, 14);
  g.closePath();
  g.fill();
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
};

/** Pickups and CTF flags/bases. */
export class WorldProps {
  readonly group = new THREE.Group();
  private pickups: { obj: THREE.Object3D; base: THREE.Vector3; phase: number }[] = [];
  private flags: { obj: THREE.Group; beacon: THREE.Sprite; team: number; state: number }[] = [];
  private disposables: { dispose(): void }[] = [];
  private t = 0;

  constructor(map: MapDef, ctf: boolean) {
    const padCount = map.pickups.length;
    if (padCount > 0) {
      const pads = new THREE.InstancedMesh(padGeo, padMat, padCount);
      pads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const m = new THREE.Matrix4();
      map.pickups.forEach((p, i) => {
        m.makeTranslation(p.pos[0], p.pos[1] + 0.03, p.pos[2]);
        pads.setMatrixAt(i, m);
      });
      pads.instanceMatrix.needsUpdate = true;
      this.group.add(pads);
    }

    map.pickups.forEach((p, i) => {
      const obj = pickupMesh(p.kind, p.weapon ?? -1);
      const base = new THREE.Vector3(p.pos[0], p.pos[1] + 0.6, p.pos[2]);
      obj.position.copy(base);
      this.group.add(obj);
      this.pickups.push({ obj, base, phase: i * 0.7 });
    });

    if (ctf) {
      for (const f of map.flags) {
        const color = TEAM_COLORS[f.team];
        const ringGeo = new THREE.RingGeometry(1.1, 1.4, 24).rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
        this.disposables.push(ringGeo, ringMat);
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(f.pos[0], f.pos[1] + 0.02, f.pos[2]);
        this.group.add(ring);

        const obj = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6), sharedMats.pole);
        const clothMat = new THREE.MeshBasicMaterial({ color });
        this.disposables.push(clothMat);
        const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.03), clothMat);
        pole.position.y = 1.1;
        cloth.position.set(0.45, 1.85, 0);
        obj.add(pole, cloth);
        obj.position.set(f.pos[0], f.pos[1], f.pos[2]);
        this.group.add(obj);

        const tex = beaconTexture(color);
        const bm = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
        this.disposables.push(tex, bm);
        const beacon = new THREE.Sprite(bm);
        beacon.renderOrder = 20;
        beacon.scale.set(0.9, 0.9, 1);
        this.group.add(beacon);
        this.flags[f.team] = { obj, beacon, team: f.team, state: FlagState.Home };
      }
    }
  }

  setPickupAvailability(unavailable: number[]) {
    const set = new Set(unavailable);
    this.pickups.forEach((p, i) => (p.obj.visible = !set.has(i)));
  }

  setFlags(flags: FlagSnap[]) {
    for (const [team, state, x, y, z] of flags) {
      const f = this.flags[team];
      if (!f) continue;
      f.state = state;
      f.obj.visible = state !== FlagState.Carried;
      f.obj.position.set(x / 100, y / 100, z / 100);
      f.beacon.position.set(x / 100, y / 100 + (state === FlagState.Carried ? 3.0 : 3.2), z / 100);
    }
  }

  update(dt: number) {
    this.t += dt;
    for (const p of this.pickups) {
      p.obj.rotation.y = this.t * 1.5 + p.phase;
      p.obj.position.y = p.base.y + Math.sin(this.t * 2 + p.phase) * 0.12;
    }
    for (const f of this.flags) {
      if (!f) continue;
      f.obj.rotation.y = Math.sin(this.t) * 0.3;
      const s = f.state === FlagState.Dropped ? 0.9 + Math.sin(this.t * 8) * 0.25 : 0.9;
      f.beacon.scale.set(s, s, 1);
    }
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
    this.group.removeFromParent();
  }
}
