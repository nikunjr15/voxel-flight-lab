import {
  DataTexture,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RGBAFormat,
  UnsignedByteType,
} from 'three';

/**
 * A painted soft shadow instead of a shadow map. At 10k instances a real
 * shadow pass doubles the draw cost for an effect this subtle; a radial
 * gradient under the aircraft reads the same on a light backdrop.
 */
export function createContactShadow(radius: number, strength = 0.3): Mesh {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x / (size - 1)) * 2 - 1;
      const ny = (y / (size - 1)) * 2 - 1;
      // Elongated along the fuselage axis so it reads as an aircraft, not a dot.
      const d = Math.hypot(nx * 1.65, ny * 0.95);
      const a = Math.max(0, 1 - d) ** 2.4;
      const i = (y * size + x) * 4;
      data[i] = 24;
      data[i + 1] = 28;
      data[i + 2] = 34;
      data[i + 3] = Math.round(a * 255 * strength);
    }
  }

  const tex = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.needsUpdate = true;

  const mesh = new Mesh(
    new PlaneGeometry(radius * 2, radius * 2),
    new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = -1;
  mesh.name = 'contact-shadow';
  return mesh;
}
