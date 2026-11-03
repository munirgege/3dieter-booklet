import React from 'react';

import CoverPreview from './CoverPreview';
import { findPhotoFilter } from '../../util/bookletFilters';
import { formatCurrency } from '../../util/format';
import {
  BOOKLET_PRICE,
  BOOKLET_SHIPPING_FEE,
  findBookletColor,
  findBookletFinish,
  findBookletFont,
  findBookletTextColor
} from '../../data/bookletData';
import styles from './BookletBuilder.module.scss';

const SummaryRow = ({ label, value, bold }) => (
  <div className={`${styles.summaryRow} ${bold ? styles.summaryRowBold : ''}`}>
    <span>{label}</span>
    <span>{value}</span>
  </div>
);

/**
 * Final step of the demo: a summary of the finished design. This standalone
 * version has no payment or order backend, so it stops here.
 */
const OrderSummary = ({ design, photos, onBack }) => {
  const font = findBookletFont(design.fontId);
  const color = findBookletColor(design.colorId);
  const textColor = findBookletTextColor(design);
  const finish = findBookletFinish(design.finishId);
  const filter = findPhotoFilter(design.filterId);

  return (
    <div className={styles.checkoutGrid}>
      <div className={styles.checkoutMain}>
        <button type="button" className={styles.backLink} onClick={onBack}>
          <i className="fas fa-arrow-left" /> Ubah desain
        </button>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Desain kamu siap</h2>
          <p className={styles.cardSubtitle}>
            Ini versi demo dari customizer booklet GetGoing × 3Dieter. Pembayaran dan
            pengiriman pesanan tidak tersedia di demo ini.
          </p>
          <div className={styles.summaryThumbs} style={{ marginTop: 16 }}>
            {photos.map((photo, index) => (
              <img key={photo.id} src={photo.previewUrl} alt={`Foto ${index + 1}`} />
            ))}
          </div>
        </section>
      </div>

      <aside className={styles.checkoutSide}>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Ringkasan Desain</h2>
          <div className={styles.summaryPreview}>
            <CoverPreview design={design} />
          </div>
          <div className={styles.summaryBox}>
            <SummaryRow label="Judul" value={design.title} />
            {design.subtitle && <SummaryRow label="Subjudul" value={design.subtitle} />}
            <SummaryRow label="Font" value={font.name} />
            <SummaryRow label="Warna sampul" value={color.name} />
            <SummaryRow label="Warna teks" value={textColor.name} />
            <SummaryRow label="Finishing" value={finish.name} />
            <SummaryRow label="Filter foto" value={filter.name} />
          </div>
          <div className={styles.summaryBox}>
            <SummaryRow label="Booklet foto 3D + stand" value={formatCurrency(BOOKLET_PRICE)} />
            <SummaryRow
              label="Ongkos kirim"
              value={BOOKLET_SHIPPING_FEE ? formatCurrency(BOOKLET_SHIPPING_FEE) : 'Gratis'}
            />
            <SummaryRow
              label="Total"
              value={formatCurrency(BOOKLET_PRICE + BOOKLET_SHIPPING_FEE)}
              bold
            />
          </div>
          <div className={styles.alertInfo}>Mode demo — tidak ada pembayaran yang diproses.</div>
        </section>
      </aside>
    </div>
  );
};

export default OrderSummary;
