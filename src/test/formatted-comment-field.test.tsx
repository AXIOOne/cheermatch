import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormattedCommentField } from '@/components/ui/formatted-comment-field';

afterEach(cleanup);
describe('comment serialization', () => {
  it.each([
    ['line1<div>line2</div>', 'line1\nline2'],
    ['<div>line1</div><div>line2</div>', 'line1\nline2'],
    ['line1<div><br></div><div>line3</div>', 'line1\n\nline3'],
    ['<b>Great</b><div><u>Landing</u></div>', '**Great**\n__Landing__'],
    ['<ul><li>First point</li><li><b>Second</b> point</li></ul><div>Closing</div>', '• First point\n• **Second** point\nClosing'],
  ])('preserves line breaks in %s', (html, expected) => {
    const onChange = vi.fn();
    render(<FormattedCommentField value="" onChange={onChange} />);
    const editor = screen.getByRole('textbox');
    editor.innerHTML = html;
    fireEvent.input(editor);
    expect(onChange).toHaveBeenLastCalledWith(expected);
  });
  it('retains stored bullet comments when opened and edited', () => {
    const onChange = vi.fn();
    const value = 'Intro\n• **First** point\n• Second point\nClosing';
    render(<FormattedCommentField value={value} onChange={onChange} />);
    fireEvent.input(screen.getByRole('textbox'));
    expect(onChange).toHaveBeenLastCalledWith(value);
  });
});