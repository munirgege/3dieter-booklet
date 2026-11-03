import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import ClipLoader from 'react-spinners/ClipLoader';

import { ColorSwatches, FinishToggle } from './DesignControls';
import styles from './BookletBuilder.module.scss';

const VIEWS = [
  { id: 'closed', label: 'Tertutup' },
  { id: 'open', label: 'Terbuka' },
  { id: 'strip', label: 'Strip Foto' }
];

const VIEW_HINTS = {
  closed: 'Booklet berdiri di stand magnetik. Putar untuk melihat sampul belakang.',
  open: 'Sampul terbuka dan lipatan frame direnggangkan.',
  strip: 'Strip 6 frame berisi 12 foto — sisi depan foto 1–6, sisi belakang 7–12.'
};

const SceneLoading = () => (
  <div className={styles.sceneLoading}>
    <ClipLoader size={28} color="#cc0000" />
    <span>Menyiapkan preview 3D…</span>
  </div>
);

const BookletScene = dynamic(() => import('./BookletScene'), {
  ssr: false,
  loading: SceneLoading
});

const supportsWebGL = () => {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
};

const Booklet3DModal = ({
  isOpen,
  onClose,
  design,
  photos,
  onDesignChange,
  onOrder
}) => {
  const [view, setView] = useState('closed');
  const [autoRotate, setAutoRotate] = useState(false);
  const [webglReady, setWebglReady] = useState(true);

  useEffect(() => {
    if (!isOpen) return undefined;
    setView('closed');
    setAutoRotate(false);
    setWebglReady(supportsWebGL());

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const handleKey = event => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const missing = photos.filter(photo => !photo).length;

  const selectView = id => {
    setView(id);
    setAutoRotate(id === 'strip');
  };

  return (
    <div
      className={styles.viewerOverlay}
      onClick={event => event.target === event.currentTarget && onClose()}
    >
      <div
        className={styles.viewerDialog}
        role="dialog"
        aria-modal="true"
        aria-label="Preview 3D booklet"
      >
        <div className={styles.viewerHeader}>
          <div>
            <div className={styles.viewerTitle}>Preview 3D</div>
            <div className={styles.viewerSubtitle}>
              {missing > 0
                ? `${missing} foto belum diunggah — slot kosong ditandai abu-abu`
                : 'Tampilan mendekati hasil cetak, warna asli bisa sedikit berbeda'}
            </div>
          </div>
          <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Tutup preview">
            <i className="fas fa-times" />
          </button>
        </div>

        <div className={styles.viewerStage}>
          {webglReady ? (
            <BookletScene
              design={design}
              photos={photos}
              view={view}
              autoRotate={autoRotate}
              onInteract={() => setAutoRotate(false)}
            />
          ) : (
            <div className={styles.sceneLoading}>
              <span>Browser ini belum mendukung tampilan 3D (WebGL).</span>
            </div>
          )}

          <div className={styles.viewTabs} role="tablist">
            {VIEWS.map(item => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={view === item.id}
                className={`${styles.viewTab} ${view === item.id ? styles.viewTabActive : ''}`}
                onClick={() => selectView(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className={styles.viewerHint}>
            <i className="fas fa-hand-pointer" /> Geser untuk memutar · cubit / scroll untuk zoom
          </div>
        </div>

        <div className={styles.viewerPanel}>
          <p className={styles.viewerPanelHint}>{VIEW_HINTS[view]}</p>
          <div className={styles.viewerPanelRow}>
            <div className={styles.viewerColorRow}>
              <span>Sampul</span>
              <ColorSwatches
                value={design.colorId}
                onChange={colorId => onDesignChange({ colorId })}
                compact
              />
            </div>
            <div className={styles.viewerColorRow}>
              <span>Teks</span>
              <ColorSwatches
                value={design.textColorId}
                disabledId={design.colorId}
                label="Warna teks"
                onChange={textColorId => onDesignChange({ textColorId })}
                compact
              />
            </div>
            <FinishToggle
              value={design.finishId}
              onChange={finishId => onDesignChange({ finishId })}
              compact
            />
          </div>
          <div className={styles.viewerActions}>
            <button type="button" className={styles.secondaryButton} onClick={onClose}>
              Ubah Desain
            </button>
            <button type="button" className={styles.primaryButton} onClick={onOrder}>
              Pesan Sekarang
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Booklet3DModal;
