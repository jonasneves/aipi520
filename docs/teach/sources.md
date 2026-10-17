# Sources: Gradient descent, one biopsy at a time

Every number the page speaks or prints, and how it is computed. `test/smoke.mjs` (`make test`) asserts each row marked ✓ against `model.js`, so a change to the data, the order or the step size that moves a spoken number fails the test instead of leaving the audio wrong.

## Dataset

| Fact | Source | Check |
|---|---|---|
| 569 biopsies, 212 malignant, 357 benign | Wisconsin Diagnostic Breast Cancer, as shipped in scikit-learn (`sklearn.datasets.load_breast_cancer`); UCI ML Repository, Wolberg, Street and Mangasarian (1995) | ✓ |
| Feature: mean radius, the mean over the nuclei in the image of each nucleus's mean distance from center to edge | dataset description (`load_breast_cancer().DESCR`) | text |
| Here `y = 1` is malignant. scikit-learn's target codes malignant as 0: `target_names = ['malignant', 'benign']` | checked with scikit-learn on 2026-10-16 | datanote |
| Average radius 14.13, sd 3.52 (population sd, `np.std`), from the 569 radii | `model.js` `MU`, `SD`; the embedded radii are rounded to 2 decimals and agree to 1e-3 | ✓ |
| 399 of 569 radii (about 70%) lie within one sd | count of `|x̃| ≤ 1` | ✓ |

## The model

| Quantity | Computed as |
|---|---|
| x̃ | `(radius − 14.127) / 3.521` |
| z, p | `z = w·x̃ + b`, `p = 1 / (1 + e^(−z))` |
| The call | malignant when `p ≥ 0.5`; so p = 0.50, the all-zero model, is called malignant |
| L (surprise, one case) | `−ln(p)` if malignant, `−ln(1 − p)` if benign |
| J (average surprise) | mean of L over all 569 |
| Flip radius | the radius where z = 0: `14.127 − b/w · 3.521` (w ≠ 0; with w < 0 the malignant side is below it) |
| One footstep | `w ← w + η(y − p)x̃`, `b ← b + η(y − p)`, η = 0.5, from the pathology label y; the update rule is given, not derived |
| Order | four warm-up cases (indices 425, 302, 84, 0), 40 from a seeded shuffle (`rng(5)`), the two contrast cases (212, 491), then the rest |
| Bottom of the valley | full-batch gradient descent on all 569, 1500 iterations at step 1.5, from (0, 0): w = 3.639, b = −0.644 |

The reader's guesses are stored in `GUESSES` for display and nothing that computes a step reads them; `CASES`, `PATH` and `JPATH` are frozen.

## Numbers on the page

| Where | Number | Computed as | Check |
|---|---|---|---|
| v01, ruler | example biopsy radius 17.85, x̃ = +1.06, benign | biopsy 491 (46th in the order) | ✓ |
| Count scene | "b held at its best value, −0.64" | `BEST.b` | ✓ |
| First ask | p = 0.50, called malignant; report benign | `CASES[0]` at w = b = 0 | ✓ |
| Rule card | y − p = −0.50, x̃ = −1.16, η = 0.5, Δw = +0.29, Δb = −0.25 | `CASES[0]`, printed from the computed values | ✓ |
| What-if card | a biopsy at exactly 14.13 has x̃ = 0, so Δw = 0 | definition of x̃ | ✓ |
| v09b | "one step downhill" | J 0.693 → 0.577 on the first footstep | ✓ |
| w302 | "Point five six, and right … still a step" | `CASES[1]`: p = 0.560, call = y, step 0.432 | ✓ |
| w84 | "Right again. A smaller step." | `CASES[2]`: call = y, step 0.230 < 0.432 | ✓ |
| w0 | "Some even go uphill" | uphill steps occur among the first 44 | ✓ |
| w212, g16 | "Very sure, and right … it barely moved" | `CASES[44]`: p > 0.999, step 0.00006 (tiny, not zero) | ✓ |
| w491 | "Ninety-two percent sure: malignant. The report says benign." | `CASES[45]`: p = 0.921, y = 0 | ✓ |
| g18 | flip point 14.67 → 15.51 | `flipOf(PATH[45])`, `flipOf(PATH[46])` | ✓ |
| jUp, step card | its surprise L 2.54 → 1.69; average J 0.3015 → 0.3171 | `CASES[45].L`, `.L1`, `.J0`, `.J1` | ✓ |
| wIns | the confident miss takes the longest stride so far (0.670 against 0.00006) | step lengths `hypot(Δw, Δb)` | ✓ |
| Map, J strip | 288 of 569 footsteps raise J | count of `JPATH[k+1] > JPATH[k]` | ✓ |
| done | flip radius 14.83, 88.2% right (on the 569 it learned from) | `PATH[569]` | ✓ |
| done | "Full-batch gradient descent lands almost exactly there": flip radius 14.75, 87.9%, J = 0.290 | `BEST`; flip radii within 0.1 | ✓ |
| Rescale detour | walls about 18,000 times steeper than the floor with raw radii, 5.5 standardized; contours about 135 and 2.3 times longer than wide | eigenvalue ratio of the Hessian of J at the bottom, `mean p(1−p)[x 1][x 1]ᵀ`, in raw and standardized radius; the aspect is its square root (18,309 → 135.3; 5.49 → 2.34) | ✓ |
| Fog step | thin arrows: directions of eight single-biopsy steps from (0, 0); thick: the direction of their average over all 569 | the average of `η(y − p)(x̃, 1)` over the 569 is −η times the slope of J, the full-batch downhill | text |
| ln detour | each halving of the probability given to the truth adds 0.69 | ln 2 = 0.693 | text |

## Free-play reactions

A reaction clip is picked by |y − p|: under 0.1 ("Barely moved"), under 0.5 ("Small nudge"), under 0.75 ("A medium step", "Wrong call"), else ("Big one!", "Wrong, and confident"). On the 523 free-play cases these buckets order the step lengths closely: under 0.1 the steps are at most 0.066 long, 0.1–0.5 run 0.053–0.257, 0.5–0.75 run 0.256–0.424, and from 0.75 up at least 0.380.

## Narration

Voice: ElevenLabs, voice Liam (`TX3LPaxmHKxFdv7VOQHJ`), model `eleven_v4`, pre-generated; no speech is synthesized in the browser. Sources with highlight, draw, dock and cue markers are in `tools/voice/script.json`; `tools/voice/build.py` writes `voice.js` from them and the per-character alignments; `tools/voice/cut.py` splits a clip in a pause without re-encoding. Takes are checked with OpenAI whisper-1 (`tools/voice/check.py`), which hears a lone "w" as "we", so `gen.py` sends it as "W".
