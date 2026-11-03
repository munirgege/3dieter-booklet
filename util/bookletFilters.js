/**
 * Photo filters for the booklet. One filter is chosen per booklet and applied
 * to every photo — the on-page previews, the 3D preview and the files sent to
 * print — so what customers see is what gets printed.
 *
 * Each filter works on canvas pixels (`apply`) and has a CSS approximation
 * (`css`) for the live crop editor, which shows the untouched source image.
 */

const clampByte = v => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Tone curve: blend towards a smoothstep S-curve, then map into black..white. */
const toneCurve = ({ contrast, black, white }) => {
  const lut = new Float32Array(256);
  for (let i = 0; i < 256; i += 1) {
    const t = i / 255;
    const s = t * (1 - contrast) + contrast * t * t * (3 - 2 * t);
    lut[i] = black + s * (white - black);
  }
  return lut;
};

const luminance = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

const forEachPixel = (ctx, width, height, fn) => {
  const image = ctx.getImageData(0, 0, width, height);
  fn(image.data);
  ctx.putImageData(image, 0, 0);
};

// ---------------------------------------------------------------------------
// Warm — golden white balance, rich oranges and yellows, greens nudged towards
// olive, gentle contrast with slightly lifted blacks. Modelled on the GetGoing
// Bhutan reference shots.
// ---------------------------------------------------------------------------

const WARM = {
  contrast: 0.18,
  black: 0.035,
  white: 0.975,
  warmR: 0.045, // red added through the midtones
  warmG: 0.012,
  coolB: 0.05, // blue removed through the midtones
  highlightB: 0.02, // extra blue removed towards the highlights
  shadowB: 0.02, // a touch of blue kept in the deep shadows
  saturation: 1.04,
  warmSaturation: 0.12, // extra saturation for reds, oranges and yellows
  olive: 0.22 // how far pure greens are pulled towards yellow
};

let warmCurves;
const buildWarmCurves = () => {
  const base = toneCurve(WARM);
  const r = new Uint8ClampedArray(256);
  const g = new Uint8ClampedArray(256);
  const b = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i += 1) {
    const t = i / 255;
    const mid = Math.sin(Math.PI * t);
    r[i] = 255 * (base[i] + WARM.warmR * mid);
    g[i] = 255 * (base[i] + WARM.warmG * mid);
    b[i] =
      255 *
      (base[i] - WARM.coolB * mid - WARM.highlightB * t * t + WARM.shadowB * (1 - t) * (1 - t));
  }
  return { r, g, b };
};

const applyWarm = (ctx, width, height) => {
  if (!warmCurves) warmCurves = buildWarmCurves();
  const { r: cr, g: cg, b: cb } = warmCurves;
  forEachPixel(ctx, width, height, px => {
    for (let i = 0; i < px.length; i += 4) {
      let r = cr[px[i]];
      const g = cg[px[i + 1]];
      const b = cb[px[i + 2]];

      // Greens towards olive: only where green clearly dominates.
      const greenness = g - (r > b ? r : b);
      if (greenness > 0) r += (g - r) * WARM.olive * Math.min(1, greenness / 64);

      const lum = luminance(r, g, b);
      const warmth = r > b ? (r - b) / 255 : 0;
      const sat = WARM.saturation + WARM.warmSaturation * warmth;
      px[i] = lum + (r - lum) * sat;
      px[i + 1] = lum + (g - lum) * sat;
      px[i + 2] = lum + (b - lum) * sat;
    }
  });
};

// ---------------------------------------------------------------------------
// Movie — cinematic teal & orange: cool shadows, warm highlights, a little
// less saturation, firmer contrast and faded blacks.
// ---------------------------------------------------------------------------

const MOVIE = { contrast: 0.42, black: 0.06, white: 0.95, saturation: 0.8, split: 46 };

let movieCurve;
const applyMovie = (ctx, width, height) => {
  if (!movieCurve) movieCurve = toneCurve(MOVIE);
  forEachPixel(ctx, width, height, px => {
    for (let i = 0; i < px.length; i += 4) {
      let r = 255 * movieCurve[px[i]];
      let g = 255 * movieCurve[px[i + 1]];
      let b = 255 * movieCurve[px[i + 2]];

      const lum = luminance(r, g, b);
      const l = lum / 255;
      // Orange peaks in the upper midtones (skin) and fades out towards white.
      const hi = 4 * l * l * (1 - l);
      const lo = (1 - l) * (1 - l);
      r += MOVIE.split * (hi - 0.6 * lo);
      g += MOVIE.split * (0.3 * hi + 0.15 * lo);
      b += MOVIE.split * (0.75 * lo - hi);

      const lum2 = luminance(r, g, b);
      px[i] = clampByte(lum2 + (r - lum2) * MOVIE.saturation);
      px[i + 1] = clampByte(lum2 + (g - lum2) * MOVIE.saturation);
      px[i + 2] = clampByte(lum2 + (b - lum2) * MOVIE.saturation);
    }
  });
};

// ---------------------------------------------------------------------------
// Black & White — luminance with a gentle S-curve and slightly lifted blacks,
// so it prints rich rather than flat.
// ---------------------------------------------------------------------------

let bwCurve;
const applyBlackWhite = (ctx, width, height) => {
  if (!bwCurve) bwCurve = toneCurve({ contrast: 0.25, black: 0.03, white: 0.98 });
  forEachPixel(ctx, width, height, px => {
    for (let i = 0; i < px.length; i += 4) {
      const v = 255 * bwCurve[Math.round(luminance(px[i], px[i + 1], px[i + 2]))];
      px[i] = v;
      px[i + 1] = v;
      px[i + 2] = v;
    }
  });
};

// ---------------------------------------------------------------------------
// Vibrant — vibrance (boosts muted colours more than already-saturated ones,
// so skin doesn't turn orange) plus a little contrast.
// ---------------------------------------------------------------------------

const VIBRANT = { contrast: 0.15, black: 0, white: 1, vibrance: 0.5, saturation: 1.08 };

let vibrantCurve;
const applyVibrant = (ctx, width, height) => {
  if (!vibrantCurve) vibrantCurve = toneCurve(VIBRANT);
  forEachPixel(ctx, width, height, px => {
    for (let i = 0; i < px.length; i += 4) {
      const r = 255 * vibrantCurve[px[i]];
      const g = 255 * vibrantCurve[px[i + 1]];
      const b = 255 * vibrantCurve[px[i + 2]];

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const currentSat = max > 0 ? (max - min) / max : 0;
      const sat = VIBRANT.saturation + VIBRANT.vibrance * (1 - currentSat);
      const lum = luminance(r, g, b);
      px[i] = lum + (r - lum) * sat;
      px[i + 1] = lum + (g - lum) * sat;
      px[i + 2] = lum + (b - lum) * sat;
    }
  });
};

// ---------------------------------------------------------------------------

export const PHOTO_FILTERS = [
  { id: 'original', name: 'Original', apply: null, css: 'none' },
  {
    id: 'warm',
    name: 'Warm',
    apply: applyWarm,
    css: 'sepia(0.24) saturate(1.25) contrast(0.98) hue-rotate(-6deg)'
  },
  {
    id: 'movie',
    name: 'Movie',
    apply: applyMovie,
    css: 'contrast(1.1) saturate(0.82) sepia(0.12) hue-rotate(-12deg) brightness(0.98)'
  },
  {
    id: 'bw',
    name: 'Black & White',
    apply: applyBlackWhite,
    css: 'grayscale(1) contrast(1.1)'
  },
  {
    id: 'vibrant',
    name: 'Vibrant',
    apply: applyVibrant,
    css: 'saturate(1.4) contrast(1.06)'
  }
];

export const DEFAULT_PHOTO_FILTER = 'warm';

export const findPhotoFilter = id =>
  PHOTO_FILTERS.find(filter => filter.id === id) ||
  PHOTO_FILTERS.find(filter => filter.id === DEFAULT_PHOTO_FILTER);

/** Applies the filter to the pixels of `ctx` in place. */
export const applyPhotoFilter = (ctx, width, height, filterId) => {
  const filter = findPhotoFilter(filterId);
  if (filter.apply) filter.apply(ctx, width, height);
};
