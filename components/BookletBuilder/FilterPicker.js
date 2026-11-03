import React, { useEffect, useState } from 'react';

import { PHOTO_FILTERS } from '../../util/bookletFilters';
import { renderFilteredPreview } from '../../util/bookletUtils';
import styles from './BookletBuilder.module.scss';

const SAMPLE_PHOTO = '/content/img/3dieter/booklet-strip.jpg';
const THUMB_PX = 240;

/**
 * One filter for the whole booklet. Each option shows the first uploaded
 * photo with that filter, or a sample photo until something is uploaded.
 */
const FilterPicker = ({ value, onChange, samplePhotoUrl }) => {
  const [thumbs, setThumbs] = useState({});
  const source = samplePhotoUrl || SAMPLE_PHOTO;

  useEffect(() => {
    let cancelled = false;
    const created = [];

    Promise.all(
      PHOTO_FILTERS.map(filter =>
        renderFilteredPreview(source, filter.id, THUMB_PX)
          .then(url => {
            created.push(url);
            return [filter.id, url];
          })
          .catch(() => [filter.id, null])
      )
    ).then(entries => {
      if (!cancelled) setThumbs(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
      created.forEach(url => URL.revokeObjectURL(url));
    };
  }, [source]);

  return (
    <div className={styles.filterSection}>
      <div className={styles.swatchLabel}>Filter foto</div>
      <div className={styles.filterGrid} role="radiogroup" aria-label="Filter foto">
        {PHOTO_FILTERS.map(filter => (
          <button
            key={filter.id}
            type="button"
            role="radio"
            aria-checked={value === filter.id}
            className={`${styles.filterOption} ${value === filter.id ? styles.filterActive : ''}`}
            onClick={() => onChange(filter.id)}
          >
            <span className={styles.filterThumb}>
              {thumbs[filter.id] && <img src={thumbs[filter.id]} alt="" />}
            </span>
            <span className={styles.filterName}>{filter.name}</span>
          </button>
        ))}
      </div>
      <p className={styles.helpText}>
        Filter berlaku untuk ke-12 foto dan ikut tercetak di booklet.
      </p>
    </div>
  );
};

export default FilterPicker;
