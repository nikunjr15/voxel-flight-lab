# Phase 6 review: loader, Compare, sound, easter egg

Captured from headless Chrome against the dev server over the DevTools
protocol. Captures stay local; this README is the committed record.

## Stills

    <device>-<nn>-<what>.jpg

`desktop` is 1440x900 at 1.5x; `phone` is 375x812 at 2x with touch and
mobile emulation.

| # | Shows |
|---|---|
| 01, 02 | Loader counting, then ready with the two ways in |
| 03 | Compare, Gnat vs F-86: the Sabre Slayer note, stat bars, A and B tags |
| 04 | The picker open: searchable, grouped by era |
| 05 | F-15 vs VAJRA: dashed tracks and "not published" / "not flown", never a zero |
| 06, 07 | Phone, `?compare=side`: Gnat vs F-86, F-15 vs Su-27 |
| 08 | Phone, stacked (the default): F-15 vs Su-27 |
| 09 | Flyby mid-pass |
| 10 | Mid-morph, cloud kept clear of the title column and the note cards (fix 1) |

### Phone Compare: stacked or side by side

Stacked reads better at 375 wide, and is the default. Side by side, each
aircraft gets about a third of the width and shrinks to a thumbnail. Stacked,
each gets the full width of the band between the pickers and the stat bars,
and the difference in size is easier to see. `?compare=side` still shows the
other layout.

## Recordings

640x400, 15 fps, film grain off for the recording only.

| File | Shows |
|---|---|
| `loader.gif` | First visit: the count rising with real progress, the wing assembling, "Enter with sound" |
| `compare-switch.gif` | Gnat vs F-86, a suggested-pair chip to F-15 vs Su-27, then aircraft B to VAJRA from the picker |
| `thrust-with-sound.gif` | F-15, Engines view: sound on, thrust on and off |
| `flyby.gif` | Hold Space: turn, out of frame, the pass with the vapour cone, re-forming on the turntable |
| `flyby-reduced-motion.gif` | The same with `prefers-reduced-motion`: a calm pass, no shake, no boom |

## Sound

GIFs carry no audio. These are levels measured at the output, after the
limiter, with an `AnalyserNode` in the page. They come from headless Chrome,
so they are the signal's levels, not loudness at a speaker.

| Moment | Peak dBFS | RMS dB |
|---|---|---|
| Fade-in after "Enter with sound", first 1.5 s | -35 | -46 to -49 |
| Idle hum, settled (turbojet, Me 262) | -33 | -45 |
| Idle hum, settled (turbofan, F-15) | -34 | -45 |
| Thrust on, first 2 s | -14 | -25 to -29 |
| Full thrust, settled | -13 | -25 |
| Thrust off, first 2 s | -15 | falling to -38 |
| Morph whoosh, over idle | -33 | -44 |
| Boom, over full thrust | -12.5 | -23 |

What it sounds like:

- **Turbojets (Me 262 to MiG-23, and any other turbojet type):** a narrow,
  high roar band (950 Hz idle to 2.3 kHz at thrust) with a sawtooth whine
  on top (1.9 to 3.5 kHz). It is harsh and screaming.
- **Turbofans:** a broad, low roar (380 Hz to 950 Hz) and a soft triangle
  whine (0.7 to 1.35 kHz), with more rumble underneath. It is deeper and
  smoother.
- **Afterburning types:** a quarter more roar and rumble at full thrust.
- **Twin-engine types:** the two whine oscillators are detuned further apart,
  so they beat.
- **Thrust:** pitch, volume and rumble all ramp, with a time constant of
  about 0.65 s (about 2 s to settle).
- **Morph whoosh:** a soft band-passed rush, swept 320 Hz to 1.7 kHz and back.
- **Toolbar tick:** a 1.85 kHz blip, 60 ms long, with a 4 ms rise so it does
  not click.
- **Boom (flyby, sound on only):** two low thumps, 110 ms apart, low-passed
  from 260 Hz down to 60 Hz.

How it is kept quiet:

- Every level change is a ramp; nothing starts at full level.
- The master fades in over about a second.
- A limiter at -20 dB (12:1) sits in front of the output.
- Default is off. The audio context is created only inside a click: the
  loader button or the Sound chip. If sound was on earlier in the session,
  the chip shows on, and the engine starts at the visitor's first click or
  key.

## Frame cost

Two-second windows (2.5 s for switches, 3.6 s for the flyby), starting at the
input. CPU is main-thread time per frame, mean and worst frame. Long tasks
are any over 50 ms seen by a `PerformanceObserver`.

Hardware: Ryzen 7 7435HS, RTX 4050 Laptop GPU. Phone is 375x812 emulation
with the CPU throttled 4x, density 0.65, 1.5x. GPU times are given for
completeness only; they were unstable on this machine (see review/5).

| Case | Desktop CPU ms (worst) | Desktop GPU ms (worst) | Phone CPU ms (worst) | Phone long tasks |
|---|---|---|---|---|
| Compare, idle (Gnat / F-86) | 0.59 (1.2) | 2.7 (5.6) | 2.8 (4.1) | none |
| Compare, chip switch (F-15 / Su-27) | 0.67 (6.3) | 2.5 (6.3) | 3.5 (23.2) | none |
| Compare, picker switch (VAJRA) | 0.64 (2.8) | 3.0 (4.7) | 3.0 (10.2) | none |
| Leaving Compare (scroll up) | 0.53 (3.0) | 2.8 (5.0) | 2.6 (17.6) | one, 67 ms |
| Flyby (Su-27) | 1.00 (3.1) | 2.6 (4.6) | 3.7 (11.1) | none |

On the throttled phone, leaving Compare costs one 67 ms task, about 17 ms
unthrottled. Three things land in the same frame: the hangar's two
airframes are dropped, the stowed single airframe is restored, and the
next chapter's aircraft is built.

## Phase 5 fixes, verified

- **Morph cloud:** voxels in flight shrink away when their centre leaves the
  free area. On a wide screen that area is right of the title column and
  clear of the note cards; on a phone, between the placard and the notes.
  See still 10.
- **Placard and chapter text:** stepped through a transition in 4% steps of
  screen height on both devices. The placard clears completely before any
  text appears and comes back only after the text has gone. There is no
  step where both are visible.
