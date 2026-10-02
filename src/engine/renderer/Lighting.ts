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

  for (let y = 0; y < h; y++) {
    const v = y / (h - 1);
    for (let x = 0; x < w; x++) {
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
      // Deliberately no bright lobe. A hotspot in the environment reflects
      // off a large flat panel as a soft oval that sweeps with the view, which
      // read as dirty patches on wings. The warm key is a directional light;
      // the environment only has to supply smooth ambient gradient.
      const i = (y * w + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
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
  bounce: DirectionalLight;
  ambient: HemisphereLight;
  environment: Texture;
  dispose(): void;
}

export function setupLighting(scene: Scene, renderer: WebGLRenderer): LightingHandles {
  // Carries the ambient the skin no longer gets from the environment map.
  const ambient = new HemisphereLight(0xe8eef5, 0x9aa0a6, 1.02);
  scene.add(ambient);

  const key = new DirectionalLight(0xfff0e0, 2.05);
  key.position.set(-9, 11, 7);
  scene.add(key);

  const fill = new DirectionalLight(0xcfe0ff, 0.85);
  fill.position.set(8, 4, -9);
  scene.add(fill);

  // Soft bounce from below. Without it the belly, the intakes and an open
  // weapons bay fall into solid black and the modes that show them read as
  // empty silhouettes.
  const bounce = new DirectionalLight(0xdfe7ee, 0.45);
  bounce.position.set(-3, -8, 4);
  scene.add(bounce);

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
    bounce,
    ambient,
    environment,
    dispose() {
      environment.dispose();
      scene.remove(ambient, key, fill, bounce);
    },
  };
}
