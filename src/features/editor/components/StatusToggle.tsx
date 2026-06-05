import { STATUS_COLORS, type MapStatus } from '@/features/map/countryMatch';

interface StatusToggleProps {
  label: string;
  on: boolean;
  status: Exclude<MapStatus, 'none'>;
  onClick: () => void;
}

/** Pill toggle whose accent is the status color when active. */
export function StatusToggle({ label, on, status, onClick }: StatusToggleProps) {
  const color = STATUS_COLORS[status];
  return (
    <button
      type="button"
      aria-pressed={on}
      className={`status-toggle${on ? ' on' : ''}`}
      onClick={onClick}
      style={on ? { color, borderColor: color } : undefined}
    >
      <span className="sw" style={on ? { background: color } : undefined} />
      {label}
    </button>
  );
}
