import { Check } from 'lucide-react';
import { STATUS_COLORS, type MapStatus } from '@/features/map/countryMatch';

interface StatusToggleProps {
  label: string;
  on: boolean;
  status: Exclude<MapStatus, 'none'>;
  onClick: () => void;
}

/**
 * Pill toggle whose accent is the status colour when active. Selection is signalled
 * by BOTH the status colour and a check mark (never colour alone), so the on/off
 * state is clear to colour-blind users and keyboard users alike. `aria-pressed`
 * mirrors the visual state for assistive tech.
 */
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
      <span className="sw" style={on ? { background: color } : undefined} aria-hidden="true" />
      <Check
        className="status-check"
        size={13}
        aria-hidden="true"
        style={on ? { color } : undefined}
      />
      {label}
    </button>
  );
}
