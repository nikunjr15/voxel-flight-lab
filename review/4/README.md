# Phase 4 review: toolbar modes

Captured from headless Chrome against the dev server, driven over the
DevTools protocol, so every shot is taken the same number of seconds after
its mode was selected.

## Stills

    <device>-<jet>-<mode>.jpg

- `device`: `desktop` is 1440x900 at 1.5x (canvas 2160x1350); `phone` is
  375x812 at 2x with touch and mobile emulation, which the app renders at
  1.5x (canvas 562x1218) and density 0.65.
- `jet`: `f-86` (early), `su-27` (fourth generation), `f-22` (stealth).
- `mode`: `overview` (hero34), `plan`, `cockpit`, `engines`, `weapons`,
  `xray` (separation 0.65), `thrust` (from the hero view), and `radar` on
  the F-22.

## Recordings

640x400, 15 fps, with the film grain switched off for the recording only: an
animated grain changes every pixel of every frame and no GIF compresses it.
The GIF palette also bands the backdrop vignette, which the app itself does
not.

| File | Shows |
|---|---|
| `modes-su-27.gif` | overview, plan, cockpit, engines, weapons, x-ray, back to overview |
| `modes-f-22.gif` | bay doors open and missiles drop; engines; radar view on and off |
| `cockpit-f-86.gif` | the cockpit section cross-fading in, and back out |
| `xray-scrub-su-27.gif` | separation slider 0, to 1, back to 0.65 |
| `thrust-su-27.gif` | thrust on and off from the engines view: plume, diamonds, shake, speed lines |
| `thrust-f-22-hero.gif` | thrust on and off from the hero view |
| `thrust-su-27-reduced-motion.gif` | the same with `prefers-reduced-motion`: no shake, no speed lines |
| `sweep-mig-23.gif` | wing-sweep slider, 16 to 72 degrees and back, in plan view |

## Frame cost per mode

Mean over two seconds, sampled after the camera glide has settled, ranges
across the three jets. CPU is main-thread time for one frame; GPU is a timer
query around the scene and post pass. Hardware: Ryzen 7 7435HS, RTX 4050
Laptop GPU. The display runs at 144 Hz, so frame time sits at 6.9 ms in every
mode; the CPU and GPU columns are the headroom.

GPU times on this card are noisy at these loads (the clocks drop when the
work is light), so read them as an order of magnitude.

| Mode | Desktop CPU ms | Desktop GPU ms | Phone CPU ms (4x throttle) | Phone GPU ms |
|---|---|---|---|---|
| overview | 0.44-0.59 | 1.7-3.0 | 2.2-2.7 | 1.2-2.5 |
| plan | 0.37-0.46 | 1.8-2.9 | 2.2-2.5 | 2.6-3.0 |
| cockpit | 0.51-0.52 | 2.7-2.9 | 2.0-2.6 | 1.6-2.9 |
| engines | 0.70-0.79 | 1.6-3.2 | 3.4-4.1 | 1.4-2.3 |
| weapons | 0.44-0.46 | 1.9-2.2 | 2.0-2.1 | 0.9-1.2 |
| x-ray | 0.90-0.99 | 3.0-3.8 | 3.1-3.4 | 1.2-1.5 |
| thrust | 0.98-1.15 | 1.0-3.2 | 5.4-5.6 | 1.1-1.7 |
| radar (F-22) | 0.67 | 3.4 | 3.7 | 2.1 |

The phone GPU column is the laptop GPU drawing at phone resolution, not a
phone GPU. For a real device, open a preview build with `?stats=1`: the
readout now shows CPU and, where the browser allows a timer query, GPU time
per frame.
