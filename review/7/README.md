# Phase 7 review: polish and ship

The captures come from headless Chrome over the DevTools protocol, against
the dev server and the production preview. They stay local; this README is
the committed record.

## First fix: the HAL Gnat's chapter

No change was needed. `gnat.ts` already had `chapter: 2` and
`generation: '2'`, from the 2c decision, and the app places it in chapter 2.
In the ribbon it is the fourth jet of group 02, after the MiG-21, F-104 and
Mirage III. `#ch2/gnat` opens in chapter 2, and the metadata reads "02
Second generation". When I flagged it as misplaced at the phase 6 sign-off, I
was wrong.

## Lighting

`lighting-{before,after,final}-<id>.jpg` shows the F-86, Su-27, F-22 and
VAJRA at the hero34 angle (`?gallery=<id>&view=hero34`).

| Light | Before | After |
|---|---|---|
| Hemisphere ambient | 1.02, ground `#9aa0a6` | 0.6, ground `#8e959c` |
| Key, warm, upper front left | 2.05 | 2.5 |
| Fill, cool, low right | 0.85 | 0.48 |
| Rim, cool, high behind (new) | none | 1.15 at (6, 9, -12) |
| Bounce from below | 0.45 | 0.34 |

The flatness came from the ambient. When the environment map was removed
from the skin, the ambient was raised to replace it, and it filled the gap
between the key side and the shadow side. Now the key-to-fill ratio carries
the form. The rim light catches the fin tops, the spine and the wing roots
facing away from the key. It is a plain directional light, so it brings
back no reflection and no blotches.

The `final` set is the shipped state. It also includes the backdrop
correction described under Contrast.

## Typography and spacing

I checked the chrome against the original visual direction and fixed these
inconsistencies:

1. **Three headline scales.** The placard, chapter and Compare titles each
   had their own `clamp()`. They now share `--t-display`; only the
   introduction is larger, with `--t-display-xl`.
2. **Label to headline gap.** The eyebrow and the chapter label used
   different clamps. Both now use `--space-label`.
3. **Headline to body gap.** The subtitle, chapter summary and Compare
   title used three different clamps. All three now use `--space-head`.
4. **Pill padding.** The pills had 1 px optical offsets (`7px 12px 6px`,
   `6px 11px 5px`, `3px 8px 2px`) that sat the mono labels low. The padding
   is now symmetric.
5. **Compare picker buttons.** They were shorter than the toolbar pills and
   had a transparent fill. They now have a 34 px minimum height,
   `8px 14px` padding, and the panel fill.
6. **Hard-coded radii.** The 12, 8, 7 and 6 px radii now use `--radius` and
   `--radius-sm`.
7. **X-ray part labels.** These were 9.5 px, the only off-scale size. They
   now use `--t-micro`.
8. **Chapter aircraft chips.** These used ink while the Compare chips used
   ink-2. Both now use ink-2.
9. **Concept tag and Compare "B" label.** These had white text on the
   bright accent, at 2.9:1. The text is now ink.
10. **Ribbon dimming.** The whole inactive group was dimmed, chapter
    numbers included. Now only the icons are dimmed.
11. **Footer hint and picker placeholder.** The hint was in ink-4, a colour
    for lines only. The placeholder used the browser's default grey. Both
    now use ink-3.
12. **Duplicate rule.** `chapters.css` had the closing-footer block twice.
    One copy is removed.

## Contrast

The first audit compared text colours with the page colour, `#e9eced`, and
passed. That check was wrong. The text sits over the canvas, and the canvas
did not show `#e9eced`.

The scene renders into a linear target. The final grain pass writes those
values to the screen without sRGB encoding, so the backdrop showed its
linear value, `#cfd5d7`. The 0.3 vignette then took the corners down to
about `#989b9e`. In the corners, where the metadata and footer sit, the
faint mono text was at 2.3–3.0:1. The same mismatch made the DOM scrims show
as bands across the top and bottom.

The palettes and lights are all tuned to the current output, so the colour
pipeline itself is unchanged. The fixes are:

- **Backdrop.** It is now specified in output terms, so the canvas shows
  `#e9eced`, the same as the page, the loader and the panels. The airframes
  are unchanged.
- **Vignette.** It is down from 0.3 to 0.12. The darkest corner is now
  about `#cfd2d2`.
- **Backdrop motes.** They fade out in the top and bottom bands, so a
  drifting block never sits behind the metadata, ribbon, toolbar or footer.
- **Scrims.** They show only while chapter text is on screen. Over an
  exhibit they read as bands.
- **Tokens.** The changes are listed below.

| Token | Was | Now | On page | Darkest corner |
|---|---|---|---|---|
| `--ink-3` (mono metadata, labels) | `#868e95` | `#52585d` | 6.1 | 4.7 |
| `--accent-ink` (country, key innovation, focus ring) | `#c74a14` | `#973a0f` | 6.0 | 4.7 |
| `--ink-4` | text in places | lines and marks only | — | — |
| Focus ring | `--accent`, 2.4:1 | `--accent-ink`, 6.0:1 | | |

### How it was measured

The page is screenshotted with every glyph made transparent. Then each text
box's background is sampled from that image. Both the median and the 10th
percentile are checked against 4.5:1, or 3:1 for large text. The audit
covered:

- **Views:** loader, cover, chapter text, exhibits, the VAJRA concept,
  Compare, Radar, X-ray, and the closing footer.
- **Devices:** desktop 1440×900 and phone 375×812.

Everything passes. The only remaining flags are:

- text hidden under the loader;
- a ribbon number scrolled outside the ribbon's clip;
- the radar label "shaped for stealth", which sits over the radar shells.
  Its median is 6.2:1, and its 10th percentile is 4.2:1 where the shells
  are behind it.

`polish-*.jpg` shows the result on desktop and phone: an exhibit, chapter
text, and the closing footer.

## Adaptive quality

This was tested on desktop with 30 ms of extra main-thread work per frame,
to stand in for a weak device:

| Time | Step | Density | Blocks (Su-27) | Grain | MSAA | DPR |
|---|---|---|---|---|---|---|
| 0 s | — | 1.0 | 10,518 | on | 4 | 1.5 |
| 2.4 s | 1 | 0.8 | 6,105 | off | 4 | 1.5 |
| 8.4 s | 2 | 0.65 | 3,916 | off | 0 | 1.5 |
| 14.4 s | 3 | 0.5 | 2,222 | off | 0 | 1 |

- **Trigger:** a frame interval above 24 ms, held for 2 s. After each
  step, a calm period lets the new level settle before the next check.
- **Each step:** builds the new density, then crossfades the model to it.
  There is no pop.
- **Pinning:** `?density=` pins the density and turns the ladder off.
- **WebKit:** in Playwright, it stepped down on its own.

## Compare exit stall

At phase 6, leaving Compare cost a long task of about 111 ms, measured in
this environment. Three things caused it:

- placard and notes were re-laid out from `display: none`;
- the stowed model was taken out of its stowed state before being dropped;
- the chapter navigation ran in the same task as the exit.

Now:

- the placard and notes are hidden with `visibility`;
- a stowed model is dropped directly;
- the navigation is deferred one task.

On a realistic scroll out of chapter 8 there is no task over 50 ms. An
instant jump from Compare to another chapter costs 64–70 ms, the same as any
instant chapter jump.

## Fallbacks

| Case | Result | Capture |
|---|---|---|
| No WebGL | Text edition: 7 chapters, 27 specification tables with notes, the disclaimer. No loader, no canvas. | `fallback-no-webgl.jpg` |
| Context lost | Overlay with "Reload the view", which takes focus, and the current aircraft's 12-row table. Restoring the context reloads at `#ch4/f-16`. | `fallback-context-lost.jpg` |
| Worker blocked | Builds run on the main thread. 12,628 blocks, all 27 ribbon icons. | `fallback-no-worker.jpg` |

## Browsers

`browser-<engine>-{1-loader,2-exhibit,3-morph,4-compare}.jpg`

| Engine | Build | Result |
|---|---|---|
| Chrome | System Chrome, ANGLE D3D11 | All four steps pass, no errors |
| Firefox | Playwright Firefox, WebGL 2 | All four steps pass, no errors. It has no `EXT_color_buffer_half_float`, but `EXT_color_buffer_float` covers it. |
| WebKit | Playwright WebKit on Windows | All four steps pass, no errors. It reports "Apple GPU", and adaptive quality stepped down. |

**Not tested:** real iOS Safari, macOS Safari, and any real phone.
Playwright's WebKit on Windows is not iOS Safari: its GPU, memory limits and
compositor all differ. I reviewed the iOS-specific risks in the code:

- WebGL 2 is required, and is in Safari from iOS 15.
- `inert` is used, and is in Safari from 15.5.
- `navigator.userActivation` has a fallback.
- Older Safari gets `webkitAudioContext`.
- `svh` units have a `vh` fallback.
- Context loss (iOS discards GPU contexts under memory pressure) leads to
  the reload path.

The first real-phone check should be a Vercel preview on an iPhone.

## Lighthouse

These are scores for the production build served by `vite preview`, using
Lighthouse 12 with its default throttling.

| | Performance | Accessibility | Best practices | SEO | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|---|
| Mobile | 59 | 100 | 100 | 100 | 2.4 s | 3.8 s | 1,710 ms | 0.009 |
| Desktop | 89 | 100 | 100 | 100 | 0.6 s | 0.8 s | 280 ms | 0.008 |

An earlier run of the same build scored 61 and 91. Most of the mobile total
blocking time is the WebGL frame loop and the first builds under 4× CPU
throttling. Lighthouse counts a continuously animating canvas as blocking
time. SEO went from 83 to 100 after adding the meta description, canonical
URL and `robots.txt`.

## Keyboard

This was a Tab-only run through the loader, every chapter, every mode, and
Compare.

- **Order:**
  1. skip link
  2. brand
  3. ribbon: one tab stop; the arrow keys, Home and End move inside it
  4. in Compare, the A and B pickers and the pair chips
  5. Inspect in 360
  6. the toolbar
  7. each chapter's aircraft buttons
- **Loader:** the two entry buttons are its only stops.
- **Chapter text:** it is no longer hidden with `visibility`, so its
  aircraft buttons stay in the tab order. They were unreachable before.
- **Focus visibility:**
  - Every stop shows a ring. None is off screen or covered: scroll padding
    keeps focused items clear of the top strip and the toolbar.
  - A focused ribbon button now shows at full opacity. Before, it was dimmed
    with its ring.
  - See `keyboard-1-ribbon.jpg` and `keyboard-2-toolbar.jpg`.

## Screen reader

This pass inspected the accessibility tree over the DevTools protocol. It
was not a session with NVDA or VoiceOver.

- Each chapter is a named region, and there are no unnamed controls.
- The exhibit title reads "Su-27 Flanker, exhibit 012". Before, the
  superscript read only as "exhibit number".
- Aircraft changes ("Su-27 Flanker, exhibit 012") and mode changes are
  announced through the chrome's polite live region. Compare pairs
  ("Comparing HAL Gnat and F-86 Sabre.") have their own region.
- Each specification table has a caption ("… specifications
  (approximate)") and row headers (`th scope="row"`).
- A figure that is not published is left out of the table, never shown as
  a blank cell or a zero. An aircraft that has not flown reads "Not flown".
  In Compare, missing figures read "not published" or "not flown".

Real screen-reader testing is still open.

## Copy

- **Cover:** reworded so that "first jets" and "1940s" no longer read as
  two separate claims.
- **Chapter 2:** "first air-intercept radars" is now "brought radar into
  single-seat fighters". Air-intercept radar predates the era.
- **Chapter 7:** now reads "none is in service, and none has flown in the
  form shown here". NGAD and GCAP demonstrator activity is public; the forms
  modelled are not.
- **F-86:** "supersonic-adjacent" is now "took the dogfight to the edge of
  the sound barrier".
- **F-104:** wing thickness corrected to "about three and a half per cent".
- **F-4:** "a cannon was fitted back into later versions" is now "the F-4E
  was given an internal cannon".
- **Me 262:** "ran for about ten hours" is now "often ran only about ten
  hours".
- **Mirage III:** the missing "and" is restored in the splitter-plate note.
- **NGAD:** "No official shape has been released" is now "Official artwork
  has shown little beyond the nose". Official artwork has shown the nose.

## Shipping

- **Meta tags:** description, canonical URL, Open Graph and Twitter card.
  The tags take absolute URLs from `VERCEL_PROJECT_PRODUCTION_URL`, or from
  `VITE_SITE_URL`. Without either, the canonical and `og:url` tags are left
  out rather than shipped empty.
- **`public/og.png`:** VAJRA at the hero angle, rendered from the site by
  `scripts/og.mjs` in headless Chrome. The pre-build step renders it only
  when it is missing, because build machines have no Chrome.
- **Favicon and touch icon:** `public/favicon.svg` is the plane mark in code,
  and `apple-touch-icon.png` is rendered from it.
- **Disclaimer:**
  - On desktops 1280 px and wider, the fixed footer carries a one-line form.
  - The closing "About this exhibit" section carries the full text at every
    size.
  - The text edition carries it too.
- **Debug code:** the production bundle contains no `__stats`, `__audio`,
  `__gallery`, `window.lab` or timing logs. The review views stay behind
  `__REVIEW__`.

## Housekeeping

- **C: drive full.** It had about 330 MB free. The Lighthouse install failed
  with ENOSPC partway through. I deleted only my own temporary files: the
  Playwright browsers, capture profiles, and one corrupted `npx` cache entry.
  The project is on D: and is unaffected. Clearing space on C: is worth
  doing before the next session.
- **OG script temp folders.** `scripts/og.mjs` left a 30 MB Chrome profile
  in the temp directory on every run. It now waits for Chrome to exit before
  removing the profile.
