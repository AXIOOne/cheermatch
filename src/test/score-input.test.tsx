import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScoreInput } from '@/components/ui/score-input';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
afterEach(cleanup);

function ScoringForm() {
  const [value, setValue] = useState(5);
  const [invalid, setInvalid] = useState(new Set<string>());
  return <>
    <ScoreInput value={value} onChange={setValue} min={2} max={10}
      onError={(error) => setInvalid(previous => {
        const next = new Set(previous);
        if (error) next.add('score'); else next.delete('score');
        return next;
      })} />
    <button disabled={invalid.size > 0}>Submit</button>
  </>;
}

describe('score input validation', () => {
  it('settles with an inline callback that creates new parent state', () => {
    render(<ScoringForm />);
    expect(screen.getByLabelText('Score value')).toHaveValue('5.0');
    expect(screen.getByText('Submit')).toBeEnabled();
  });

  it.each(['11', '1'])('keeps out-of-range %s visible and blocks submit after blur', (text) => {
    render(<ScoringForm />);
    const input = screen.getByLabelText('Score value');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: text } });
    fireEvent.blur(input);
    expect(input).toHaveValue(text);
    expect(screen.getByText('Submit')).toBeDisabled();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '7' } });
    fireEvent.blur(input);
    expect(input).toHaveValue('7.0');
    expect(screen.getByText('Submit')).toBeEnabled();
  });
});