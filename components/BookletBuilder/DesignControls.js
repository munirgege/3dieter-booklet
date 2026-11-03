import React from 'react';

import { sanitizeCoverText } from '../../util/bookletUtils';
import {
  BOOKLET_COLORS,
  BOOKLET_FINISHES,
  BOOKLET_FONTS,
  COVER_TEXT_LIMITS
} from '../../data/bookletData';
import styles from './BookletBuilder.module.scss';

const TEXT_FIELDS = [
  { field: 'title', label: 'Judul', placeholder: 'Contoh: Bhutan' },
  { field: 'subtitle', label: 'Subjudul', placeholder: 'Contoh: Sept 2026' }
];

export const CoverTextFields = ({ design, onChange }) => (
  <div className={styles.fieldStack}>
    {TEXT_FIELDS.map(({ field, label, placeholder }) => {
      const limit = COVER_TEXT_LIMITS[field];
      const length = design[field].length;
      return (
        <label key={field} className={styles.field}>
          <span className={styles.fieldLabel}>
            {label}
            <span className={`${styles.counter} ${length >= limit ? styles.counterFull : ''}`}>
              {length}/{limit}
            </span>
          </span>
          <input
            className={styles.input}
            value={design[field]}
            maxLength={limit}
            placeholder={placeholder}
            autoComplete="off"
            onChange={event => onChange({ [field]: sanitizeCoverText(event.target.value, field) })}
          />
        </label>
      );
    })}
    <p className={styles.helpText}>
      Huruf, angka, spasi dan tanda baca dasar (. , &apos; &amp; ! ? - / ( )). Emoji dan
      simbol lain tidak bisa dicetak.
    </p>
  </div>
);

export const FontPicker = ({ value, sample, onChange }) => (
  <div className={styles.fontGrid} role="radiogroup" aria-label="Pilih font">
    {BOOKLET_FONTS.map(font => (
      <button
        key={font.id}
        type="button"
        role="radio"
        aria-checked={value === font.id}
        className={`${styles.fontOption} ${value === font.id ? styles.optionActive : ''}`}
        onClick={() => onChange(font.id)}
      >
        <span
          className={styles.fontSample}
          // Via a custom property: the site's global `span { font-family: Manrope
          // !important }` would otherwise win over an inline font-family.
          style={{
            '--sample-font': `"${font.family}", sans-serif`,
            fontWeight: font.weight,
            fontSize: `${20 * font.scale}px`
          }}
        >
          {sample || 'Aa'}
        </span>
        <span className={styles.fontName}>{font.name}</span>
      </button>
    ))}
  </div>
);

export const ColorSwatches = ({
  value,
  onChange,
  compact,
  disabledId,
  label = 'Warna sampul'
}) => (
  <div
    className={`${styles.swatches} ${compact ? styles.swatchesCompact : ''}`}
    role="radiogroup"
    aria-label={label}
  >
    {BOOKLET_COLORS.map(color => {
      const disabled = color.id === disabledId;
      return (
        <button
          key={color.id}
          type="button"
          role="radio"
          aria-checked={value === color.id}
          aria-label={disabled ? `${color.name} (sama dengan warna sampul)` : color.name}
          title={disabled ? 'Sama dengan warna sampul' : color.name}
          disabled={disabled}
          className={`${styles.swatch} ${value === color.id ? styles.swatchActive : ''} ${
            disabled ? styles.swatchDisabled : ''
          }`}
          onClick={() => onChange(color.id)}
        >
          <span className={styles.swatchColor} style={{ background: color.hex }} />
          {!compact && <span className={styles.swatchName}>{color.name}</span>}
        </button>
      );
    })}
  </div>
);

export const FinishToggle = ({ value, onChange, compact }) => (
  <div
    className={`${styles.finishGroup} ${compact ? styles.finishCompact : ''}`}
    role="radiogroup"
    aria-label="Finishing sampul"
  >
    {BOOKLET_FINISHES.map(finish => (
      <button
        key={finish.id}
        type="button"
        role="radio"
        aria-checked={value === finish.id}
        className={`${styles.finishOption} ${value === finish.id ? styles.optionActive : ''}`}
        onClick={() => onChange(finish.id)}
      >
        <span className={`${styles.finishSample} ${styles[`finish_${finish.id}`]}`} />
        <span>
          <span className={styles.finishName}>{finish.name}</span>
          {!compact && <span className={styles.finishDescription}>{finish.description}</span>}
        </span>
      </button>
    ))}
  </div>
);
