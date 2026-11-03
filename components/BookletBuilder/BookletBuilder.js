import React, { useCallback, useEffect, useRef, useState } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import { toast } from 'react-toastify';

import Booklet3DModal from './Booklet3DModal';
import OrderSummary from './OrderSummary';
import CoverPreview from './CoverPreview';
import PhotoCropModal from './PhotoCropModal';
import PhotoSlots from './PhotoSlots';
import FilterPicker from './FilterPicker';
import {
  ColorSwatches,
  CoverTextFields,
  FinishToggle,
  FontPicker
} from './DesignControls';
import useWindowSize from '../../hooks/useWindowSize';
import {
  getCropDpi,
  getDefaultCrop,
  getMinimumCropPx,
  readPhotoFile,
  renderFilteredPreview,
  renderPreview
} from '../../util/bookletUtils';
import { findPhotoFilter } from '../../util/bookletFilters';
import { formatCurrency } from '../../util/format';
import {
  BOOKLET_PRICE,
  BOOKLET_SHIPPING_FEE,
  DEFAULT_BOOKLET_DESIGN,
  DPI_MINIMUM,
  MAX_UPLOAD_MB,
  PHOTO_COUNT,
  findBookletColor
} from '../../data/bookletData';
import styles from './BookletBuilder.module.scss';

const emptySlots = () => Array(PHOTO_COUNT).fill(null);

const releasePhoto = photo => {
  if (!photo) return;
  URL.revokeObjectURL(photo.sourceUrl);
  URL.revokeObjectURL(photo.rawUrl);
  URL.revokeObjectURL(photo.previewUrl);
};

/** Unfiltered and filtered previews of a crop. */
const renderPreviews = async (sourceUrl, crop, filterId) => {
  const rawUrl = await renderPreview(sourceUrl, crop);
  return { rawUrl, previewUrl: await renderFilteredPreview(rawUrl, filterId), filterId };
};

let photoSeq = 0;

/** Reads, checks and pre-crops one picked file. Throws with a user message. */
const preparePhoto = async (file, filterId) => {
  if (!file.type.startsWith('image/')) {
    throw new Error(`${file.name} bukan file gambar`);
  }
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    throw new Error(`${file.name} lebih dari ${MAX_UPLOAD_MB} MB`);
  }

  let info;
  try {
    info = await readPhotoFile(file);
  } catch {
    throw new Error(`${file.name} tidak bisa dibuka — gunakan JPG atau PNG`);
  }

  const crop = getDefaultCrop(info.width, info.height);
  const minimum = getMinimumCropPx();
  if (crop.width < minimum.width || crop.height < minimum.height) {
    URL.revokeObjectURL(info.sourceUrl);
    throw new Error(
      `${file.name} terlalu kecil (${info.width}×${info.height}px). Minimal ${minimum.width}×${minimum.height}px agar tajam (${DPI_MINIMUM} dpi).`
    );
  }

  photoSeq += 1;
  return {
    id: `photo-${Date.now()}-${photoSeq}`,
    name: file.name,
    ...info,
    crop,
    dpi: getCropDpi(crop),
    ...(await renderPreviews(info.sourceUrl, crop, filterId))
  };
};

const StepCard = ({ number, title, subtitle, children }) => (
  <section className={styles.card}>
    <div className={styles.stepHeader}>
      <span className={styles.stepNumber}>{number}</span>
      <div>
        <h2 className={styles.cardTitle}>{title}</h2>
        {subtitle && <p className={styles.cardSubtitle}>{subtitle}</p>}
      </div>
    </div>
    {children}
  </section>
);

const BookletBuilder = () => {
  const { isMobile } = useWindowSize();
  const [design, setDesign] = useState(DEFAULT_BOOKLET_DESIGN);
  const [photos, setPhotos] = useState(emptySlots);
  const [cropIndex, setCropIndex] = useState(null);
  const [replaceIndex, setReplaceIndex] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [stage, setStage] = useState('design'); // design | summary
  const [isProcessing, setIsProcessing] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);

  const photosRef = useRef(photos);
  photosRef.current = photos;
  const filterRef = useRef(design.filterId);
  filterRef.current = design.filterId;
  const replaceInput = useRef(null);
  const builderTop = useRef(null);

  useEffect(() => () => photosRef.current.forEach(releasePhoto), []);

  // Re-grade the previews when the filter changes. Photos added or re-cropped
  // in the meantime are already graded with the new filter and are skipped.
  useEffect(() => {
    const filterId = design.filterId;
    const stale = photosRef.current.filter(photo => photo && photo.filterId !== filterId);
    setIsFiltering(stale.length > 0);
    if (!stale.length) return undefined;

    let cancelled = false;
    Promise.all(
      stale.map(async photo => [photo.id, await renderFilteredPreview(photo.rawUrl, filterId)])
    ).then(entries => {
      const fresh = new Map(entries);
      if (cancelled) {
        fresh.forEach(url => URL.revokeObjectURL(url));
        return;
      }
      setPhotos(prev => {
        const used = new Set();
        const next = prev.map(photo => {
          if (!photo || photo.filterId === filterId || !fresh.has(photo.id)) return photo;
          used.add(photo.id);
          URL.revokeObjectURL(photo.previewUrl);
          return { ...photo, previewUrl: fresh.get(photo.id), filterId };
        });
        fresh.forEach((url, id) => !used.has(id) && URL.revokeObjectURL(url));
        return next;
      });
      setIsFiltering(false);
    });

    return () => {
      cancelled = true;
    };
  }, [design.filterId]);

  const filledCount = photos.filter(Boolean).length;
  const missingPhotos = PHOTO_COUNT - filledCount;
  const titleMissing = !design.title.trim();
  const canOrder = missingPhotos === 0 && !titleMissing;

  const updateDesign = useCallback(
    patch =>
      setDesign(prev => {
        const next = { ...prev, ...patch };
        // A cover changed to the text colour would hide the text.
        if (next.textColorId === next.colorId) {
          next.textColorId = findBookletColor(next.colorId).defaultInkId;
        }
        return next;
      }),
    []
  );

  const scrollToBuilder = () =>
    builderTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const addFiles = async (files, startIndex) => {
    const free = photosRef.current
      .map((photo, index) => (photo ? null : index))
      .filter(index => index !== null);
    // A tapped empty slot is filled first, then the rest in order.
    const targets =
      startIndex !== null && free.includes(startIndex)
        ? [startIndex, ...free.filter(index => index !== startIndex)]
        : free;

    if (!targets.length) {
      toast.info('Ke-12 slot sudah terisi. Hapus foto dulu untuk menggantinya.');
      return;
    }
    if (files.length > targets.length) {
      toast.info(`Hanya ${targets.length} foto pertama yang dipakai — slot tersisa ${targets.length}.`);
    }

    setIsProcessing(true);
    const accepted = files.slice(0, targets.length);
    const results = await Promise.allSettled(
      accepted.map(file => preparePhoto(file, filterRef.current))
    );
    setIsProcessing(false);

    let slot = 0;
    const next = [...photosRef.current];
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        next[targets[slot]] = result.value;
        slot += 1;
      } else {
        toast.error(result.reason.message, { autoClose: 7000 });
      }
    });
    setPhotos(next);
  };

  const replacePhoto = async file => {
    const index = replaceIndex;
    setReplaceIndex(null);
    if (index === null || !file) return;
    setIsProcessing(true);
    try {
      const photo = await preparePhoto(file, filterRef.current);
      setPhotos(prev => {
        releasePhoto(prev[index]);
        const next = [...prev];
        next[index] = photo;
        return next;
      });
      setCropIndex(index);
    } catch (error) {
      toast.error(error.message, { autoClose: 7000 });
    } finally {
      setIsProcessing(false);
    }
  };

  const saveCrop = async (index, area) => {
    const photo = photosRef.current[index];
    const crop = {
      x: Math.round(area.x),
      y: Math.round(area.y),
      width: Math.round(area.width),
      height: Math.round(area.height)
    };
    setCropIndex(null);
    const previews = await renderPreviews(photo.sourceUrl, crop, filterRef.current);
    setPhotos(prev => {
      if (prev[index]?.id !== photo.id) {
        URL.revokeObjectURL(previews.rawUrl);
        URL.revokeObjectURL(previews.previewUrl);
        return prev;
      }
      URL.revokeObjectURL(prev[index].rawUrl);
      URL.revokeObjectURL(prev[index].previewUrl);
      const next = [...prev];
      next[index] = { ...prev[index], crop, dpi: getCropDpi(crop), ...previews };
      return next;
    });
  };

  const removePhoto = index =>
    setPhotos(prev => {
      releasePhoto(prev[index]);
      const next = [...prev];
      next[index] = null;
      return next;
    });

  const movePhoto = (from, to) => setPhotos(prev => arrayMove(prev, from, to));

  const goToCheckout = () => {
    setShowErrors(true);
    if (!canOrder) {
      setIsPreviewOpen(false);
      toast.error(
        titleMissing
          ? 'Isi judul sampul terlebih dahulu.'
          : `Unggah ${missingPhotos} foto lagi untuk melengkapi booklet.`
      );
      return;
    }
    setIsPreviewOpen(false);
    setStage('summary');
    scrollToBuilder();
  };

  const closePreview = useCallback(() => setIsPreviewOpen(false), []);

  const startOver = () => {
    photosRef.current.forEach(releasePhoto);
    setPhotos(emptySlots());
    setDesign(DEFAULT_BOOKLET_DESIGN);
    setShowErrors(false);
    setStage('design');
    scrollToBuilder();
  };

  const total = BOOKLET_PRICE + BOOKLET_SHIPPING_FEE;

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroText}>
            <span className={styles.eyebrow}>GetGoing × 3Dieter</span>
            <h1 className={styles.heroTitle}>Booklet Foto 3D Custom</h1>
            <p className={styles.heroLead}>
              Simpan 12 momen terbaik perjalananmu dalam booklet cetak 3D yang bisa dilipat,
              dipajang di stand magnetik, dan dibawa ke mana saja.
            </p>
            <ul className={styles.heroPoints}>
              <li><i className="fas fa-images" /> 12 foto cetak rasio 2:3</li>
              <li><i className="fas fa-font" /> Judul sampul, font &amp; warna pilihanmu</li>
              <li><i className="fas fa-magnet" /> Lengkap dengan stand magnetik</li>
            </ul>
            <div className={styles.heroPrice}>
              {formatCurrency(BOOKLET_PRICE)}
              <span>{BOOKLET_SHIPPING_FEE ? ' + ongkir' : ' · gratis ongkir'}</span>
            </div>
            {stage === 'design' && (
              <button type="button" className={styles.primaryButton} onClick={scrollToBuilder}>
                Mulai Desain
              </button>
            )}
          </div>
          <div className={styles.heroImages}>
            <img
              src="/content/img/3dieter/booklet-warna.jpg"
              alt="Booklet foto 3D warna biru, hijau, kuning dan merah bertuliskan Bhutan Sept 2026 di stand hitam"
              width="1045"
              height="1400"
            />
            <img
              src="/content/img/3dieter/booklet-strip.jpg"
              alt="Booklet foto 3D terbuka, frame putih berisi foto perjalanan di Bhutan"
              width="1600"
              height="1194"
            />
          </div>
        </div>
      </section>

      <div ref={builderTop} className={styles.anchor} />

      {stage === 'design' && (
        <div className={styles.builderGrid}>
          <aside className={styles.previewColumn}>
            <div className={styles.previewSticky}>
              <div className={`${styles.card} ${styles.previewCard}`}>
                <div className={styles.previewLabel}>Preview sampul</div>
                <CoverPreview design={design} />
                <button
                  type="button"
                  className={`${styles.secondaryButton} ${styles.blockButton}`}
                  onClick={() => setIsPreviewOpen(true)}
                >
                  <i className="fas fa-cube" /> Lihat Preview 3D
                </button>
                {missingPhotos > 0 && (
                  <p className={styles.helpTextCenter}>
                    Preview 3D paling bagus setelah 12 foto terunggah ({filledCount}/{PHOTO_COUNT})
                  </p>
                )}
              </div>
            </div>
          </aside>

          <div className={styles.stepsColumn}>
            <StepCard
              number={1}
              title="Teks Sampul Depan"
              subtitle="Tulis tujuan dan waktu perjalananmu"
            >
              <CoverTextFields design={design} onChange={updateDesign} />
              {showErrors && titleMissing && (
                <span className={styles.fieldError}>Judul sampul wajib diisi</span>
              )}
            </StepCard>

            <StepCard number={2} title="Font">
              <FontPicker
                value={design.fontId}
                sample={design.title.trim() || 'Aa'}
                onChange={fontId => updateDesign({ fontId })}
              />
            </StepCard>

            <StepCard number={3} title="Warna" subtitle="Bingkai foto selalu putih">
              <div className={styles.swatchSection}>
                <p className={styles.swatchLabel}>Sampul</p>
                <ColorSwatches value={design.colorId} onChange={colorId => updateDesign({ colorId })} />
              </div>
              <div className={styles.swatchSection}>
                <p className={styles.swatchLabel}>Teks sampul</p>
                <ColorSwatches
                  value={design.textColorId}
                  disabledId={design.colorId}
                  label="Warna teks"
                  onChange={textColorId => updateDesign({ textColorId })}
                />
              </div>
            </StepCard>

            <StepCard number={4} title="Finishing Sampul">
              <FinishToggle value={design.finishId} onChange={finishId => updateDesign({ finishId })} />
            </StepCard>

            <StepCard
              number={5}
              title="Unggah 12 Foto"
              subtitle="Dicetak rasio 2:3, minimal 1200×1800px untuk hasil paling tajam"
            >
              <PhotoSlots
                photos={photos}
                onAddFiles={addFiles}
                onEdit={setCropIndex}
                onRemove={removePhoto}
                onMove={movePhoto}
                busyLabel={
                  isProcessing ? 'Memproses foto…' : isFiltering ? 'Menerapkan filter…' : null
                }
              />
              <FilterPicker
                value={design.filterId}
                onChange={filterId => updateDesign({ filterId })}
                samplePhotoUrl={photos.find(Boolean)?.rawUrl}
              />
              {showErrors && missingPhotos > 0 && (
                <span className={styles.fieldError}>Masih kurang {missingPhotos} foto</span>
              )}
            </StepCard>

            {!isMobile && (
              <section className={`${styles.card} ${styles.orderCard}`}>
                <div>
                  <div className={styles.orderPrice}>{formatCurrency(total)}</div>
                  <div className={styles.cardSubtitle}>
                    {canOrder ? 'Desain siap dipesan' : `${filledCount}/${PHOTO_COUNT} foto terunggah`}
                  </div>
                </div>
                <div className={styles.orderActions}>
                  <button type="button" className={styles.secondaryButton} onClick={() => setIsPreviewOpen(true)}>
                    Preview 3D
                  </button>
                  <button type="button" className={styles.primaryButton} onClick={goToCheckout}>
                    Lanjut ke Pemesanan
                  </button>
                </div>
              </section>
            )}
          </div>
        </div>
      )}

      {stage === 'summary' && (
        <div className={styles.checkoutWrap}>
          <OrderSummary
            design={design}
            photos={photos}
            onBack={() => {
              setStage('design');
              scrollToBuilder();
            }}
          />
          <div className={styles.startOver}>
            <button type="button" className={styles.secondaryButton} onClick={startOver}>
              Buat booklet lain
            </button>
          </div>
        </div>
      )}

      {stage === 'design' && isMobile && (
        <div className={styles.mobileBar}>
          <div>
            <div className={styles.mobileBarPrice}>{formatCurrency(total)}</div>
            <div className={styles.mobileBarMeta}>
              {filledCount}/{PHOTO_COUNT} foto
            </div>
          </div>
          <button
            type="button"
            className={`${styles.secondaryButton} ${styles.mobileBarPreview}`}
            onClick={() => setIsPreviewOpen(true)}
          >
            <i className="fas fa-cube" /> Preview 3D
          </button>
          <button type="button" className={styles.primaryButton} onClick={goToCheckout}>
            Pesan
          </button>
        </div>
      )}

      <PhotoCropModal
        photo={cropIndex !== null ? photos[cropIndex] : null}
        index={cropIndex}
        onSave={saveCrop}
        filterCss={findPhotoFilter(design.filterId).css}
        onClose={() => setCropIndex(null)}
        onReplace={index => {
          setCropIndex(null);
          setReplaceIndex(index);
          replaceInput.current?.click();
        }}
      />
      <input
        ref={replaceInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        hidden
        onChange={event => {
          const [file] = event.target.files || [];
          event.target.value = '';
          replacePhoto(file);
        }}
      />

      <Booklet3DModal
        isOpen={isPreviewOpen}
        onClose={closePreview}
        design={design}
        photos={photos}
        onDesignChange={updateDesign}
        onOrder={goToCheckout}
      />
    </div>
  );
};

export default BookletBuilder;
