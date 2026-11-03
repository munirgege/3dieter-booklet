import React, { useEffect, useMemo, useState } from 'react';
import Cropper from 'react-easy-crop';

import {
  getCropDpi,
  getDefaultCrop,
  getDpiStatus,
  getMinimumCropPx
} from '../../util/bookletUtils';
import { PHOTO_ASPECT } from '../../data/bookletData';
import styles from './BookletBuilder.module.scss';

/**
 * 2:3 crop for one slot. Zoom stops where the crop would print below the
 * minimum DPI, so a photo can't be cropped into a blurry print.
 */
const PhotoCropModal = ({ photo, index, filterCss, onSave, onReplace, onClose }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState(photo?.crop || null);

  useEffect(() => {
    if (!photo) return undefined;
    setArea(photo.crop);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [photo]);

  const maxZoom = useMemo(() => {
    if (!photo) return 1;
    const full = getDefaultCrop(photo.width, photo.height);
    const minimum = getMinimumCropPx();
    // 1% headroom so rounding never lands a max-zoom crop under the minimum.
    return Math.max(1, Math.min(6, full.width / (minimum.width * 1.01)));
  }, [photo]);

  if (!photo) return null;

  const dpi = getCropDpi(area);
  const status = getDpiStatus(dpi);

  return (
    <div className={styles.cropOverlay} role="dialog" aria-modal="true" aria-label={`Crop foto ${index + 1}`}>
      <div className={styles.cropDialog}>
        <div className={styles.cropHeader}>
          <div>
            <div className={styles.viewerTitle}>Atur Foto {index + 1}</div>
            <div className={styles.viewerSubtitle}>Geser dan zoom untuk memilih area cetak 2:3</div>
          </div>
          <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Tutup">
            <i className="fas fa-times" />
          </button>
        </div>

        <div className={styles.cropArea}>
          <Cropper
            image={photo.sourceUrl}
            crop={crop}
            zoom={zoom}
            minZoom={1}
            maxZoom={maxZoom}
            aspect={PHOTO_ASPECT}
            initialCroppedAreaPixels={photo.crop}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setArea(pixels)}
            objectFit="contain"
            // CSS stand-in for the chosen filter; the saved crop uses the exact one.
            style={{ mediaStyle: { filter: filterCss } }}
            showGrid
          />
        </div>

        <div className={styles.cropControls}>
          <div className={styles.zoomRow}>
            <i className="fas fa-search-minus" />
            <input
              type="range"
              min={1}
              max={maxZoom}
              step={0.01}
              value={zoom}
              onChange={event => setZoom(Number(event.target.value))}
              aria-label="Zoom"
              disabled={maxZoom <= 1}
            />
            <i className="fas fa-search-plus" />
          </div>
          <div className={`${styles.dpiLine} ${styles[`dpiText_${status.level}`]}`}>
            <span className={`${styles.dpiDot} ${styles[`dpi_${status.level}`]}`} />
            {status.label} · {dpi} dpi saat dicetak 10 cm
            {maxZoom <= 1 && ' — resolusi foto ini tidak cukup untuk di-zoom'}
          </div>
          <div className={styles.cropActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => onReplace(index)}>
              Ganti Foto
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => area && onSave(index, area)}
            >
              Simpan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhotoCropModal;
