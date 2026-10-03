import {
  Box3,
  BoxGeometry,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Vector3,
} from 'three';
import { MaterialKind } from './palette';
import { PART_COUNT, PART_INDEX, PartId } from './parts';
import { createVoxelMaterial, createVoxelUniforms, PartState, SOLID_OPACITY, VoxelUniforms } from './material';
import type { SurfaceData } from './surface';

export interface VoxelModelInfo {
  id: string;
  /** Instances actually drawn. */
  surfaceVoxels: number;
  /** Every filled cell, including the hidden interior. */
  solidVoxels: number;
  drawCalls: number;
}

/**
 * One aircraft on screen: at most four InstancedMeshes sharing a part-state
 * texture. Instance matrices are pure translations, which lets the vertex
 * shader displace a voxel by simply adding to the local box position.
 */
export class VoxelModel {
  readonly group = new Group();
  readonly partState = new PartState();
  readonly uniforms: VoxelUniforms;
  readonly meshes = new Map<MaterialKind, InstancedMesh>();
  readonly materials = new Map<MaterialKind, MeshStandardMaterial>();
  /** Ghost passes for faded parts, one per opaque bucket; hidden until something fades. */
  private readonly ghosts: InstancedMesh[] = [];
  readonly bounds = new Box3();
  readonly info: VoxelModelInfo;

  private readonly centroids: Float32Array;
  private readonly counts: Uint32Array;

  constructor(id: string, data: SurfaceData) {
    this.uniforms = createVoxelUniforms(this.partState);
    this.centroids = data.partCentroids;
    this.counts = data.partCounts;
    this.group.name = `voxel:${id}`;

    const m = new Matrix4();
    for (const bucket of data.buckets) {
      const material = createVoxelMaterial({ kind: bucket.kind, uniforms: this.uniforms });
      // A geometry per bucket: the instanced attributes below live on the
      // geometry, so a shared one would have each bucket clobber the last.
      const geometry = new BoxGeometry(data.voxelSize, data.voxelSize, data.voxelSize);
      const mesh = new InstancedMesh(geometry, material, bucket.count);
      mesh.name = `${id}:${bucket.kind}`;
      // The vertex shader moves instances, so a static bounding sphere would be
      // wrong during scatter and explode. One model on screen makes culling moot.
      mesh.frustumCulled = false;
      mesh.renderOrder = bucket.kind === 'glass' ? 10 : 0;

      for (let i = 0; i < bucket.count; i++) {
        m.makeTranslation(
          bucket.offsets[i * 3],
          bucket.offsets[i * 3 + 1],
          bucket.offsets[i * 3 + 2],
        );
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;

      mesh.geometry.setAttribute('aColor', new InstancedBufferAttribute(bucket.colors, 3));
      mesh.geometry.setAttribute('aPart', new InstancedBufferAttribute(bucket.parts, 1));
      mesh.geometry.setAttribute('aAO', new InstancedBufferAttribute(bucket.ao, 1));
      mesh.geometry.setAttribute('aScatter', new InstancedBufferAttribute(bucket.scatter, 3));
      mesh.geometry.setAttribute('aSeed', new InstancedBufferAttribute(bucket.seeds, 1));

      this.meshes.set(bucket.kind, mesh);
      this.materials.set(bucket.kind, material);
      this.group.add(mesh);

      if (bucket.kind !== 'glass') {
        // Same geometry and instances, drawn blended after the solid pass and
        // without writing depth. See createVoxelMaterial.
        const ghostMat = createVoxelMaterial({ kind: bucket.kind, uniforms: this.uniforms, ghost: true });
        const ghost = new InstancedMesh(geometry, ghostMat, bucket.count);
        ghost.instanceMatrix = mesh.instanceMatrix;
        ghost.name = `${id}:${bucket.kind}:ghost`;
        ghost.frustumCulled = false;
        ghost.renderOrder = 5;
        ghost.visible = false;
        this.ghosts.push(ghost);
        this.group.add(ghost);
      }
    }

    this.bounds.set(new Vector3(...data.min), new Vector3(...data.max));
    this.info = {
      id,
      surfaceVoxels: data.total,
      solidVoxels: data.solid,
      drawCalls: data.buckets.length,
    };
  }

  get size(): Vector3 {
    return this.bounds.getSize(new Vector3());
  }

  get center(): Vector3 {
    return this.bounds.getCenter(new Vector3());
  }

  /** Model-space centroid of a part, or null when the model has no such part. */
  partCentroid(part: PartId): Vector3 | null {
    const p = PART_INDEX[part];
    if (p === undefined || this.counts[p] === 0) return null;
    return new Vector3(this.centroids[p * 3], this.centroids[p * 3 + 1], this.centroids[p * 3 + 2]);
  }

  hasPart(part: PartId): boolean {
    const p = PART_INDEX[part];
    return p !== undefined && this.counts[p] > 0;
  }

  partVoxelCount(part: PartId): number {
    const p = PART_INDEX[part];
    return p === undefined ? 0 : this.counts[p];
  }

  setMorph(v: number): void {
    this.uniforms.uMorph.value = v;
  }

  setExplode(v: number): void {
    this.uniforms.uExplode.value = v;
  }

  setExplodeScale(v: number): void {
    this.uniforms.uExplodeScale.value = v;
  }

  setAccent(hex: string): void {
    this.uniforms.uAccent.value.set(hex);
  }

  setOpacity(part: PartId, v: number): void {
    const p = PART_INDEX[part];
    if (p === undefined) return;
    this.partState.setOpacity(p, v);
    this.syncTransparency();
  }

  setHighlight(part: PartId, v: number): void {
    const p = PART_INDEX[part];
    if (p === undefined) return;
    this.partState.setHighlight(p, v);
  }

  setPartExplode(part: PartId, v: number): void {
    const p = PART_INDEX[part];
    if (p === undefined) return;
    this.partState.setExplode(p, v);
  }

  setPartEmissive(part: PartId, v: number): void {
    const p = PART_INDEX[part];
    if (p === undefined) return;
    this.partState.setEmissive(p, v);
  }

  /** Hot-metal glow in the heat colour, independent of the voxel's own colour. */
  setPartHeat(part: PartId, v: number): void {
    const p = PART_INDEX[part];
    if (p === undefined) return;
    this.partState.setHeat(p, v);
  }

  /** Swings a part about a hinge line in model space. */
  setPartHinge(
    part: PartId,
    pivot: [number, number, number],
    axis: [number, number, number],
    angle: number,
  ): void {
    const p = PART_INDEX[part];
    if (p === undefined) return;
    this.partState.setHinge(p, pivot, axis, angle);
  }

  /** Hidden parts still build and count; this says whether any are showing. */
  isPartVisible(part: PartId): boolean {
    const p = PART_INDEX[part];
    return p !== undefined && this.counts[p] > 0 && this.partState.getOpacity(p) > 0.02;
  }

  resetParts(): void {
    this.partState.reset();
    this.setMorph(0);
    this.setExplode(1);
    this.syncTransparency();
  }

  /**
   * The ghost passes only draw while some part sits between hidden and
   * fully opaque, so a model with nothing faded costs no extra draw calls.
   */
  private syncTransparency(): void {
    let anyGhost = false;
    for (let p = 0; p < PART_COUNT; p++) {
      const o = this.partState.getOpacity(p);
      if (o > 0.02 && o < SOLID_OPACITY) {
        anyGhost = true;
        break;
      }
    }
    for (const g of this.ghosts) g.visible = anyGhost;
  }

  dispose(): void {
    for (const mesh of this.meshes.values()) {
      mesh.geometry.dispose();
      mesh.dispose();
    }
    for (const mat of this.materials.values()) mat.dispose();
    for (const g of this.ghosts) {
      (g.material as MeshStandardMaterial).dispose();
      g.dispose();
    }
    this.ghosts.length = 0;
    this.partState.dispose();
    this.meshes.clear();
    this.materials.clear();
    this.group.clear();
  }
}
