# GetGoing × 3Dieter — Booklet Foto 3D Custom

A customizer for a 3D-printed fold-out photo booklet: write the cover text, pick a font, cover and text colours, a matte or glossy finish and a photo filter, upload 12 photos, and see the result in a live 3D preview.

This is a standalone **demo**. It has no payment or order backend, so the flow ends at a design summary.

## Features

- **Cover text:** a title (max 12 characters) and subtitle (max 16). Characters that can't be printed are removed as you type.
- **10 font styles:** Business, Fancy, Calm, Playful, Cute, Artistic, Vintage, Loud, Sophisticated and Futuristic, all Google Fonts.
- **8 colours** for the cover and the cover text. The text can't be set to the same colour as the cover.
- **Matte or glossy** finish, shown in the 3D lighting.
- **12 photos at 2:3:**
  - crop and drag to reorder
  - a DPI badge for a 10 cm print
  - photos below 200 DPI are rejected
- **5 photo filters:** Original, Warm, Movie, Black & White and Vibrant. Each runs on the pixels, so previews and exports match.
- **3D preview** built with three.js and React Three Fiber, with three views:
  - closed on its stand
  - open
  - the unfolded photo strip

## Run it

Requires Node.js 20 or newer.

```bash
npm install
npm run dev        # http://localhost:3000
```

For a production build:

```bash
npm run build
npm start
```

## Where things live

| Path | What |
|---|---|
| `pages/index.js` | The page |
| `components/BookletBuilder/` | Customizer UI, crop dialog, filter picker, 3D preview modal |
| `components/BookletBuilder/BookletScene.js` | Procedural 3D model of the booklet (covers, spine, hinged frame strip, stand) |
| `data/bookletData.js` | Price, fonts, colours, finishes and physical dimensions (mm) |
| `util/bookletFilters.js` | The five photo filters |
| `util/bookletUtils.js` | Cropping, resolution checks and cover artwork drawing |

To change a price, colour or font, edit `data/bookletData.js`. The 3D model's measurements are in `BOOKLET_DIMENSIONS` in the same file.
