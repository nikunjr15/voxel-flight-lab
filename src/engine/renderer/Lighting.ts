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
  // The floor is only moderately darker than the horizon. A very dark floor
  // turns any metal facing down or inward -- a nozzle bore, an intake lip --
  // almost black, because metal has no diffuse term to fall back on.
  const floor = [0.74, 0.72, 0.71];

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
  rim: DirectionalLight;
  ambient: HemisphereLight;
  environment: Texture;
  dispose(): void;
}

export function setupLighting(scene: Scene, renderer: WebGLRenderer): LightingHandles {
  // Form comes from the gap between key and fill. With the environment map
  // gone from the skin, a strong ambient had filled that gap and left every
  // face of the airframe the same grey; it now carries only enough to keep
  // the shadow side from going black.
  const ambient = new HemisphereLight(0xe8eef5, 0x8e959c, 0.6);
  scene.add(ambient);

  const key = new DirectionalLight(0xfff0e0, 2.5);
  key.position.set(-9, 11, 7);
  scene.add(key);

  const fill = new DirectionalLight(0xcfe0ff, 0.48);
  fill.position.set(8, 4, -9);
  scene.add(fill);

  // A cool back light, high and behind the hero view: it catches the tops of
  // the fins, the spine and the wing roots facing away from the key, which
  // separates the airframe from the backdrop without any reflection.
  const rim = new DirectionalLight(0xe4efff, 1.15);
  rim.position.set(6, 9, -12);
  scene.add(rim);

  // Soft bounce from below. Without it the belly, the intakes and an open
  // weapons bay fall into solid black and the modes that show them read as
  // empty silhouettes.
  const bounce = new DirectionalLight(0xdfe7ee, 0.34);
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
    rim,
    ambient,
    environment,
    dispose() {
      environment.dispose();
      scene.remove(ambient, key, fill, bounce, rim);
    },
  };
}
