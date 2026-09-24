import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Bold, Italic, Underline, SpellCheck2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function markersToHtml(text: string) {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<u>$1</u>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\r?\n/g, '<br>');
}

function nodeToMarkers(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
  if (!(node instanceof HTMLElement)) return '';

  const tag = node.tagName.toLowerCase();
  if (tag === 'br') return '\n';

  let content = Array.from(node.childNodes).map(nodeToMarkers).join('');
  if (tag === 'strong' || tag === 'b') content = `**${content}**`;
  if (tag === 'em' || tag === 'i') content = `*${content}*`;
  if (tag === 'u') content = `__${content}__`;
  if ((tag === 'div' || tag === 'p') && node.nextSibling && !content.endsWith('\n')) content += '\n';
  return content;
}

function editorToMarkers(editor: HTMLElement) {
  return Array.from(editor.childNodes).map(nodeToMarkers).join('').replace(/\u00a0/g, ' ');
}

interface FormattedCommentFieldProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  className?: string;
  toolbarClassName?: string;
}

export const FormattedCommentField = forwardRef<HTMLDivElement, FormattedCommentFieldProps>(
  ({ value, onChange, placeholder, disabled, rows = 3, toolbarClassName, className }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const lastEmitted = useRef(value);
    const [spellCheck, setSpellCheck] = useState(true);
    useImperativeHandle(ref, () => editorRef.current as HTMLDivElement);

    useEffect(() => {
      const editor = editorRef.current;
      if (!editor || value === lastEmitted.current) return;
      editor.innerHTML = markersToHtml(value);
      lastEmitted.current = value;
    }, [value]);

    const emitChange = () => {
      const editor = editorRef.current;
      if (!editor) return;
      const next = editorToMarkers(editor);
      lastEmitted.current = next;
      onChange(next);
    };

    const format = (command: 'bold' | 'italic' | 'underline') => {
      const editor = editorRef.current;
      if (!editor || disabled) return;
      editor.focus();
      document.execCommand(command, false);
      emitChange();
    };

    return (
      <div className="space-y-1.5">
        <div className={cn('flex items-center gap-1 flex-wrap', toolbarClassName)}>
          <Button type="button" size="sm" variant="outline" className="h-7 w-7 p-0"
            onMouseDown={(event) => event.preventDefault()} onClick={() => format('bold')}
            disabled={disabled} title="Bold (Ctrl+B)" aria-label="Bold">
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-7 w-7 p-0"
            onMouseDown={(event) => event.preventDefault()} onClick={() => format('italic')}
            disabled={disabled} title="Italic (Ctrl+I)" aria-label="Italic">
            <Italic className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-7 w-7 p-0"
            onMouseDown={(event) => event.preventDefault()} onClick={() => format('underline')}
            disabled={disabled} title="Underline (Ctrl+U)" aria-label="Underline">
            <Underline className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" size="sm" variant={spellCheck ? 'secondary' : 'outline'} className="h-7 w-7 p-0"
            onClick={() => setSpellCheck((current) => !current)} disabled={disabled}
            title="Toggle spell check" aria-label="Toggle spell check">
            <SpellCheck2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div
          ref={editorRef}
          role="textbox"
          aria-multiline="true"
          aria-label={placeholder || 'Formatted comment'}
          data-placeholder={placeholder}
          contentEditable={!disabled}
          suppressContentEditableWarning
          spellCheck={spellCheck}
          onInput={emitChange}
          onBlur={emitChange}
          className={cn(
            'min-h-20 w-full overflow-y-auto rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
            'empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            disabled && 'cursor-not-allowed opacity-50',
            className,
          )}
          style={{ minHeight: `${Math.max(rows, 3) * 1.5 + 1}rem` }}
          dangerouslySetInnerHTML={{ __html: markersToHtml(value) }}
        />
      </div>
    );
  },
);
FormattedCommentField.displayName = 'FormattedCommentField';