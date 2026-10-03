# Voxel Flight Lab

An interactive museum of fighter jets, from the first operational jets of the
1940s to concepts that have not yet flown. Every airframe, icon, particle and
sound is generated in code: there are no 3D models, textures, images or audio
files in the project.

Scroll through eight chapters, one era each. Pick an aircraft from the ribbon
of silhouettes at the top or step with the arrow keys. Inspect it with the
toolbar: plan view, cockpit, engines, weapons, x-ray, thrust, sound. Chapter 8
stands any two aircraft side by side at true relative scale.

> A design concept. Not affiliated with or endorsed by any manufacturer or air
> force. Specifications are approximate public figures; where a figure is not
> published, it is left out.

## Running it

Needs Node 20 or later.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check, then a production build in dist/
npm run preview    # serve dist/ locally
npm run og         # re-render the social preview image (needs a local Chrome)
```

Runtime dependencies are Three.js and GSAP; nothing else.

### Addresses

- `#ch3` opens a chapter at its text.
- `#ch3/mig-23` opens a chapter at an aircraft.
- `#ch8/gnat-vs-f-86` opens Compare on a pair.

Back and forward work. The older `?id=f-16` form still opens that aircraft's
chapter.

## How it fits together

```
src/
  aircraft/          the collection, as data
    data/*.ts        one config per aircraft
    chapters.ts      chapter copy: era, summary, key innovation
    index.ts         exhibit order, suggested Compare pairs
  engine/
    build/           config -> voxel grid -> instance buffers; runs in a worker
    voxel/           VoxelModel, the voxel material and its part-state texture
    renderer/        stage, lighting, contact shadow, backdrop
    particles/       airflow, plume, shock diamonds, speed lines, vapour cone
    audio/           JetAudio: Web Audio synthesis
  scenes/            camera rig, view modes, radar view, Compare hangar
  ui/                chrome, chapters, ribbon, loader, panels, text fallback
  app/               App: navigation, morphs, history, adaptive quality
scripts/og.mjs       renders public/og.png from the site in headless Chrome
review/              per-phase review notes (captures are kept local)
```

An aircraft is built in a web worker. The worker turns its config into a
dense voxel grid. It keeps only the surface voxels and returns them as
transferable buffers. On the main thread, each material bucket becomes one
instanced mesh. Every voxel carries a part tag (wing, nozzle, canopy, bay
door, and so on), and every view mode is a camera preset plus per-part state
written into a small texture: opacity, highlight, explode, hinge. Switching
modes never rebuilds geometry.

Changing aircraft is a morph: the old airframe scatters into its voxel cloud
while the new one gathers out of its own. Builds are cached, and the likely
next aircraft are built ahead of time, so a morph does not wait on the worker.

## Adding an aircraft

An aircraft is data only. If it needs a shape the builders cannot express,
add or extend a builder in `src/engine/build/`. Never put geometry code in a
config.

1. Copy the closest existing config in `src/aircraft/data/` to a new file.
   For example, start from `f16.ts` for a single-engine fighter, or `su27.ts`
   for a twin with spaced nacelles.
2. Fill in the parts:

   ```ts
   export const MY_JET: AircraftConfig = {
     id: 'my-jet',                // used in addresses: #ch4/my-jet
     name: 'My Jet',
     designation: 'MJ-1',         // short form, used on chips and labels
     exhibitNo: '028',
     chapter: 4,                  // 1-7; the ribbon and chapter lists follow it
     spec: {
       firstFlight: 1980,         // omit for an aircraft that has not flown
       engines: { count: 1, type: 'afterburning-turbofan' },
       crew: 1,
       role: 'Multirole fighter',
       country: 'US',
       generation: '4',
       lengthM: 15.0,             // omit any figure that is not published
       spanM: 10.0,
       status: 'in-service',      // 'concept' tags it as a concept everywhere
     },
     copy: {
       category: 'SINGLE-ENGINE MULTIROLE FIGHTER',
       subtitle: ['First line of the placard,', 'second line.'],
       annotations: [{ n: '01', title: 'Short title', body: 'One or two sentences.' }],
     },
     palette: { /* skin, skinDark, glass, nozzle, ... see types.ts */ },
     geometry: {
       bbox: { span: 10.0, height: 5.0 },
       fuselage: { /* stations: the cross-section along the length */ },
       wing: { /* planform: root and tip chord, sweep, span, thickness */ },
       intakes: [/* kind: 'chin' | 'side-rect' | 'side-half-cone' | 'nose' | 'caret' | 'dsi' | 'dorsal' */],
       nozzle: { /* kind and size */ },
       canopy: { /* position, size, cockpit tier: 'analog' | 'mixed' | 'mfd' | 'glass' */ },
       // optional: canard, lerx, tailH, tailV, tailVTwin, tailVee, nacelles,
       // bays, stores, markings, lettering ...
     },
   };
   ```

   `src/aircraft/types.ts` documents every field. The comments there explain
   what each option does to the shape.
3. Register it in `src/aircraft/index.ts`, in `AIRCRAFT`, in exhibit order.
4. Check it with the review views below:
   - `?gallery=my-jet&view=plan` for the planform
   - `?gallery=my-jet&view=hero34` for the three-quarter view
5. Check the voxel count. The target is about 14,000 surface voxels at full
   density; the gallery prints it. If a deep or boxy airframe goes over, set
   `geometry.targetLengthVoxels` to bring it under.

Copy rules, the same for every aircraft: be accurate and concise, and leave
out anything that cannot be stated with confidence. A missing figure is
shown as "not published", never as a guess or a zero.

## The review harness

These views exist in development and in Vercel preview deployments, behind
the `__REVIEW__` build flag. They are never in a production deployment.

| Address | What it does |
|---|---|
| `?gallery=2b` or `?gallery=f-16,su-27` | A batch at true relative scale. Add `&view=plan`, `hero34`, `side`, `rear34` and so on. The console prints the voxel table. |
| `?rig=1` | The primitive test bench: every builder on a plinth. Add `&only=N&view=side` to isolate one. |
| `?stats=1`, or the F key | Frame-time readout: frame interval, CPU and GPU time per frame, the worst frame, and the last model swap. |
| `?density=0.65` | Pins the build density, and turns adaptive quality off. |
| `?compare=side` | The side-by-side Compare layout on a phone (stacked is the default). |

`review/<phase>/README.md` records each phase's review: what was captured,
frame costs, and decisions. The captures themselves (JPG, PNG, GIF) stay out
of git.

For a preview deployment to check on a real phone:

```bash
npx vercel login
npm run deploy:preview
```

## Performance and robustness

- **Adaptive quality.** If the frame interval stays above 24 ms (about
  42 fps) for two seconds, the build density steps down: 1.0, 0.8, 0.65, 0.5.
  The steps also drop grain, then MSAA, then pixel ratio above 1. Each step
  is crossfaded. It never steps back up.
- **Phones** start at density 0.65 with pixel ratio capped at 1.5.
- **No WebGL 2:** the page becomes a text edition: every chapter, and every
  aircraft's specification table and notes.
- **A lost GPU context** shows a notice and the current aircraft's figures,
  and reloads in place once the browser restores the context.
- **A worker that fails to load** falls back to building on the main thread.
- **Reduced motion:** morphs become crossfades, and there is no camera shake
  and no speed lines. The flyby is a calm pass, and the loader shows a still
  silhouette.

## Accessibility

- All chapter and specification text is real HTML in reading order.
- Every control is reachable by keyboard, with a visible focus ring.
- The ribbon is a single tab stop; the arrow keys move inside it.
- Text meets WCAG AA contrast against the page background.
- Aircraft changes are announced through a polite live region.
- Each aircraft has a specification table with row headers.
- Sound is off by default, and starts only from a click.

## Deploying

The project is set up for Vercel. `vercel.json` builds with `npm run build`
and serves `dist/`.

`public/og.png` is committed. The pre-build step renders it only when it is
missing, because build machines have no Chrome. Run `npm run og` locally to
refresh it.

Social cards use absolute URLs from `VERCEL_PROJECT_PRODUCTION_URL`, or from
`VITE_SITE_URL` when it is set.
