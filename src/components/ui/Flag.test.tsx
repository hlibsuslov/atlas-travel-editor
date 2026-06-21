import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Flag } from './Flag';

describe('<Flag>', () => {
  it('resolves a known name to its circular flag SVG', () => {
    render(<Flag name="France" />);
    const img = screen.getByRole('img', { name: 'France' });
    // BASE_URL is '/' under vitest; the asset is the lowercased ISO code.
    expect(img).toHaveAttribute('src', '/flags/fr.svg');
    expect(img.tagName).toBe('IMG');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
  });

  it('prefers an explicit code over name resolution', () => {
    render(<Flag code="JP" name="France" />);
    expect(screen.getByRole('img')).toHaveAttribute('src', '/flags/jp.svg');
  });

  it('falls back to a tinted code disc for an unknown name', () => {
    render(<Flag name="Atlantis" />);
    // No <img>: the unknown name yields the fallback disc showing 2 letters.
    expect(screen.queryByRole('img', { name: 'Atlantis' })?.tagName).not.toBe('IMG');
    const disc = screen.getByRole('img', { name: 'Atlantis' });
    expect(disc).toHaveTextContent('AT');
    expect(disc).not.toHaveAttribute('src');
  });

  it('draws a status-coloured ring when a status is given', () => {
    const { container } = render(<Flag name="France" status="visited" />);
    const disc = container.querySelector('.flag') as HTMLElement;
    expect(disc.style.getPropertyValue('--flag-ring')).toBe('var(--c-visited)');
  });

  it('honours a custom size', () => {
    render(<Flag code="fr" size={48} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('width', '48');
    expect(img).toHaveAttribute('height', '48');
  });
});
