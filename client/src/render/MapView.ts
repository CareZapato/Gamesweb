import * as THREE from 'three';

import type { BoxDef, MapDef, Material, RampDef } from '@arena/shared';

import { applyTextureOverrides, proceduralTexture, TEXTURE_SCALE } from './textures';



export interface MapViewOptions {

  maxAnisotropy: number;

  textureSize: 128 | 256;

  mapLambert: boolean;

  pointLights: boolean;

}



interface GeoBuilder {

  pos: number[];

  nor: number[];

  uv: number[];

  idx: number[];

}



const newBuilder = (): GeoBuilder => ({ pos: [], nor: [], uv: [], idx: [] });



/** Adds a planar polygon (3 or 4 vertices, CCW seen from outside) with world-space UVs. */

const addFace = (b: GeoBuilder, verts: [number, number, number][], n: [number, number, number], scale: number) => {

  const base = b.pos.length / 3;

  const ax = Math.abs(n[0]),

    ay = Math.abs(n[1]),

    az = Math.abs(n[2]);

  for (const v of verts) {

    b.pos.push(v[0], v[1], v[2]);

    b.nor.push(n[0], n[1], n[2]);

    let u: number, w: number;

    if (ay >= ax && ay >= az) {

      u = v[0];

      w = v[2];

    } else if (ax >= az) {

      u = v[2];

      w = v[1];

    } else {

      u = v[0];

      w = v[1];

    }

    b.uv.push(u / scale, w / scale);

  }

  if (verts.length === 4) b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);

  else b.idx.push(base, base + 1, base + 2);

};



const addBox = (b: GeoBuilder, d: BoxDef, scale: number) => {

  const [x0, y0, z0] = d.min;

  const [x1, y1, z1] = d.max;

  addFace(b, [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], scale);

  addFace(b, [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], scale);

  addFace(b, [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], scale);

  addFace(b, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], scale);

  addFace(b, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], scale);

  addFace(b, [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], scale);

};



const addRamp = (b: GeoBuilder, r: RampDef, scale: number) => {

  const [x0, y0, z0] = r.min;

  const [x1, y1, z1] = r.max;

  const rise = y1 - y0;

  const n = (x: number, y: number, z: number): [number, number, number] => {

    const l = Math.hypot(x, y, z);

    return [x / l, y / l, z / l];

  };

  addFace(b, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], scale);

  switch (r.dir) {

    case '+x': {

      const len = x1 - x0;

      addFace(b, [[x0, y0, z1], [x1, y1, z1], [x1, y1, z0], [x0, y0, z0]], n(-rise, len, 0), scale);

      addFace(b, [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], scale);

      addFace(b, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1]], [0, 0, 1], scale);

      addFace(b, [[x1, y0, z0], [x0, y0, z0], [x1, y1, z0]], [0, 0, -1], scale);

      break;

    }

    case '-x': {

      const len = x1 - x0;

      addFace(b, [[x0, y1, z1], [x1, y0, z1], [x1, y0, z0], [x0, y1, z0]], n(rise, len, 0), scale);

      addFace(b, [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], scale);

      addFace(b, [[x0, y0, z1], [x1, y0, z1], [x0, y1, z1]], [0, 0, 1], scale);

      addFace(b, [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0]], [0, 0, -1], scale);

      break;

    }

    case '+z': {

      const len = z1 - z0;

      addFace(b, [[x0, y0, z0], [x0, y1, z1], [x1, y1, z1], [x1, y0, z0]], n(0, len, -rise), scale);

      addFace(b, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], scale);

      addFace(b, [[x1, y0, z1], [x1, y0, z0], [x1, y1, z1]], [1, 0, 0], scale);

      addFace(b, [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], [-1, 0, 0], scale);

      break;

    }

    default: {

      const len = z1 - z0;

      addFace(b, [[x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z0]], n(0, len, rise), scale);

      addFace(b, [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], scale);

      addFace(b, [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0]], [1, 0, 0], scale);

      addFace(b, [[x0, y0, z0], [x0, y0, z1], [x0, y1, z0]], [-1, 0, 0], scale);

    }

  }

};



const MATERIAL_PARAMS: Record<Exclude<Material, 'light'>, { roughness: number; metalness: number }> = {

  floor: { roughness: 0.75, metalness: 0.35 },

  metal: { roughness: 0.5, metalness: 0.55 },

  panel: { roughness: 0.65, metalness: 0.4 },

  grate: { roughness: 0.6, metalness: 0.6 },

  concrete: { roughness: 0.95, metalness: 0.0 },

  red: { roughness: 0.6, metalness: 0.3 },

  blue: { roughness: 0.6, metalness: 0.3 },

  trim: { roughness: 0.6, metalness: 0.2 },

  dark: { roughness: 0.9, metalness: 0.2 },
  ground: { roughness: 1.0, metalness: 0.0 },

};



type MapSurfaceMaterial = THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;



/**

 * Builds the visible level from the same MapDef the server collides against, merging all boxes of a

 * material into a single mesh (one draw call per material).

 */

export class MapView {

  readonly group = new THREE.Group();

  private disposables: { dispose(): void }[] = [];

  readonly mapMaterials = new Map<Material, MapSurfaceMaterial>();

  private lightsGroup = new THREE.Group();

  private opts: MapViewOptions;



  constructor(map: MapDef, opts: MapViewOptions) {

    this.opts = { ...opts };

    const builders = new Map<Material, GeoBuilder>();

    const get = (m: Material) => {

      let b = builders.get(m);

      if (!b) builders.set(m, (b = newBuilder()));

      return b;

    };

    for (const b of map.boxes) addBox(get(b.mat), b, TEXTURE_SCALE[b.mat]);

    for (const r of map.ramps) addRamp(get(r.mat), r, TEXTURE_SCALE[r.mat]);



    for (const [mat, b] of builders) {

      const geo = new THREE.BufferGeometry();

      geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));

      geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));

      geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));

      geo.setIndex(b.idx);

      geo.computeBoundingSphere();

      let material: THREE.Material;

      if (mat === 'light') {

        material = new THREE.MeshBasicMaterial({ color: 0xfff1d6 });

      } else {

        const tex = proceduralTexture(mat, opts.maxAnisotropy, opts.textureSize);

        if (opts.mapLambert) {

          const m = new THREE.MeshLambertMaterial({ map: tex });

          this.mapMaterials.set(mat, m);

          material = m;

        } else {

          const p = MATERIAL_PARAMS[mat];

          const m = new THREE.MeshStandardMaterial({

            map: tex,

            roughness: p.roughness,

            metalness: p.metalness,

          });

          this.mapMaterials.set(mat, m);

          material = m;

        }

      }

      const mesh = new THREE.Mesh(geo, material);

      mesh.receiveShadow = true;

      mesh.castShadow = mat !== 'dark' && mat !== 'light' && mat !== 'floor';

      mesh.matrixAutoUpdate = false;

      mesh.updateMatrix();

      this.group.add(mesh);

      this.disposables.push(geo, material);

    }



    for (const l of map.lights) {

      const light = new THREE.PointLight(l.color, l.intensity, l.distance, 1.6);

      light.position.set(l.pos[0], l.pos[1], l.pos[2]);

      this.lightsGroup.add(light);

    }

    this.lightsGroup.visible = opts.pointLights;

    this.group.add(this.lightsGroup);

    void applyTextureOverrides(this.mapMaterials, opts.maxAnisotropy);

  }



  setPointLights(on: boolean) {

    this.opts.pointLights = on;

    this.lightsGroup.visible = on;

  }



  dispose() {

    for (const d of this.disposables) d.dispose();

    this.group.removeFromParent();

  }

}


