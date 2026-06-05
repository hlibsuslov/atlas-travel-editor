import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagList } from './TagList';
import { isValidTimelineString } from '@/domain/timeline';

const validator = (v: string) => (isValidTimelineString(v) ? null : 'Invalid format.');

describe('<TagList>', () => {
  it('renders existing items and an empty state', () => {
    const { rerender } = render(
      <TagList
        title="T"
        items={[]}
        placeholder="p"
        validate={validator}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText('—')).toBeInTheDocument();

    rerender(
      <TagList
        title="T"
        items={['2020']}
        placeholder="p"
        validate={validator}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText('2020')).toBeInTheDocument();
  });

  it('adds a valid value and clears the input', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(
      <TagList
        title="T"
        items={[]}
        placeholder="add"
        validate={validator}
        onAdd={onAdd}
        onRemove={vi.fn()}
      />,
    );
    const input = screen.getByPlaceholderText('add');
    await user.type(input, '2019{Enter}');
    expect(onAdd).toHaveBeenCalledWith('2019');
    expect(input).toHaveValue('');
  });

  it('blocks invalid values and shows an error instead of calling onAdd', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(
      <TagList
        title="T"
        items={[]}
        placeholder="add"
        validate={validator}
        onAdd={onAdd}
        onRemove={vi.fn()}
      />,
    );
    await user.type(screen.getByPlaceholderText('add'), 'nope{Enter}');
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByText('Invalid format.')).toBeInTheDocument();
  });

  it('removes an item by index', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(
      <TagList
        title="T"
        items={['2020']}
        placeholder="p"
        validate={validator}
        onAdd={vi.fn()}
        onRemove={onRemove}
      />,
    );
    await user.click(screen.getByLabelText('Delete'));
    expect(onRemove).toHaveBeenCalledWith(0);
  });
});
