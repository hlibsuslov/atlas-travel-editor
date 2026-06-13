import { useTranslation } from 'react-i18next';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { Country } from '@/domain/schema';
import { useEditorStore } from '@/features/editor/store';
import { CountryCard } from './CountryCard';

interface VisibleCountry {
  country: Country;
  idx: number;
}

interface CountryListProps {
  countries: VisibleCountry[];
  /** True while a text filter is active — reordering is disabled then. */
  filtering: boolean;
  invalidCountries: Set<number>;
}

/** A country card with a drag handle, sortable by its array index. */
function SortableCountryCard({
  country,
  idx,
  invalid,
  defaultOpen,
}: {
  country: Country;
  idx: number;
  invalid: boolean;
  defaultOpen: boolean;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: idx,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="sortable-row">
      <button
        type="button"
        className="drag-handle"
        aria-label={t('actions.reorder')}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={15} />
      </button>
      <div className="sortable-row-body">
        <CountryCard country={country} index={idx} invalid={invalid} defaultOpen={defaultOpen} />
      </div>
    </div>
  );
}

/**
 * Renders the editable country list. When no filter is active the rows are
 * drag-and-drop sortable (persisted via the store's `reorderCountries`); while
 * filtering, indices are non-contiguous so reordering is disabled and a plain
 * list is shown.
 */
export function CountryList({ countries, filtering, invalidCountries }: CountryListProps) {
  const reorderCountries = useEditorStore((s) => s.reorderCountries);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (filtering) {
    return (
      <>
        {countries.map(({ country, idx }) => (
          <CountryCard
            key={idx}
            country={country}
            index={idx}
            invalid={invalidCountries.has(idx)}
            defaultOpen={false}
          />
        ))}
      </>
    );
  }

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      reorderCountries(Number(active.id), Number(over.id));
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={countries.map((c) => c.idx)} strategy={verticalListSortingStrategy}>
        {countries.map(({ country, idx }) => (
          <SortableCountryCard
            key={idx}
            country={country}
            idx={idx}
            invalid={invalidCountries.has(idx)}
            defaultOpen={idx === 0}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}
