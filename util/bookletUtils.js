import { applyPhotoFilter } from './bookletFilters';
import {
  BOOKLET_DIMENSIONS,
  COVER_TEXT_ALLOWED,
  COVER_TEXT_LIMITS,
  DPI_MINIMUM,
  DPI_SHARP,
  PHOTO_ASPECT,
  PRINT_LONG_SIDE_CM,
  PREVIEW_MAX_PX,
  findBookletColor,
  findBookletFont,
  findBookletTextColor
} from '../data/bookletData';

const GETGOING_LOGO_URL = '/content/img/logo/whitelogo.png';

/** Strips characters the printer can't render and enforces the length limit. */
export const sanitizeCoverText = (value, field) =>
  String(value || '')
    .replace(COVER_TEXT_ALLOWED, '')
    .replace(/\s{2,}/g, ' ')
    .slice(0, COVER_TEXT_LIMITS[field]);

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

export const loadImage = src =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Gambar gagal dimuat'));
    image.src = src;
  });

/** Reads a picked file into an object URL plus its pixel size. */
export const readPhotoFile = async file => {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(sourceUrl);
    return {
      sourceUrl,
      width: image.naturalWidth,
      height: image.naturalHeight
    };
  } catch (error) {
    URL.revokeObjectURL(sourceUrl);
    throw error;
  }
};

/** The largest centred 2:3 crop of an image, in source pixels. */
export const getDefaultCrop = (width, height) => {
  const cropWidth = Math.min(width, height * PHOTO_ASPECT);
  const cropHeight = cropWidth / PHOTO_ASPECT;
  return {
    x: Math.round((width - cropWidth) / 2),
    y: Math.round((height - cropHeight) / 2),
    width: Math.round(cropWidth),
    height: Math.round(cropHeight)
  };
};

/** Print resolution a crop gives on the booklet's long photo side. */
export const getCropDpi = crop => {
  if (!crop) return 0;
  const longSidePx = Math.max(crop.width, crop.height);
  return Math.round(longSidePx / (PRINT_LONG_SIDE_CM / 2.54));
};

export const getDpiStatus = dpi => {
  if (dpi >= DPI_SHARP) return { level: 'sharp', label: 'Tajam' };
  if (dpi >= DPI_MINIMUM) return { level: 'ok', label: 'Cukup tajam' };
  return { level: 'low', label: 'Resolusi rendah' };
};

/** Minimum crop size (px) that still prints at DPI_MINIMUM. */
export const getMinimumCropPx = () => {
  const longSide = Math.ceil((PRINT_LONG_SIDE_CM / 2.54) * DPI_MINIMUM);
  return { width: Math.ceil(longSide * PHOTO_ASPECT), height: longSide };
};

const canvasToBlob = (canvas, type = 'image/jpeg', quality = 0.92) =>
  new Promise((resolve, reject) =>
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('Gagal memproses foto'))),
      type,
      quality
    )
  );

/**
 * Renders `crop` of the source image into a JPEG no longer than `maxPx`,
 * with the booklet's photo filter applied.
 */
export const renderCrop = async (
  sourceUrl,
  crop,
  maxPx,
  quality = 0.92,
  filterId = 'original'
) => {
  const image = await loadImage(sourceUrl);
  const scale = Math.min(1, maxPx / Math.max(crop.width, crop.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(crop.width * scale);
  canvas.height = Math.round(crop.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height
  );
  applyPhotoFilter(ctx, canvas.width, canvas.height, filterId);
  return canvasToBlob(canvas, 'image/jpeg', quality);
};

/** Small cropped copy for the on-page grid and the 3D textures. */
/**
 * Small unfiltered copy of a crop. Filter previews are graded from it, so a
 * filter change never has to decode the full-size originals again.
 */
export const renderPreview = async (sourceUrl, crop) =>
  URL.createObjectURL(await renderCrop(sourceUrl, crop, PREVIEW_MAX_PX, 0.9));

/** `rawUrl` (an unfiltered preview) with the filter applied, as an object URL. */
export const renderFilteredPreview = async (rawUrl, filterId, maxPx = PREVIEW_MAX_PX) => {
  const image = await loadImage(rawUrl);
  const scale = Math.min(1, maxPx / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  applyPhotoFilter(ctx, canvas.width, canvas.height, filterId);
  return URL.createObjectURL(await canvasToBlob(canvas, 'image/jpeg', 0.85));
};

// ---------------------------------------------------------------------------
// Cover artwork — shared by the 2D preview, the 3D textures and the order proof
// ---------------------------------------------------------------------------

export const ensureBookletFont = async font => {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await document.fonts.load(`${font.weight} 64px "${font.family}"`);
  } catch (error) {
    console.error('Font sampul gagal dimuat', error);
  }
};

const fitFontSize = (ctx, text, font, maxSize, maxWidth) => {
  let size = maxSize * (font.scale || 1);
  ctx.font = `${font.weight} ${size}px "${font.family}"`;
  const width = ctx.measureText(text).width;
  if (width > maxWidth) size = Math.floor((size * maxWidth) / width);
  return size;
};

/**
 * Draws the front cover as it reads when the booklet stands on its spine:
 * a landscape face, spine edge at the bottom. Layout follows the sample
 * booklet — title about a third down, subtitle under it, three cut grooves
 * across the lower part. `details` adds the physical cuts (the gap around
 * the inlaid letters and the grooves); the print proof leaves them out.
 */
export const drawFrontCover = (
  canvas,
  design,
  { background = true, details = true } = {}
) => {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const font = findBookletFont(design.fontId);
  const color = findBookletColor(design.colorId);
  const ink = findBookletTextColor(design);

  ctx.clearRect(0, 0, width, height);
  if (background) {
    ctx.fillStyle = color.hex;
    ctx.fillRect(0, 0, width, height);
  }

  if (details) {
    const thickness = Math.max(1, (height * 0.9) / BOOKLET_DIMENSIONS.frontCoverWidth);
    const x0 = width * BOOKLET_DIMENSIONS.grooveInset;
    const x1 = width - x0;
    BOOKLET_DIMENSIONS.grooves.forEach(fromSpine => {
      const y = height * (1 - fromSpine / BOOKLET_DIMENSIONS.frontCoverWidth);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(x0, y - thickness / 2, x1 - x0, thickness);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.fillRect(x0, y + thickness / 2, x1 - x0, thickness * 0.6);
    });
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  const title = design.title?.trim();
  const subtitle = design.subtitle?.trim();
  const lines = [
    title && { text: title, size: height * 0.27, maxWidth: width * 0.72, y: subtitle ? 0.31 : 0.38 },
    subtitle && { text: subtitle, size: height * 0.13, maxWidth: width * 0.6, y: title ? 0.47 : 0.38 }
  ].filter(Boolean);

  lines.forEach(line => {
    const size = fitFontSize(ctx, line.text, font, line.size, line.maxWidth);
    ctx.font = `${font.weight} ${size}px "${font.family}"`;
    if (details) {
      // The thin gap where the inlaid letters meet the cover.
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.lineWidth = size * 0.035;
      ctx.strokeText(line.text, width / 2, height * line.y);
    }
    ctx.fillStyle = ink.hex;
    ctx.fillText(line.text, width / 2, height * line.y);
  });
};

let logoPromise;
const getLogo = () => {
  if (!logoPromise) {
    logoPromise = loadImage(GETGOING_LOGO_URL).catch(error => {
      logoPromise = undefined;
      throw error;
    });
  }
  return logoPromise;
};

/** Draws the fixed "GetGoing × 3Dieter" back cover in the design's colours. */
export const drawBackCover = async (
  canvas,
  design,
  { background = true } = {}
) => {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const color = findBookletColor(design.colorId);
  const ink = findBookletTextColor(design);

  ctx.clearRect(0, 0, width, height);
  if (background) {
    ctx.fillStyle = color.hex;
    ctx.fillRect(0, 0, width, height);
  }

  try {
    const logo = await getLogo();
    const logoWidth = width * 0.42;
    const logoHeight = (logo.naturalHeight / logo.naturalWidth) * logoWidth;
    // Tint the white logo with the text colour on its own layer.
    const layer = document.createElement('canvas');
    layer.width = Math.round(logoWidth);
    layer.height = Math.round(logoHeight);
    const layerCtx = layer.getContext('2d');
    layerCtx.drawImage(logo, 0, 0, layer.width, layer.height);
    layerCtx.globalCompositeOperation = 'source-in';
    layerCtx.fillStyle = ink.hex;
    layerCtx.fillRect(0, 0, layer.width, layer.height);
    ctx.drawImage(layer, (width - logoWidth) / 2, height * 0.12);
  } catch (error) {
    console.error('Logo GetGoing gagal dimuat', error);
  }

  // The back cover lettering is always Poppins (the Business font).
  await ensureBookletFont(findBookletFont('business'));
  ctx.fillStyle = ink.hex;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(height * 0.09)}px "Poppins", sans-serif`;
  ctx.fillText('×', width / 2, height * 0.47);
  ctx.font = `italic 700 ${Math.round(height * 0.17)}px "Poppins", sans-serif`;
  ctx.fillText('3Dieter', width / 2, height * 0.62);
};

/** Fine diagonal ridges, like the layer lines on a matte 3D print. */
export const drawPrintTexture = canvas => {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#a0a0a0';
  ctx.lineWidth = 2;
  for (let offset = -height; offset < width; offset += 6) {
    ctx.beginPath();
    ctx.moveTo(offset, height);
    ctx.lineTo(offset + height, 0);
    ctx.stroke();
  }
};
