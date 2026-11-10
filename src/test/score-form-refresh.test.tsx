import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useScoreFormInitialization } from '@/hooks/useScoreFormInitialization';

afterEach(cleanup);
function Form({ scope, ready = true, saved, locked = false }: { scope: string | null; ready?: boolean; saved: string; locked?: boolean }) {
  const [value, setValue] = useState('');
  useScoreFormInitialization(scope, ready, () => setValue(saved));
  return <input aria-label="score draft" value={value} disabled={locked} onChange={e => setValue(e.target.value)} />;
}
describe('scoring form refresh protection', () => {
  it('retains unsaved scores, deductions, selections and comments on same-context refresh', () => {
    const ui = render(<Form scope="judge/team/panel/template/fields" saved="saved draft" />);
    fireEvent.change(screen.getByLabelText('score draft'), { target: { value: '7.5; deduction=1; skill=option2; notes=keep\ncomments' } });
    ui.rerender(<Form scope="judge/team/panel/template/fields" saved="older server draft" />);
    expect(screen.getByLabelText('score draft')).toHaveValue('7.5; deduction=1; skill=option2; notes=keep\ncomments'.replace('\n', ''));
  });
  it('waits for the saved draft before initializing', () => {
    const ui = render(<Form scope="team/panel" ready={false} saved="" />);
    ui.rerender(<Form scope="team/panel" ready saved="8.5" />);
    expect(screen.getByLabelText('score draft')).toHaveValue('8.5');
  });
  it.each(['other-team/panel', 'team/other-panel', 'team/panel/new-template', 'other-judge/team/panel'])('loads fresh state for %s', scope => {
    const ui = render(<Form scope="team/panel" saved="8" />);
    fireEvent.change(screen.getByLabelText('score draft'), { target: { value: '9' } });
    ui.rerender(<Form scope={scope} saved="4" />);
    expect(screen.getByLabelText('score draft')).toHaveValue('4');
  });
  it('still applies a live admin lock without overwriting entered values', () => {
    const ui = render(<Form scope="team/panel" saved="8" />);
    fireEvent.change(screen.getByLabelText('score draft'), { target: { value: '9' } });
    ui.rerender(<Form scope="team/panel" saved="admin score" locked />);
    expect(screen.getByLabelText('score draft')).toBeDisabled();
    expect(screen.getByLabelText('score draft')).toHaveValue('9');
  });
  it('reloads saved values after explicitly closing and reopening the admin dialog', () => {
    const ui = render(<Form scope="team/panel" saved="8" />);
    ui.rerender(<Form scope={null} saved="8" />);
    ui.rerender(<Form scope="team/panel" saved="6" />);
    expect(screen.getByLabelText('score draft')).toHaveValue('6');
  });
});