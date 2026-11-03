import React, { useRef } from 'react';
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { getDpiStatus } from '../../util/bookletUtils';
import { PHOTO_COUNT } from '../../data/bookletData';
import styles from './BookletBuilder.module.scss';

const slotId = index => `slot-${index}`;
const slotIndex = id => Number(String(id).replace('slot-', ''));

const Slot = ({ index, photo, onPick, onEdit, onRemove }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: slotId(index), disabled: !photo });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 5 : undefined
  };

  if (!photo) {
    return (
      <div ref={setNodeRef} style={style} className={styles.slotWrap}>
        <button type="button" className={styles.slotEmpty} onClick={() => onPick(index)}>
          <i className="fas fa-plus" />
          <span>Foto {index + 1}</span>
        </button>
      </div>
    );
  }

  const dpi = getDpiStatus(photo.dpi);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.slotWrap} ${isDragging ? styles.slotDragging : ''}`}
    >
      <div
        className={styles.slotFilled}
        {...attributes}
        {...listeners}
        role="button"
        aria-label={`Foto ${index + 1}, ketuk untuk crop, tahan dan seret untuk memindahkan`}
        onClick={() => onEdit(index)}
      >
        <img src={photo.previewUrl} alt={`Foto ${index + 1}`} draggable={false} />
        <span className={styles.slotNumber}>{index + 1}</span>
        <span className={`${styles.dpiBadge} ${styles[`dpi_${dpi.level}`]}`}>
          {photo.dpi} dpi
        </span>
      </div>
      <button
        type="button"
        className={styles.slotRemove}
        onClick={() => onRemove(index)}
        aria-label={`Hapus foto ${index + 1}`}
      >
        <i className="fas fa-times" />
      </button>
    </div>
  );
};

const PhotoSlots = ({ photos, onAddFiles, onEdit, onRemove, onMove, busyLabel }) => {
  const inputRef = useRef(null);
  const targetSlot = useRef(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    // A long press starts the drag, so a normal swipe still scrolls the page.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const filled = photos.filter(Boolean).length;

  const pickFiles = index => {
    targetSlot.current = typeof index === 'number' ? index : null;
    inputRef.current?.click();
  };

  const handleFiles = event => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length) onAddFiles(files, targetSlot.current);
  };

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    onMove(slotIndex(active.id), slotIndex(over.id));
  };

  const renderGroup = (label, from, to) => (
    <div className={styles.slotGroup}>
      <div className={styles.slotGroupLabel}>{label}</div>
      <div className={styles.slotGrid}>
        {photos.slice(from, to).map((photo, offset) => (
          <Slot
            key={photo?.id || `empty-${from + offset}`}
            index={from + offset}
            photo={photo}
            onPick={pickFiles}
            onEdit={onEdit}
            onRemove={onRemove}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <div className={styles.photoToolbar}>
        <div className={styles.progressWrap}>
          <div className={styles.progressLabel}>
            <b>{filled}</b> dari {PHOTO_COUNT} foto
          </div>
          <div className={styles.progressBar}>
            <span style={{ width: `${(filled / PHOTO_COUNT) * 100}%` }} />
          </div>
        </div>
        <button
          type="button"
          className={styles.primaryButtonSmall}
          onClick={() => pickFiles(null)}
          disabled={filled >= PHOTO_COUNT}
        >
          <i className="fas fa-upload" /> Unggah Foto
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/*"
          multiple
          hidden
          onChange={handleFiles}
        />
      </div>

      <div className={styles.slotsArea} aria-busy={!!busyLabel}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={photos.map((_, index) => slotId(index))}
            strategy={rectSortingStrategy}
          >
            {renderGroup('Sisi depan strip · foto 1–6', 0, 6)}
            {renderGroup('Sisi belakang strip · foto 7–12', 6, 12)}
          </SortableContext>
        </DndContext>
        {busyLabel && (
          <div className={styles.slotsBusy} role="status">
            <span className={styles.slotsBusyPill}>
              <i className="fas fa-spinner fa-spin" /> {busyLabel}
            </span>
          </div>
        )}
      </div>

      <p className={styles.helpText}>
        Ketuk foto untuk mengatur crop 2:3. Tahan lalu seret untuk mengubah urutan. Badge dpi
        menunjukkan ketajaman saat dicetak 10 cm — hijau tajam, kuning cukup.
      </p>
    </div>
  );
};

export default PhotoSlots;
