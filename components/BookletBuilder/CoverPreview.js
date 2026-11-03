import React, { useEffect, useRef, useState } from 'react';

import { drawFrontCover, ensureBookletFont } from '../../util/bookletUtils';
import {
  BOOKLET_DIMENSIONS,
  findBookletColor,
  findBookletFont
} from '../../data/bookletData';
import styles from './BookletBuilder.module.scss';

/**
 * Flat front view of the booklet in its stand, like the product photos: the
 * taller back cover with its tab behind, the custom front cover with its spine
 * hinge knuckles, and the stand's front wall. Proportions in mm: 116 × 100
 * (4 stand floor + 89 back cover + 7 tab).
 */
const CoverPreview = ({ design }) => {
  const canvasRef = useRef(null);
  const [fontVersion, setFontVersion] = useState(0);
  const color = findBookletColor(design.colorId);
  const font = findBookletFont(design.fontId);

  useEffect(() => {
    let cancelled = false;
    ensureBookletFont(font).then(() => !cancelled && setFontVersion(n => n + 1));
    return () => {
      cancelled = true;
    };
  }, [font]);

  useEffect(() => {
    if (canvasRef.current) drawFrontCover(canvasRef.current, design);
  }, [design, fontVersion]);

  return (
    <div className={styles.mockup} aria-label="Preview sampul depan">
      <div className={styles.mockBack} style={{ background: color.hex }}>
        <span className={styles.mockTab} style={{ background: color.hex }} />
      </div>
      <div
        className={`${styles.mockFront} ${
          design.finishId === 'glossy' ? styles.mockGlossy : styles.mockMatte
        }`}
      >
        <canvas ref={canvasRef} width={928} height={672} className={styles.mockCanvas} />
        {BOOKLET_DIMENSIONS.hingeNotches.map(([from, to]) => (
          // Front view reads the spine left-to-right reversed (see BookletScene).
          <span
            key={from}
            className={styles.mockKnuckle}
            style={{ left: `${(1 - to) * 100}%`, width: `${(to - from) * 100}%` }}
          />
        ))}
      </div>
      <div className={styles.mockStand} />
    </div>
  );
};

export default CoverPreview;
