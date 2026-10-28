import * as THREE from 'three';
import type { Heading, MapDef } from '@arena/shared';

/**
 * Animated map features that are not plain boxes: lava, portals, jump circles and the sky dome of
 * open-air maps. All of them are emissive overlays drawn on top of the collision geometry; they do
 * not take part in collisions (the shared simulation handles lava, portals and pads by itself).
 */

const faceRotation = (face: Heading): number => (face === '+x' ? Math.PI / 2 : face === '-x' ? -Math.PI / 2 : face === '+z' ? 0 : Math.PI);

const portalShader = (color: number) =>
  new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;
        float a = atan(p.y, p.x);
        float swirl = sin(a * 5.0 + r * 12.0 - uTime * 4.0) * 0.5 + 0.5;
        float core = smoothstep(1.0, 0.0, r);
        vec3 c = mix(uColor * 0.35, uColor * 1.6 + 0.15, swirl * core);
        c += vec3(1.0) * pow(core, 6.0) * 0.6;
        gl_FragColor = vec4(c, 0.92);
      }`,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

const padShader = () =>
  new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uCharge: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uCharge; varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;
        float rings = smoothstep(0.75, 1.0, sin(r * 18.0 - uTime * 7.0));
        float rim = smoothstep(0.82, 0.95, r);
        vec3 base = vec3(0.15, 1.0, 0.55);
        vec3 c = base * (0.25 + rings * 0.9 * uCharge + rim);
        gl_FragColor = vec4(c, 0.9);
      }`,
    transparent: true,
    depthWrite: false,
  });

const lavaShader = () =>
  new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vXZ;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vXZ = w.xz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec2 vXZ;
      float h(vec2 p) {
        return sin(p.x * 0.55 + uTime * 0.6) * sin(p.y * 0.45 - uTime * 0.4)
             + 0.5 * sin((p.x + p.y) * 1.3 + uTime * 1.1)
             + 0.25 * sin(p.x * 2.7 - p.y * 2.1 - uTime * 1.7);
      }
      void main() {
        float v = h(vXZ) * 0.35 + 0.5;
        float crust = smoothstep(0.62, 0.8, v);
        vec3 hot = vec3(1.0, 0.55, 0.08);
        vec3 glow = vec3(1.0, 0.9, 0.4);
        vec3 crustC = vec3(0.18, 0.04, 0.02);
        vec3 c = mix(mix(hot, glow, smoothstep(0.2, 0.0, abs(v - 0.45))), crustC, crust);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });

const skyShader = (top: number, horizon: number) =>
  new THREE.ShaderMaterial({
    uniforms: { uTop: { value: new THREE.Color(top) }, uHorizon: { value: new THREE.Color(horizon) } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop; uniform vec3 uHorizon; varying vec3 vDir;
      void main() {
        float t = clamp(vDir.y, 0.0, 1.0);
        gl_FragColor = vec4(mix(uHorizon, uTop, pow(t, 0.6)), 1.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
  });

interface PortalView {
  mat: THREE.ShaderMaterial;
  ring: THREE.Mesh;
  pos: THREE.Vector3;
  color: number;
}

interface PadView {
  mat: THREE.ShaderMaterial;
  column: THREE.Mesh;
  cooldown: number;
  flash: number;
}

export class MapFeatures {
  readonly group = new THREE.Group();
  readonly portals: PortalView[] = [];
  private pads: PadView[] = [];
  private animated: THREE.ShaderMaterial[] = [];
  private disposables: { dispose(): void }[] = [];
  private sky: THREE.Mesh | null = null;
  private t = 0;

  constructor(map: MapDef) {
    if (map.theme.skyTop !== undefined) {
      const geo = new THREE.SphereGeometry(320, 24, 12);
      const mat = skyShader(map.theme.skyTop, map.theme.sky);
      this.sky = new THREE.Mesh(geo, mat);
      this.sky.renderOrder = -10;
      this.sky.frustumCulled = false;
      this.group.add(this.sky);
      this.disposables.push(geo, mat);
    }

    for (const hz of map.hazards ?? []) {
      const w = hz.max[0] - hz.min[0];
      const d = hz.max[2] - hz.min[2];
      const geo = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);
      const mat = lavaShader();
      const mesh = new THREE.Mesh(geo, mat);
      // slightly below the top of the volume so the surface reads as "you are in it" when touched
      mesh.position.set((hz.min[0] + hz.max[0]) / 2, hz.max[1] - 0.3, (hz.min[2] + hz.max[2]) / 2);
      this.group.add(mesh);
      this.animated.push(mat);
      this.disposables.push(geo, mat);
    }

    for (const p of map.portals ?? []) {
      const geo = new THREE.CircleGeometry(p.radius, 32);
      const mat = portalShader(p.color);
      const disc = new THREE.Mesh(geo, mat);
      const ringGeo = new THREE.TorusGeometry(p.radius + 0.06, 0.09, 6, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: p.color });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      const holder = new THREE.Group();
      holder.add(disc, ring);
      if (p.kind === 'wall') {
        holder.rotation.y = faceRotation(p.face);
        const off = 0.03;
        const dir = p.face === '+x' ? [off, 0] : p.face === '-x' ? [-off, 0] : p.face === '+z' ? [0, off] : [0, -off];
        holder.position.set(p.pos[0] + dir[0], p.pos[1], p.pos[2] + dir[1]);
      } else {
        holder.rotation.x = -Math.PI / 2;
        holder.position.set(p.pos[0], p.pos[1] + 0.02, p.pos[2]);
      }
      this.group.add(holder);
      this.animated.push(mat);
      this.portals.push({ mat, ring, pos: new THREE.Vector3(...p.pos), color: p.color });
      this.disposables.push(geo, mat, ringGeo, ringMat);
    }

    for (const pad of map.jumpPads ?? []) {
      const geo = new THREE.CircleGeometry(pad.radius, 32).rotateX(-Math.PI / 2);
      const mat = padShader();
      const disc = new THREE.Mesh(geo, mat);
      disc.position.set(pad.pos[0], pad.pos[1] + 0.02, pad.pos[2]);
      // faint launch column that hints where the circle throws the player
      const colGeo = new THREE.CylinderGeometry(pad.radius * 0.8, pad.radius, 2.4, 20, 1, true);
      const colMat = new THREE.MeshBasicMaterial({ color: 0x40ff9a, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
      const column = new THREE.Mesh(colGeo, colMat);
      column.position.set(pad.pos[0], pad.pos[1] + 1.2, pad.pos[2]);
      this.group.add(disc, column);
      this.animated.push(mat);
      this.pads.push({ mat, column, cooldown: pad.cooldown, flash: 0 });
      this.disposables.push(geo, mat, colGeo, colMat);
    }
  }

  /** A player was launched by pad `i`: the circle dims while it recharges. */
  padFired(i: number) {
    const p = this.pads[i];
    if (p) p.flash = p.cooldown;
  }

  update(dt: number, cameraPos: THREE.Vector3) {
    this.t += dt;
    for (const m of this.animated) m.uniforms.uTime.value = this.t;
    for (const p of this.pads) {
      p.flash = Math.max(0, p.flash - dt);
      p.mat.uniforms.uCharge.value = p.cooldown > 0 ? 1 - p.flash / p.cooldown : 1;
      (p.column.material as THREE.MeshBasicMaterial).opacity = 0.1 + 0.08 * Math.sin(this.t * 3) + (p.flash > 0 ? 0.25 * (p.flash / p.cooldown) : 0);
    }
    for (const p of this.portals) p.ring.rotation.z = this.t * 0.8;
    if (this.sky) this.sky.position.copy(cameraPos);
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
    this.group.removeFromParent();
  }
}
