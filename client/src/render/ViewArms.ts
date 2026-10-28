import * as THREE from 'three';
import { partSize, type V3 } from './characterModel';
import { makeSkinMaterial, type Shading, skinGeometry, type SkinMaterial } from './Character';

/**
 * Where each hand grips each weapon, in the weapon's local space (weapon points toward -Z), and the
 * direction the forearm comes from (towards the elbow, off-screen behind and below the camera).
 * Index = weapon id. Values tuned against the boxes of `weaponLayout.ts` (right hand on the pistol
 * grip, left hand under the fore-end): revisit them whenever a weapon model changes.
 */
interface Grip {
  hand: V3;
  /** Unit-ish vector from the hand towards the elbow. */
  back: V3;
  /** Roll of the forearm around its axis (radians), to show a nicer face of the skin. */
  roll: number;
}

const GRIPS: { right: Grip; left: Grip }[] = [
  // Carabina Tormenta
  { right: { hand: [0.0, -0.09, 0.08], back: [0.85, -0.3, 0.7], roll: -0.25 }, left: { hand: [0.0, -0.07, -0.3], back: [-0.7, -0.35, 1], roll: 0.4 } },
  // Dispersor Ariete
  { right: { hand: [0.0, -0.1, 0.1], back: [0.85, -0.3, 0.7], roll: -0.25 }, left: { hand: [0.0, -0.09, -0.4], back: [-0.7, -0.35, 1], roll: 0.4 } },
  // Aguja Lumen
  { right: { hand: [0.0, -0.08, 0.12], back: [0.85, -0.3, 0.7], roll: -0.25 }, left: { hand: [0.0, -0.06, -0.22], back: [-0.7, -0.35, 1], roll: 0.4 } },
  // Lanzador Cometa
  { right: { hand: [0.0, -0.12, -0.05], back: [0.85, -0.3, 0.7], roll: -0.25 }, left: { hand: [0.0, -0.13, -0.35], back: [-0.7, -0.35, 1], roll: 0.4 } },
  // Mortero Grillo
  { right: { hand: [0.0, -0.1, 0.13], back: [0.85, -0.3, 0.7], roll: -0.25 }, left: { hand: [0.0, -0.19, -0.12], back: [-0.7, -0.35, 1], roll: 0.4 } },
  // Hilo Aurora
  { right: { hand: [0.0, -0.09, 0.1], back: [0.85, -0.3, 0.7], roll: -0.25 }, left: { hand: [0.0, -0.04, -0.3], back: [-0.7, -0.35, 1], roll: 0.4 } },
  // Lanza Cuasar
  { right: { hand: [0.0, -0.1, 0.14], back: [0.85, -0.3, 0.7], roll: -0.25 }, left: { hand: [0.0, -0.1, -0.25], back: [-0.7, -0.35, 1], roll: 0.4 } },
];

/** Slimmer than the third-person arms: the camera is right behind them. */
const VIEW_SCALE = 0.8;

/**
 * The player's own arms in first person, textured with their skin. They live in the view-model
 * scene and follow the weapon group, so bob, recoil and the lowering animation move them too.
 */
export class ViewArms {
  readonly group = new THREE.Group();
  private pivots: THREE.Group[] = [];
  private mat: SkinMaterial;
  private weapon = -1;

  constructor(shading: Shading, skin: THREE.Texture) {
    this.mat = makeSkinMaterial(shading, skin);
    const len = partSize('armR')[1] * VIEW_SCALE;
    for (const id of ['armR', 'armL'] as const) {
      const pivot = new THREE.Group();
      const mesh = new THREE.Mesh(skinGeometry(id), this.mat);
      mesh.scale.setScalar(VIEW_SCALE);
      mesh.position.y = len / 2 - 0.02; // hand end at the pivot
      pivot.add(mesh);
      this.group.add(pivot);
      this.pivots.push(pivot);
    }
    this.group.visible = false;
  }

  setSkin(skin: THREE.Texture) {
    if (this.mat.map === skin) return;
    this.mat.map = skin;
    this.mat.needsUpdate = true;
  }

  /** Places both hands on the grips of a weapon (only recomputed when the weapon changes). */
  setWeapon(id: number) {
    if (id === this.weapon) return;
    this.weapon = id;
    const g = GRIPS[id] ?? GRIPS[0];
    [g.right, g.left].forEach((grip, i) => {
      const p = this.pivots[i];
      p.position.set(...grip.hand);
      const dir = new THREE.Vector3(...grip.back).normalize();
      p.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      p.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), grip.roll));
    });
  }

  /** Copies the weapon's transform so the arms move with it. */
  follow(weapon: THREE.Object3D) {
    this.group.position.copy(weapon.position);
    this.group.rotation.copy(weapon.rotation);
  }

  dispose() {
    this.group.removeFromParent();
    this.mat.dispose();
  }
}
