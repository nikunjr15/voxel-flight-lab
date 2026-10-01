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
import { createVoxelMaterial, createVoxelUniforms, PartState, VoxelUniforms } from './material';
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

  resetParts(): void {
    this.partState.reset();
    this.setMorph(0);
    this.setExplode(0);
    this.syncTransparency();
  }

  /**
   * Opaque meshes only need blending while something is actually faded. Toggling
   * `transparent` is a render-state change, not a recompile, so this is cheap.
   */
  private syncTransparency(): void {
    let anyFaded = false;
    for (let p = 0; p < PART_COUNT; p++) {
      if (this.partState.getOpacity(p) < 0.995) {
        anyFaded = true;
        break;
      }
    }
    for (const [kind, mat] of this.materials) {
      if (kind === 'glass') continue;
      if (mat.transparent !== anyFaded) mat.transparent = anyFaded;
    }
  }

  dispose(): void {
    for (const mesh of this.meshes.values()) {
      mesh.geometry.dispose();
      mesh.dispose();
    }
    for (const mat of this.materials.values()) mat.dispose();
    this.partState.dispose();
    this.meshes.clear();
    this.materials.clear();
    this.group.clear();
  }
}
