#!/usr/bin/env node
/**
 * Converts a painting to the ASCII the landing renders.
 *
 * The output of this script is what `AsciiField` loads: a plain text file of
 * `--cols` characters per line, drawn from the ramp below. Nothing about the
 * conversion happens in the browser — see the note at the top of
 * `src/components/landing/ascii-field.tsx` for why the live version was
 * abandoned. In short: being free of a frame budget is what lets this pass be
 * expensive enough to produce something legible.
 *
 * ── Usage ───────────────────────────────────────────────────────────────────
 *
 *   node scripts/ascii-painting.mjs <source.jpg> <out.txt> [options]
 *
 *     --cols <n>        Characters per line. Default 400.
 *     --rows <n>        Lines. Default: derived from the source aspect.
 *     --crop <W:H:X:Y>  Crop the source first, in source pixels.
 *     --preview         Print to stdout instead of writing the file.
 *
 * Requires `ffmpeg` on PATH; it is only used to decode and resample, so any
 * build will do.
 *
 * ── Why the parameters are what they are ────────────────────────────────────
 *
 * These were arrived at by comparing four variants side by side against The
 * Last Supper, and two of the findings are worth keeping in mind before
 * changing anything:
 *
 * **Short ramps beat long ones.** The canonical 70-character ASCII ramp is not
 * ordered by ink coverage in any real font, so a tone gradient walked along it
 * renders as noise. Thirteen characters that genuinely ascend in weight read as
 * shading; seventy that only roughly do read as static.
 *
 * **Tone or edges, never both.** An edge-detection pass laid over tone looks
 * like a good idea and produces a mess: the edges land half a cell away from
 * the tone step they belong to and the picture acquires a second, contradictory
 * outline. This pass is tone only.
 *
 * The local contrast is the other essential piece. A fresco this dim has
 * nothing left after a global stretch — the bright windows eat the whole range
 * and every figure lands in the bottom two levels of the ramp. Tiles restore
 * the figures. The clip ceiling is what stops the same tiles turning a flat
 * wall into static: without it, a tile containing nothing but plaster stretches
 * its own tiny tonal range across the entire ramp.
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

/** Index here means ink, and the component reads it back to pick a colour. */
const RAMP = ' .`:;+*oOX#%@';

/**
 * A monospace cell is about 0.6 as wide as it is tall, so a square of picture
 * needs roughly 1.67 times as many columns as rows to come out square. Getting
 * this wrong is the single most obvious failure mode: the painting arrives
 * stretched or squashed and no amount of tuning the tone will save it.
 */
const CELL_ASPECT = 0.6;

/**
 * Samples per cell, per axis. Three means each character is decided by nine
 * source pixels rather than one, which is the difference between a smooth
 * gradient and a dithered one.
 */
const SUPERSAMPLE = 3;

/** Contrast tiles across and down. Big on purpose — see the note above. */
const TILES_X = 6;
const TILES_Y = 3;

/** Minimum tonal range a tile may stretch, in 0-255. The clip ceiling. */
const CLIP = 70;

/** How far to blend from the global stretch toward the per-tile one. */
const STRENGTH = 0.7;

/** Below 1 lifts the midtones, which the ramp needs to use its middle. */
const GAMMA = 0.85;

/**
 * Everything is checked here, before a frame is decoded.
 *
 * The conversion is the better part of a minute of ffmpeg, and every one of
 * these mistakes used to be found afterwards: a missing destination surfaced as
 * `writeFileSync(undefined)` at the very end, and `--cols` given last, or
 * followed by another flag, passed `NaN` down to ffmpeg and came back as a
 * filter error naming nothing the caller had typed.
 */
function parseArgs(argv) {
  const [source, out] = argv.filter((a) => !a.startsWith('--'));

  const die = (message) => {
    console.error(message);
    process.exit(1);
  };

  const flag = (name) => {
    const at = argv.indexOf(`--${name}`);
    if (at === -1) return undefined;
    const value = argv[at + 1];
    // A flag's value is the next token, so the next token being another flag
    // means the value is missing rather than being `--preview`.
    if (value === undefined || value.startsWith('--')) {
      die(`--${name} takes a value`);
    }
    return value;
  };

  const number = (name, fallback) => {
    const raw = flag(name);
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      die(`--${name} takes a positive number, got ${raw}`);
    }
    return value;
  };

  const preview = argv.includes('--preview');
  // `--preview` writes to stdout, so it is the one mode with no destination.
  if (!source || (!out && !preview)) {
    die('usage: ascii-painting.mjs <source> <out.txt> [--cols n]');
  }

  return {
    source,
    out,
    cols: number('cols', 400),
    rows: number('rows', undefined),
    crop: flag('crop'),
    preview,
  };
}

/** Source dimensions, so rows can be derived rather than guessed. */
function probe(source) {
  const csv = execFileSync(
    'ffprobe',
    // biome-ignore format: reads better as one argument list
    ['-v', 'error', '-select_streams', 'v', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', source],
    { encoding: 'utf8' },
  ).trim();
  const [width, height] = csv.split(',').map(Number);
  return { width, height };
}

/**
 * Decodes to 8-bit grey at exactly `cols * SUPERSAMPLE` by `rows *
 * SUPERSAMPLE`. ffmpeg's own scaler does the area averaging, which is both
 * better and faster than doing it here from a full-resolution buffer.
 */
function decode(source, crop, cols, rows) {
  const filters = [];
  if (crop) filters.push(`crop=${crop}`);
  filters.push('format=gray');
  filters.push(`scale=${cols * SUPERSAMPLE}:${rows * SUPERSAMPLE}`);

  return execFileSync(
    'ffmpeg',
    // biome-ignore format: reads better as one argument list
    ['-v', 'error', '-i', source, '-vf', filters.join(','), '-f', 'rawvideo', '-pix_fmt', 'gray', '-'],
    { maxBuffer: 1 << 28 },
  );
}

/** Mean of each cell's supersampled block. */
function toCells(pixels, cols, rows) {
  const stride = cols * SUPERSAMPLE;
  const tone = new Float32Array(cols * rows);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      let sum = 0;
      for (let j = 0; j < SUPERSAMPLE; j++) {
        for (let i = 0; i < SUPERSAMPLE; i++) {
          sum += pixels[(cy * SUPERSAMPLE + j) * stride + cx * SUPERSAMPLE + i];
        }
      }
      tone[cy * cols + cx] = sum / (SUPERSAMPLE * SUPERSAMPLE);
    }
  }
  return tone;
}

/**
 * Clip-limited local contrast.
 *
 * Each tile gets its own 2nd/98th percentile window, widened to at least `CLIP`
 * so an empty tile cannot amplify its own noise. The per-cell window is then
 * bilinearly interpolated between tile centres, because using each tile's
 * window unblended puts a visible seam along every tile boundary — and a hard
 * rule across the picture is exactly what a page made of ruled lines must not
 * grow by accident.
 */
function localContrast(tone, cols, rows) {
  const lo = new Float32Array(TILES_X * TILES_Y);
  const hi = new Float32Array(TILES_X * TILES_Y);

  for (let ty = 0; ty < TILES_Y; ty++) {
    for (let tx = 0; tx < TILES_X; tx++) {
      const x0 = Math.floor((tx * cols) / TILES_X);
      const x1 = Math.floor(((tx + 1) * cols) / TILES_X);
      const y0 = Math.floor((ty * rows) / TILES_Y);
      const y1 = Math.floor(((ty + 1) * rows) / TILES_Y);

      const values = [];
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) values.push(tone[y * cols + x]);
      }
      values.sort((a, b) => a - b);

      const at = (p) =>
        values[
          Math.max(
            0,
            Math.min(values.length - 1, Math.floor(p * values.length)),
          )
        ];
      let low = at(0.02);
      let high = at(0.98);
      if (high - low < CLIP) {
        const mid = (low + high) / 2;
        low = mid - CLIP / 2;
        high = mid + CLIP / 2;
      }
      lo[ty * TILES_X + tx] = low;
      hi[ty * TILES_X + tx] = high;
    }
  }

  const sample = (grid, fx, fy) => {
    const gx = Math.min(TILES_X - 1, Math.max(0, fx * TILES_X - 0.5));
    const gy = Math.min(TILES_Y - 1, Math.max(0, fy * TILES_Y - 0.5));
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const x1 = Math.min(TILES_X - 1, x0 + 1);
    const y1 = Math.min(TILES_Y - 1, y0 + 1);
    const ax = gx - x0;
    const ay = gy - y0;
    return (
      grid[y0 * TILES_X + x0] * (1 - ax) * (1 - ay) +
      grid[y0 * TILES_X + x1] * ax * (1 - ay) +
      grid[y1 * TILES_X + x0] * (1 - ax) * ay +
      grid[y1 * TILES_X + x1] * ax * ay
    );
  };

  const sorted = Array.from(tone).sort((a, b) => a - b);
  const globalLo = sorted[Math.floor(0.01 * sorted.length)];
  const globalHi = sorted[Math.floor(0.99 * sorted.length)];

  const out = new Float32Array(cols * rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const l = sample(lo, (x + 0.5) / cols, (y + 0.5) / rows);
      const h = sample(hi, (x + 0.5) / cols, (y + 0.5) / rows);
      const L = globalLo + (l - globalLo) * STRENGTH;
      const H = globalHi + (h - globalHi) * STRENGTH;
      const v = (tone[y * cols + x] - L) / Math.max(1, H - L);
      out[y * cols + x] = v < 0 ? 0 : v > 1 ? 1 : v;
    }
  }
  return out;
}

function toText(values, cols, rows) {
  let out = '';
  for (let y = 0; y < rows; y++) {
    let line = '';
    for (let x = 0; x < cols; x++) {
      const v = values[y * cols + x] ** GAMMA;
      line += RAMP[Math.min(RAMP.length - 1, (v * RAMP.length) | 0)];
    }
    out += `${line}\n`;
  }
  return out;
}

/**
 * Mean ink per row, as ramp indices.
 *
 * Printed alongside the result because it is how the Last Supper's crop was
 * chosen. A painting in one-point perspective has near-perfect horizontals in
 * it, and one of those landing inside the band reads as a seam rather than as a
 * table — a hard rule across the whole viewport, which on this page looks
 * exactly like a layout bug. A row where this number falls off a cliff is a
 * candidate for cropping to.
 */
function inkProfile(values, cols, rows) {
  const profile = [];
  for (let y = 0; y < rows; y++) {
    let sum = 0;
    for (let x = 0; x < cols; x++) {
      sum += (values[y * cols + x] ** GAMMA * RAMP.length) | 0;
    }
    profile.push(sum / cols);
  }
  return profile;
}

const {
  source,
  out,
  cols,
  rows: forcedRows,
  crop,
  preview,
} = parseArgs(process.argv.slice(2));

const { width, height } = probe(source);
// A crop changes the aspect the rows have to be derived from.
const [cropW, cropH] = crop ? crop.split(':').map(Number) : [width, height];
const rows = forcedRows ?? Math.round((cols * CELL_ASPECT * cropH) / cropW);

const pixels = decode(source, crop, cols, rows);
const values = localContrast(toCells(pixels, cols, rows), cols, rows);
const text = toText(values, cols, rows);

if (preview) {
  process.stdout.write(text);
} else {
  writeFileSync(out, text);
  const bytes = Buffer.byteLength(text);
  const profile = inkProfile(values, cols, rows);
  const steps = profile
    .map((v, i) => ({ i, drop: i > 0 ? profile[i - 1] - v : 0 }))
    .sort((a, b) => b.drop - a.drop)
    .slice(0, 3)
    .map((s) => `row ${s.i} (-${s.drop.toFixed(1)})`);

  console.error(
    `${out}  ${cols}x${rows}  ${(bytes / 1024).toFixed(1)}KB raw\n` +
      `  sharpest horizontal steps: ${steps.join(', ')}`,
  );
}
