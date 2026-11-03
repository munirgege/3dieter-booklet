/**
 * Configuration for the custom photo booklet (GetGoing × 3Dieter).
 *
 * Everything the customizer and the 3D preview need to agree on lives here,
 * so a new colour, font or price is a one-line change.
 */

export const BOOKLET_PRICE = 129000;
export const BOOKLET_SHIPPING_FEE = 0;

export const PHOTO_COUNT = 12;

/** Photo print aspect, width / height (portrait 2:3). */
export const PHOTO_ASPECT = 2 / 3;

/**
 * Long side of the printed photo in cm. Resolution is checked against it:
 * 300 DPI is sharp, 200 DPI is the lowest we accept.
 */
export const PRINT_LONG_SIDE_CM = 10;
export const DPI_SHARP = 300;
export const DPI_MINIMUM = 200;

/** Longest side, in px, of the cropped file sent to print. */
export const PRINT_EXPORT_MAX_PX = 2400;

/** Longest side, in px, of the textures used by the on-page previews. */
export const PREVIEW_MAX_PX = 900;

export const MAX_UPLOAD_MB = 25;

export const COVER_TEXT_LIMITS = {
  title: 12,
  subtitle: 16
};

/** Letters, digits, spaces and the punctuation a 3D printer renders cleanly. */
export const COVER_TEXT_ALLOWED = /[^A-Za-z0-9 .,'&!?\-/()]/g;

export const DEFAULT_COVER_TEXT = {
  title: 'Bhutan',
  subtitle: 'Sept 2026'
};

/**
 * Ten font styles, each a Google Font in its heaviest printable weight.
 * `scale` evens out optical size: script faces with small x-heights get a
 * bigger em so they read as large as the sans faces on the cover.
 */
export const BOOKLET_FONTS = [
  { id: 'business', name: 'Business', family: 'Poppins', weight: 700, scale: 1 },
  { id: 'fancy', name: 'Fancy', family: 'Great Vibes', weight: 400, scale: 1.2 },
  { id: 'calm', name: 'Calm', family: 'Quicksand', weight: 700, scale: 1 },
  { id: 'playful', name: 'Playful', family: 'Fredoka', weight: 600, scale: 1 },
  { id: 'cute', name: 'Cute', family: 'Courgette', weight: 400, scale: 1.05 },
  { id: 'artistic', name: 'Artistic', family: 'Lobster', weight: 400, scale: 1.05 },
  { id: 'vintage', name: 'Vintage', family: 'Pirata One', weight: 400, scale: 1.1 },
  { id: 'loud', name: 'Loud', family: 'Righteous', weight: 400, scale: 0.95 },
  { id: 'sophisticated', name: 'Sophisticated', family: 'Tangerine', weight: 700, scale: 1.35 },
  { id: 'futuristic', name: 'Futuristic', family: 'Audiowide', weight: 400, scale: 0.9 }
];

export const BOOKLET_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Audiowide&family=Courgette&family=Fredoka:wght@600&family=Great+Vibes&family=Lobster&family=Pirata+One&family=Poppins:wght@700&family=Quicksand:wght@700&family=Righteous&family=Tangerine:wght@700&display=swap';

/**
 * Filament colours. Every colour is offered for both the cover and the cover
 * text; `defaultInkId` is the text colour a cover falls back to when the
 * chosen text colour would match the cover and disappear.
 */
export const BOOKLET_COLORS = [
  { id: 'merah', name: 'Merah', hex: '#9E1B1F', defaultInkId: 'putih' },
  { id: 'hitam', name: 'Hitam', hex: '#232323', defaultInkId: 'putih' },
  { id: 'putih', name: 'Putih', hex: '#ECEAE5', defaultInkId: 'hitam' },
  { id: 'biru', name: 'Biru', hex: '#1F3A78', defaultInkId: 'putih' },
  { id: 'hijau', name: 'Hijau', hex: '#2D5E3E', defaultInkId: 'putih' },
  { id: 'kuning', name: 'Kuning', hex: '#E8B21E', defaultInkId: 'hitam' },
  { id: 'ungu', name: 'Ungu', hex: '#5B2C83', defaultInkId: 'putih' },
  { id: 'magenta', name: 'Magenta', hex: '#C2185B', defaultInkId: 'putih' }
];

export const BOOKLET_FINISHES = [
  {
    id: 'matte',
    name: 'Matte',
    description: 'Tekstur halus, tidak memantulkan cahaya'
  },
  {
    id: 'glossy',
    name: 'Glossy',
    description: 'Permukaan mengkilap dengan pantulan cahaya'
  }
];

export const DEFAULT_BOOKLET_DESIGN = {
  ...DEFAULT_COVER_TEXT,
  // Poppins (Business) is the face on the sample booklet.
  fontId: 'business',
  colorId: BOOKLET_COLORS[0].id,
  textColorId: BOOKLET_COLORS[0].defaultInkId,
  filterId: 'warm',
  finishId: BOOKLET_FINISHES[0].id
};

/**
 * Physical size of the booklet in mm, used to build the 3D model and the
 * cover artwork. Measured in "reading" orientation: the spine runs
 * vertically, photos stand portrait. "From the spine" distances are measured
 * across the cover, from its hinged edge towards the open edge.
 */
export const BOOKLET_DIMENSIONS = {
  frameWidth: 76,
  frameHeight: 108,
  frameThickness: 4,
  frameBorder: 6,
  frameCount: 6,
  coverThickness: 3,
  coverLength: 116,
  frontCoverWidth: 84,
  backCoverWidth: 89,
  tabDepth: 7,
  /** Share of the back cover's outer edge the folder tab runs along. */
  tabLength: 0.45,
  cornerRadius: 6,
  spineCornerRadius: 4,
  /** Notches in both covers' spine edge holding the spine hinge knuckles, as fractions of coverLength. */
  hingeNotches: [
    [0.1, 0.24],
    [0.61, 0.77]
  ],
  hingeNotchDepth: 3.2,
  /** The three cut grooves across the lower front cover, mm from the spine. */
  grooves: [25, 29.5, 34],
  grooveInset: 0.09,
  stand: { length: 72, height: 24, floor: 4, wall: 6 }
};

export const findBookletFont = id =>
  BOOKLET_FONTS.find(font => font.id === id) || BOOKLET_FONTS[0];

export const findBookletColor = id =>
  BOOKLET_COLORS.find(color => color.id === id) || BOOKLET_COLORS[0];

/** The text colour actually printed: never the same as the cover. */
export const findBookletTextColor = design => {
  const cover = findBookletColor(design.colorId);
  const id =
    design.textColorId && design.textColorId !== cover.id
      ? design.textColorId
      : cover.defaultInkId;
  return findBookletColor(id);
};

export const findBookletFinish = id =>
  BOOKLET_FINISHES.find(finish => finish.id === id) || BOOKLET_FINISHES[0];
