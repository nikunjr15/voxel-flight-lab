import { BoxGeometry, Color, InstancedMesh, Matrix4, MeshBasicMaterial, Vector3 } from 'three';
import { mulberry32 } from '../util/rng';

interface Mote {
  base: Vector3;
  phase: number;
  speed: number;
  size: number;
  spin: number;
}

/**
 * Faint voxel motes drifting behind the exhibit. Purely atmospheric, so they
 * are unlit basic material and never cast or receive anything.
 */
export class BackdropClouds {
  readonly mesh: InstancedMesh;
  private readonly motes: Mote[] = [];
  private readonly matrix = new Matrix4();
  private readonly scale = new Vector3();

  constructor(count = 220, radius = 46) {
    const rand = mulberry32(0x5eed);
    const geometry = new BoxGeometry(1, 1, 1);
    const material = new MeshBasicMaterial({
      color: new Color('#c3cbd2'),
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });
    this.mesh = new InstancedMesh(geometry, material, count);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -2;
    this.mesh.name = 'backdrop-clouds';

    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const r = radius * (0.45 + rand() * 0.55);
      this.motes.push({
        base: new Vector3(
          Math.cos(a) * r,
          (rand() - 0.42) * radius * 0.7,
          Math.sin(a) * r - radius * 0.25,
        ),
        phase: rand() * Math.PI * 2,
        speed: 0.08 + rand() * 0.16,
        size: 0.22 + rand() * 0.75,
        spin: (rand() - 0.5) * 0.3,
      });
    }
    this.update(0);
  }

  update(t: number): void {
    for (let i = 0; i < this.motes.length; i++) {
      const m = this.motes[i];
      const y = m.base.y + Math.sin(t * m.speed + m.phase) * 1.6;
      const x = m.base.x + Math.cos(t * m.speed * 0.7 + m.phase) * 1.1;
      this.scale.setScalar(m.size);
      this.matrix.makeRotationY(t * m.spin + m.phase);
      this.matrix.scale(this.scale);
      this.matrix.setPosition(x, y, m.base.z);
      this.mesh.setMatrixAt(i, this.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshBasicMaterial).dispose();
    this.mesh.dispose();
  }
}
