import {
  DataTexture,
  DirectionalLight,
  EquirectangularReflectionMapping,
  FloatType,
  HemisphereLight,
  PMREMGenerator,
  RGBAFormat,
  Scene,
  Texture,
  WebGLRenderer,
} from 'three';

/**
 * A studio in code: cool sky above, warm bounce below, and a soft horizon
 * band. Written as a tiny equirect and run through PMREM, which gives the
 * metal nozzles something to reflect without loading an HDR file.
 */
function makeEnvSource(): DataTexture {
  const w = 64;
  const h = 32;
  const data = new Float32Array(w * h * 4);
  const sky = [1.08, 1.12, 1.18];
  const horizon = [0.95, 0.94, 0.92];
  const floor = [0.52, 0.5, 0.49];
  const warm = [1.5, 1.12, 0.78];

  for (let y = 0; y < h; y++) {
    const v = y / (h - 1);
    for (let x = 0; x < w; x++) {
      const u = x / (w - 1);
      let r: number;
      let g: number;
      let b: number;
      if (v < 0.5) {
        const t = v / 0.5;
        r = sky[0] + (horizon[0] - sky[0]) * t;
        g = sky[1] + (horizon[1] - sky[1]) * t;
        b = sky[2] + (horizon[2] - sky[2]) * t;
      } else {
        const t = (v - 0.5) / 0.5;
        r = horizon[0] + (floor[0] - horizon[0]) * t;
        g = horizon[1] + (floor[1] - horizon[1]) * t;
        b = horizon[2] + (floor[2] - horizon[2]) * t;
      }
      // Warm key lobe up and to the left, matching the directional key light.
      const d = Math.hypot((u - 0.17) * 2.2, (v - 0.26) * 2.6);
      const k = Math.max(0, 1 - d) ** 2.2;
      const i = (y * w + x) * 4;
      data[i] = r + warm[0] * k;
      data[i + 1] = g + warm[1] * k;
      data[i + 2] = b + warm[2] * k;
      data[i + 3] = 1;
    }
  }

  const tex = new DataTexture(data, w, h, RGBAFormat, FloatType);
  tex.mapping = EquirectangularReflectionMapping;
  tex.needsUpdate = true;
  return tex;
}

export interface LightingHandles {
  key: DirectionalLight;
  fill: DirectionalLight;
  ambient: HemisphereLight;
  environment: Texture;
  dispose(): void;
}

export function setupLighting(scene: Scene, renderer: WebGLRenderer): LightingHandles {
  const ambient = new HemisphereLight(0xe8eef5, 0x9aa0a6, 0.85);
  scene.add(ambient);

  const key = new DirectionalLight(0xfff0e0, 2.1);
  key.position.set(-9, 11, 7);
  scene.add(key);

  const fill = new DirectionalLight(0xcfe0ff, 0.85);
  fill.position.set(8, 4, -9);
  scene.add(fill);

  const source = makeEnvSource();
  const pmrem = new PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const environment = pmrem.fromEquirectangular(source).texture;
  scene.environment = environment;
  scene.environmentIntensity = 0.62;
  source.dispose();
  pmrem.dispose();

  return {
    key,
    fill,
    ambient,
    environment,
    dispose() {
      environment.dispose();
      scene.remove(ambient, key, fill);
    },
  };
}
