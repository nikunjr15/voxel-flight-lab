# Phase 5 review: scroll chapters

Captured from headless Chrome against the dev server, driven over the
DevTools protocol. Images and recordings stay local (they are ignored by git
from this phase on); this README is the committed record.

## Stills

    <device>-<nn>-<what>.jpg

`desktop` is 1440x900 at 1.5x; `phone` is 375x812 at 2x with touch and
mobile emulation.

| # | Shows |
|---|---|
| 01 | Top of the page: the introduction, the first aircraft part-scattered |
| 02 | Chapter 1 text over the stage; placard faded out |
| 03 | Chapter 1 exhibit run: placard back, ribbon marks the Me 262 |
| 04 | Mid-morph, F-15 to F-16 (arrow key) |
| 05 | Chapter 7 text, every aircraft tagged as a concept |
| 06 | Chapter 8, Compare: text only until Compare mode lands in phase 6 |
| 07 | Deep link `#ch3/mig-23` opened cold |
| 08 | `?gallery=2b`, to show the review views still work |
| 09 | The ribbon at 2.5x: plan-view masks from the worker, current aircraft underlined |

## Recordings

640x400 (phone 300x650), 15 fps, film grain off for the recording only.

| File | Shows |
|---|---|
| `scroll-two-chapters.gif` | Wheel scroll from the top: the cover cloud gathering, chapter 1 text and exhibit, the morph into chapter 2, its text and exhibit |
| `morph-f-15-to-su-27.gif` | Arrow-key morphs F-15, F-16, Su-27, starting in Engines: the toolbar glides back to Overview |
| `ribbon-and-back.gif` | Ribbon pick from chapter 2 to the F-22, then the browser back button |
| `morph-reduced-motion.gif` | The same step with `prefers-reduced-motion`: crossfade, no scatter |
| `phone-scroll.gif` | Phone: chapter text stacked over the stage, ribbon as its own strip |

## Frame cost during a morph

Each row is a 1.5 s window (2.2 s for the scroll and cold cases) starting at
the input that triggered the morph. CPU is main-thread time per frame inside
the render loop, mean and worst frame. "Swap" is the main-thread work that
puts the new model on the turntable, which runs once per morph outside the
loop. Long tasks are any over 50 ms seen by a `PerformanceObserver`.

Ryzen 7 7435HS, RTX 4050 Laptop GPU. Phone is 375x812 emulation with the CPU
throttled 4x, rendering at 1.5x and density 0.65.

| Case | Desktop CPU ms (worst) | Desktop swap ms | Phone CPU ms (worst) | Phone swap ms |
|---|---|---|---|---|
| idle, no morph | 0.68 (1.1) | - | 3.3 (5.2) | - |
| arrow key, prefetched | 0.71-0.83 (3.4-4.6) | 3.4-6.5 | 3.4-3.6 (17.6-19.9) | 13.9-20.8 |
| scroll into the next chapter | 0.63 (3.1) | 6.1 | 3.0 (13.2) | 18.2 |
| ribbon pick, nothing prefetched | 0.66 (3.4) | 7.7 | 3.2 (10.6) | 12.5 |

No long tasks in any of these windows, on either device.

The worst frame on each morph is the one that uploads the new model's
buffers. On the throttled phone that frame plus the swap comes to roughly
35-40 ms at 4x, so about 9-10 ms on the unthrottled CPU.

Not reported:

- **Frame interval.** Headless Chrome's frame clock ran at about 47 Hz for
  this session, and a blank page measured the same 21 ms. It says nothing
  about the app.
- **GPU timer readings.** They were unstable here: an idle model read anywhere
  from 0.9 to 8 ms on different runs, often higher than mid-morph. The
  morph's own GPU cost is the outgoing and incoming models drawn together for
  about a second, at most two airframes' worth of instances.

For a real phone, use `?stats=1` on a preview build. The readout now also
shows the worst frame and the swap time.
