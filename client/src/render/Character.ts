import * as THREE from 'three';
import { buildWeapon, type WeaponModel } from './WeaponModels';
import type { ZombieLook } from './zombieVisual';
import { HIP_Y, LEG_X, NECK_Y, PART_OFFSET, partSize, SHOULDER } from './characterModel';

/** How far the upper body drops when crouching / sliding (metres). */
const CROUCH_UPPER_DROP = 0.42;
import { buildBoxData } from './skinBox';
import { getPart, type PartId } from './skinLayout';

/** Accent colours for Deathmatch (no teams): tint of the team-colour zone of the skin. */
export const DM_COLORS = [0xff7a1a, 0x2fd0ff, 0x9dff3a, 0xff3aa8, 0xffd23a, 0xa070ff, 0x3affc8, 0xff4a4a];
export const TEAM_COLORS = [0xe03030, 0x2f6bff];

const skinGeos = new Map<PartId, THREE.BufferGeometry>();
/** Geometry of a skinned box for a part (shared by every character; 256 px skins use the same UVs). */
export const skinGeometry = (id: PartId): THREE.BufferGeometry => {
  let g = skinGeos.get(id);
  if (!g) {
    const [sx, sy, sz] = partSize(id);
    const d = buildBoxData(sx, sy, sz, getPart(id));
    g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(d.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(d.normals, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(d.uvs, 2));
    g.setIndex(new THREE.BufferAttribute(d.indices, 1));
    skinGeos.set(id, g);
  }
  return g;
};

export type Shading = 'lambert' | 'standard';
export type SkinMaterial = THREE.MeshLambertMaterial | THREE.MeshStandardMaterial;

/**
 * Material for skinned boxes. Transparent texels are discarded (`alphaTest`), which is how the
 * optional outer layers (helmet, chest, shoulder pads) show "nothing" where the skin is empty.
 */
export const makeSkinMaterial = (shading: Shading, map: THREE.Texture): SkinMaterial =>
  shading === 'lambert'
    ? new THREE.MeshLambertMaterial({ map, alphaTest: 0.5 })
    : new THREE.MeshStandardMaterial({ map, alphaTest: 0.5, roughness: 0.75, metalness: 0.15 });

const skinMesh = (id: PartId, mat: THREE.Material): THREE.Mesh => {
  const m = new THREE.Mesh(skinGeometry(id), mat);
  const o = PART_OFFSET[id];
  m.position.set(o[0], o[1], o[2]);
  m.castShadow = true;
  return m;
};

const labelTexture = (text: string, color: number): THREE.CanvasTexture => {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.font = 'bold 30px Segoe UI, Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 6;
  g.strokeStyle = 'rgba(0,0,0,0.85)';
  g.strokeText(text, 128, 32);
  g.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  g.fillText(text, 128, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
};

const makeLabel = (text: string, color: number): THREE.Sprite => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(text, color), depthTest: false, transparent: true }));
  s.scale.set(1.6, 0.4, 1);
  s.renderOrder = 10;
  return s;
};

const flagPoleMat = new THREE.MeshLambertMaterial({ color: 0x8a919c });
const flagGeo = new THREE.BoxGeometry(0.05, 1.6, 0.05);
const clothGeo = new THREE.BoxGeometry(0.6, 0.4, 0.03);

/**
 * Voxel-style combatant: helmet with visor, torso with chest plate, shoulder pads, articulated arms
 * and legs, all textured from ONE skin PNG (layout in `skinLayout.ts`, docs in docs/SKINS.md).
 * ~1.8 m tall; the head sits inside the server head box (`characterModel.ts` is tested for this).
 * Forward is -Z. The root sits at the feet.
 */
export class Character {
  readonly root = new THREE.Group();
  private upper = new THREE.Group();
  private head = new THREE.Group();
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private aim = new THREE.Group();
  private weapon: WeaponModel | null = null;
  private weaponId = -1;
  private flag: THREE.Group;
  private flagCloth: THREE.Mesh;
  private label: THREE.Sprite;
  private mat: SkinMaterial;
  private ownedMats: THREE.Material[] = [];
  private phase = 0;
  private deathT = 0;
  private zombieEmissive = 0;
  private labelText = '';
  private labelColor = 0xffffff;

  /** @param skin texture from `SkinTextures` (owned elsewhere; this class never disposes it). */
  constructor(name: string, color: number, shading: Shading, skin: THREE.Texture) {
    this.mat = makeSkinMaterial(shading, skin);
    this.ownedMats.push(this.mat);
    const mat = this.mat;

    for (const [leg, id, x] of [
      [this.legL, 'legL', -LEG_X],
      [this.legR, 'legR', LEG_X],
    ] as const) {
      leg.position.set(x, HIP_Y, 0);
      leg.add(skinMesh(id, mat));
      this.root.add(leg);
    }

    this.upper.position.y = HIP_Y;
    this.root.add(this.upper);
    this.upper.add(skinMesh('torso', mat), skinMesh('chest', mat));

    this.head.position.set(0, NECK_Y, 0);
    this.head.add(skinMesh('head', mat), skinMesh('helmet', mat));
    this.upper.add(this.head);

    for (const [arm, armId, padId, x] of [
      [this.armL, 'armL', 'pauldronL', -SHOULDER[0]],
      [this.armR, 'armR', 'pauldronR', SHOULDER[0]],
    ] as const) {
      arm.position.set(x, SHOULDER[1], 0);
      arm.add(skinMesh(armId, mat), skinMesh(padId, mat));
      this.upper.add(arm);
    }
    this.aim.position.set(0.14, 0.45, -0.3);
    this.upper.add(this.aim);

    this.flag = new THREE.Group();
    const pole = new THREE.Mesh(flagGeo, flagPoleMat);
    pole.position.set(0, 0.6, 0);
    const clothMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.ownedMats.push(clothMat);
    this.flagCloth = new THREE.Mesh(clothGeo, clothMat);
    this.flagCloth.position.set(0.3, 1.2, 0);
    this.flag.add(pole, this.flagCloth);
    this.flag.position.set(-0.15, 0.3, 0.3);
    this.flag.visible = false;
    this.upper.add(this.flag);

    this.labelColor = color;
    this.labelText = name;
    this.label = makeLabel(name, color);
    this.label.position.y = 2.1;
    this.root.add(this.label);
  }

  /** Actualiza el nombre flotante (p. ej. cuando llega el scoreboard). */
  setLabelText(text: string, color: number) {
    const t = text.trim() || '?';
    if (t === this.labelText && color === this.labelColor) return;
    this.labelText = t;
    this.labelColor = color;
    const lm = this.label.material as THREE.SpriteMaterial;
    const prev = lm.map;
    lm.map = labelTexture(t, color);
    lm.needsUpdate = true;
    prev?.dispose();
  }

  /** Swaps the skin texture (e.g. the player's own skin arrived after the model was created). */
  setSkin(skin: THREE.Texture) {
    if (this.mat.map === skin) return;
    this.mat.map = skin;
    this.mat.needsUpdate = true;
  }

  setWeapon(id: number) {
    if (id === this.weaponId) return;
    this.weaponId = id;
    if (this.weapon) this.aim.remove(this.weapon.group);
    if (id < 0) {
      this.weapon = null;
      return;
    }
    this.weapon = buildWeapon(id);
    this.weapon.group.traverse((o) => ((o as THREE.Mesh).castShadow = true));
    this.aim.add(this.weapon.group);
  }

  /** Escala y emisión de horda (tinte del skin se aplica al crear el modelo). */
  setZombieLook(look: ZombieLook | null) {
    if (!look) {
      this.zombieEmissive = 0;
      this.root.scale.set(1, 1, 1);
      return;
    }
    this.zombieEmissive = look.emissive;
    this.root.scale.setScalar(look.scale);
  }

  muzzleWorld(out: THREE.Vector3): THREE.Vector3 {
    if (!this.weapon) return this.root.getWorldPosition(out).setY(this.root.position.y + 1.4);
    return this.weapon.muzzle.getWorldPosition(out);
  }

  setCarrier(flagColor: number | null) {
    this.flag.visible = flagColor !== null;
    if (flagColor !== null) (this.flagCloth.material as THREE.MeshBasicMaterial).color.setHex(flagColor);
  }

  showLabel(v: boolean) {
    this.label.visible = v;
  }

  update(
    dt: number,
    yaw: number,
    pitch: number,
    speed: number,
    grounded: boolean,
    alive: boolean,
    dashing: boolean,
    isProtected: boolean,
    crouching = false,
    sliding = false,
  ) {
    this.root.rotation.y = yaw;
    if (!alive) {
      this.deathT = Math.min(1, this.deathT + dt * 3);
      this.root.rotation.x = -this.deathT * 1.45;
      this.label.visible = false;
      if (this.deathT >= 1) this.root.visible = false;
      return;
    }
    this.deathT = 0;
    this.root.rotation.x = 0;
    this.root.visible = true;
    this.aim.rotation.x = pitch;
    const low = crouching || sliding;
    this.upper.position.y = HIP_Y - (low ? CROUCH_UPPER_DROP : 0);
    this.label.position.y = low ? HIP_Y + NECK_Y + 0.35 : HIP_Y + NECK_Y + 0.9;
    this.upper.rotation.x = pitch * 0.25 + (dashing ? -0.25 : sliding ? -0.15 : 0);
    this.head.rotation.x = pitch * 0.55;
    const k = Math.min(1, speed / 8.5);
    this.phase += dt * (4 + speed * 1.1);
    const swing = grounded ? Math.sin(this.phase) * 0.75 * k : 0.35;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = grounded ? -swing : -0.5;
    // arms hang down at rest; a positive X rotation swings them forward (-Z) to hold the weapon
    this.armL.rotation.x = 1.3 + pitch * 0.75;
    this.armL.rotation.z = 0.3;
    this.armR.rotation.x = 1.2 + pitch * 0.75;
    this.armR.rotation.z = -0.12;
    // spawn protection: the whole model flickers
    const flash = isProtected && Math.floor(performance.now() / 120) % 2 === 0;
    this.mat.emissive.setHex(flash ? 0x707070 : this.zombieEmissive);
  }

  dispose() {
    this.root.removeFromParent();
    for (const m of this.ownedMats) m.dispose();
    const lm = this.label.material as THREE.SpriteMaterial;
    lm.map?.dispose();
    lm.dispose();
  }
}
