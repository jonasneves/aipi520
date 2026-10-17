// Smoke test for docs/teach (Gradient descent, one biopsy at a time). Run: node test/smoke.mjs
// Runs the page's model (docs/teach/model.js) in Node, and checks that every number the page speaks or prints
// equals the computed value at its displayed precision, that the reader's guesses cannot reach the model, and that
// every narration clip, highlight, draw and dock resolves. The claims and how each is computed: docs/teach/sources.md.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const teach = resolve(root, 'docs/teach');
const page = readFileSync(resolve(teach, 'index.html'), 'utf8');

let failures = 0, passes = 0;
function assert(ok, msg) { if (ok) { passes++; return; } failures++; console.error(`  FAIL: ${msg}`); }
const eq = (got, want, msg) => assert(got === want, `${msg}: got ${got}, want ${want}`);
function section(name) { console.log(`── ${name}`); }

// ── The model, loaded the way the page loads it (classic scripts sharing one global scope)
const ctx = vm.createContext({ console, Math });
vm.runInContext(readFileSync(resolve(teach, 'model.js'), 'utf8'), ctx, { filename: 'model.js' });
vm.runInContext(readFileSync(resolve(teach, 'voice.js'), 'utf8'), ctx, { filename: 'voice.js' });
const M = vm.runInContext('({ DATA, MU, SD, ETA, N, X, Yv, ORDER, sig, Jof, accOf, flipOf, sgd, CASES, PATH, JPATH, PATHS, BEST, UPHILL, VOICE })', ctx);
const { DATA, MU, SD, ETA, N, X, Yv, ORDER, Jof, accOf, flipOf, sgd, CASES, PATH, JPATH, BEST, UPHILL, VOICE } = M;
const fx = (v, d) => v.toFixed(d);

section('Dataset');
eq(N, 569, 'biopsies');
eq(Yv.filter(y => y === 1).length, 212, 'malignant (y = 1)');
eq(Yv.filter(y => y === 0).length, 357, 'benign (y = 0)');
const mean = DATA.r.reduce((a, b) => a + b) / N, sd = Math.sqrt(DATA.r.reduce((a, r) => a + (r - mean) ** 2, 0) / N);
eq(fx(MU, 2), '14.13', 'average radius as printed');
eq(fx(SD, 2), '3.52', 'sd as printed');
assert(Math.abs(mean - MU) < 1e-3 && Math.abs(sd - SD) < 1e-3, 'MU and SD agree with the embedded radii (population sd)');
eq(X.filter(x => Math.abs(x) <= 1).length, 399, 'radii within one sd ("399")');
eq(fx(399 / N * 100, 0), '70', '"about 70%" within one sd');

section('Teaching order and the example biopsy');
eq(ORDER.length, N, 'ORDER covers every biopsy');
eq(new Set(ORDER).size, N, 'ORDER has no repeats');
eq(ORDER[45], 491, 'the confident miss is biopsy 46 in the order');
eq(fx(DATA.r[491], 2), '17.85', 'the example biopsy radius 17.85 (v01, ruler pin)');
eq(Yv[491], 0, 'the example biopsy is benign');
eq((X[491] >= 0 ? '+' : '') + fx(X[491], 2), '+1.06', 'its x̃ = +1.06');
eq(fx((14.13 - MU) / SD, 2), '0.00', 'the what-if biopsy at the average radius has x̃ = 0');

section('First footstep (rule card, case 0)');
const c0 = CASES[0];
eq(c0.p, 0.5, 'p = 0.50 at w = 0, b = 0');
eq(c0.call, 1, 'p = 0.50 is called malignant (cutoff p >= 0.5)');
eq(c0.y, 0, 'its report says benign');
eq(fx(c0.err, 2), '-0.50', 'y − p = −0.50');
eq(fx(c0.xt, 2), '-1.16', 'x̃ = −1.16');
eq(fx(c0.dw, 2), '0.29', 'Δw = +0.29');
eq(fx(c0.db, 2), '-0.25', 'Δb = −0.25');
eq(fx(0.5 * -0.5 * -1.16, 2), fx(c0.dw, 2), 'the printed product of the printed factors equals the computed Δw');
assert(c0.dw > 0, 'w goes up on the first footstep (the pW reveal)');
assert(c0.J1 < c0.J0, '"Here, one step downhill": the first footstep lowers J');

section('Guided footsteps');
eq(fx(CASES[1].p, 2), '0.56', '"Point five six" (w302)');
eq(CASES[1].call, CASES[1].y, '"and right" (w302)');
assert(CASES[1].len > 0, '"still a step" (w302)');
eq(CASES[2].call, CASES[2].y, '"Right again" (w84)');
assert(CASES[2].len < CASES[1].len, '"A smaller step" (w84)');
assert(CASES[44].p > 0.999 && CASES[44].y === 1, '"Very sure, and right" (w212)');
assert(CASES[44].len < 0.05 && CASES[44].len > 0, '"it barely moved": tiny, not zero (g16, tiny question)');
eq(fx(CASES[45].p * 100, 0), '92', '"Ninety-two percent sure" (w491)');
eq(CASES[45].call, 1, '"malignant" (w491)');
eq(fx(flipOf(...PATH[45]), 2), '14.67', '"from fourteen point six seven" (g18)');
eq(fx(flipOf(...PATH[46]), 2), '15.51', '"to fifteen point five one" (g18)');
assert(CASES[45].L1 < CASES[45].L, '"Its own surprise fell" (jUp)');
assert(CASES[45].dJ > 0, '"But the average rose" (jUp)');
eq(fx(CASES[45].J0, 4) + '→' + fx(CASES[45].J1, 4), '0.3015→0.3171', 'J across the confident miss');
assert(CASES[45].len === Math.max(...CASES.slice(0, 46).map(c => c.len)), '"A confident miss takes the longest stride" (wIns) among footsteps so far');

section('Uphill steps');
eq(UPHILL, 288, 'footsteps that raise J');
assert(Math.abs(UPHILL / N - 0.5) < 0.05, '"About half of them go uphill" (w0)');
eq(CASES.filter(c => c.dJ > 0).length, 288, 'uphill count recomputed');
assert(CASES.slice(0, 44).some(c => c.dJ > 0), 'uphill steps are visible in the first 44 footsteps');
eq(JPATH.length, N + 1, 'J after each footstep');

section('End of the pass');
eq(fx(flipOf(...PATH[N]), 2), '14.83', '"fourteen point eight three" (done)');
eq(fx(accOf(...PATH[N]) * 100, 1), '88.2', '"eighty-eight point two percent" (done)');
eq(fx(BEST.b, 2), '-0.64', '"b held at its best value, −0.64" (count scene)');
assert(Math.abs(flipOf(...PATH[N]) - flipOf(BEST.w, BEST.b)) < 0.1, '"Full-batch gradient descent lands almost exactly there" (done): flip radii within 0.1');
eq(fx(accOf(0, 0) * 100, 1), '37.3', 'all-zero model calls everything malignant: 212 / 569 right');

section('Rescale detour');
function curvatureRatio(xs, w, b) { let a = 0, m = 0, c = 0; for (let i = 0; i < N; i++) { const p = 1 / (1 + Math.exp(-(w * xs[i] + b))), s = p * (1 - p); a += s * xs[i] * xs[i]; m += s * xs[i]; c += s; } const tr = (a + c) / N, det = (a * c - m * m) / N / N, r = Math.sqrt(tr * tr / 4 - det); return (tr / 2 + r) / (tr / 2 - r); }
const kStd = curvatureRatio(X, BEST.w, BEST.b), kRaw = curvatureRatio(DATA.r, BEST.w / SD, BEST.b - BEST.w * MU / SD);
eq(fx(kStd, 1), '5.5', 'curvature ratio, standardized ("5.5")');
eq(fx(Math.sqrt(kStd), 1), '2.3', 'contour aspect, standardized ("2.3")');
assert(Math.abs(kRaw / 18000 - 1) < 0.05, `curvature ratio, raw radii ("about 18,000"): ${kRaw.toFixed(0)}`);
assert(Math.abs(Math.sqrt(kRaw) / 135 - 1) < 0.02, `contour aspect, raw radii ("about 135"): ${Math.sqrt(kRaw).toFixed(1)}`);

section('Negative weights');
eq(fx(flipOf(-2, 1), 4), fx(MU - 1 / -2 * SD, 4), 'flipOf handles w < 0');
assert(Number.isNaN(flipOf(0, 1)), 'flipOf has no crossing at w = 0');

section('The reader cannot change the model');
for (const [name, v] of Object.entries({ CASES, PATH, JPATH, BEST, ORDER })) assert(Object.isFrozen(v) && Object.isFrozen(v[0] ?? v), `${name} is frozen`);
const again = sgd(ETA);
assert(again.P.every((p, k) => p[0] === PATH[k][0] && p[1] === PATH[k][1]), 'a fresh run reproduces the baseline path exactly');
assert(!/GUESSES|guess/i.test(readFileSync(resolve(teach, 'model.js'), 'utf8').replace(/\/\/.*$/gm, '')), 'model.js never reads a guess');
const guessFn = page.slice(page.indexOf('function guess('), page.indexOf('\n}', page.indexOf('function guess(')));
assert(guessFn.length > 20, 'found function guess');
assert(!/\b(CASES|PATH|JPATH|knob|sgd|BEST)\b\s*(\[[^\]]*\])?(\.\w+)?\s*(=[^=]|\.push)|w\.n\s*=/.test(guessFn), 'guess() writes only GUESSES (and moves on)');
assert(!/\b(CASES|PATH|JPATH|ORDER|BEST)\s*(\[[^\]]*\])*(\.\w+)?\s*=[^=>]/.test(page), 'the page never assigns into the model');

section('Narration');
const audio = resolve(teach, 'audio');
const mp3 = new Set(readdirSync(audio).filter(f => f.endsWith('.mp3')).map(f => f.slice(0, -4)));
for (const id of Object.keys(VOICE)) assert(mp3.has(id), `clip ${id} has audio/${id}.mp3`);
for (const id of mp3) assert(VOICE[id], `audio/${id}.mp3 has a VOICE entry`);
// Every clip a step can play: quoted ids inside the step definitions (GUIDED, the free-play reactions, the end).
const steps = page.slice(page.indexOf('const GUIDED = ['), page.indexOf('\n', page.indexOf('const doneStep')));
const used = new Set(Object.keys(VOICE).filter(id => steps.includes(`'${id}'`)));
for (const id of used) assert(VOICE[id], `step clip ${id} exists in VOICE`);
for (const id of Object.keys(VOICE)) assert(used.has(id), `VOICE clip ${id} is used by a step`);
const REFS = JSON.parse(page.match(/const REFS = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
const HOME = page.match(/const HOME = \{([^}]*)\}/)[1];
for (const [id, V] of Object.entries(VOICE)) {
  for (const [a, b, ref] of V.h) { assert(REFS.includes(ref), `${id}: highlight ref "${ref}" is in REFS`); assert(a <= V.d && b <= V.d && a <= b, `${id}: highlight ${ref} inside the clip`); assert(new RegExp(`data-ref(="|': ')[^"']*\\b${ref}\\b`).test(page) || page.includes(`'${ref}'`) || page.includes(`r-${ref}}`), `${id}: some element carries data-ref "${ref}"`); }
  for (const [t, item] of V.D) { assert(t <= V.d, `${id}: draw ${item} inside the clip`); assert(page.includes(`'${item}'`) || page.includes(`"${item}"`), `${id}: draw target ${item} exists`); }
  for (const [t, dock] of V.K) { assert(t <= V.d, `${id}: dock ${dock} inside the clip`); assert(new RegExp(`\\b${dock}: '`).test(HOME), `${id}: dock ${dock} has a HOME`); assert(page.includes(`'dock:${dock}'`), `${id}: dock ${dock} has a mutation`); }
  if (V.c !== undefined) assert(V.c <= V.d, `${id}: cue inside the clip`);
  for (const [t] of V.s) assert(t <= V.d, `${id}: caption sentence starts inside the clip`);
}

section('Voice sources');
const script = JSON.parse(readFileSync(resolve(root, 'tools/voice/script.json'), 'utf8'));
eq(Object.keys(script).sort().join(), Object.keys(VOICE).sort().join(), 'script.json and VOICE list the same clips');
for (const [id, src] of Object.entries(script)) {
  const al = resolve(root, `tools/voice/align/${id}.align.json`);
  if (!existsSync(al)) { assert(false, `${id} has an alignment`); continue; }
  const text = JSON.parse(readFileSync(al, 'utf8')).text;
  eq(src.replace(/\{[^}]*\}|\|/g, '').trim(), text, `${id}: source text matches the alignment the audio was made from`);
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
