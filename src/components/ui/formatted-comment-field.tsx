import { forwardRef, useRef, useImperativeHandle } from 'react';
import { Bold, Italic, Underline, SpellCheck2 } from 'lucide-react';
import { Textarea, type TextareaProps } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type WrapKind = 'bold' | 'italic' | 'underline';

const WRAPPERS: Record<WrapKind, string> = {
  bold: '**',
  italic: '*',
  underline: '__',
};

interface FormattedCommentFieldProps extends Omit<TextareaProps, 'onChange' | 'value'> {
  value: string;
  onChange: (next: string) => void;
  toolbarClassName?: string;
}

export const FormattedCommentField = forwardRef<HTMLTextAreaElement, FormattedCommentFieldProps>(
  ({ value, onChange, disabled, toolbarClassName, className, ...rest }, ref) => {
    const innerRef = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement);

    const applyWrap = (kind: WrapKind) => {
      const el = innerRef.current;
      if (!el) return;
      const marker = WRAPPERS[kind];
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      const before = value.slice(0, start);
      const selected = value.slice(start, end) || 'text';
      const after = value.slice(end);
      const next = `${before}${marker}${selected}${marker}${after}`;
      onChange(next);
      requestAnimationFrame(() => {
        el.focus();
        const cursorStart = start + marker.length;
        const cursorEnd = cursorStart + selected.length;
        el.setSelectionRange(cursorStart, cursorEnd);
      });
    };

    const toggleSpellcheck = () => {
      const el = innerRef.current;
      if (!el) return;
      const current = el.getAttribute('spellcheck') !== 'false';
      el.setAttribute('spellcheck', current ? 'false' : 'true');
      // Force re-evaluation by blurring + refocusing
      el.blur();
      requestAnimationFrame(() => el.focus());
    };

    return (
      <div className="space-y-1.5">
        <div className={cn('flex items-center gap-1 flex-wrap', toolbarClassName)}>
          <Button type="button" size="sm" variant="outline" className="h-7 w-7 p-0"
            onClick={() => applyWrap('bold')} disabled={disabled} title="Bold (**text**)">
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-7 w-7 p-0"
            onClick={() => applyWrap('italic')} disabled={disabled} title="Italic (*text*)">
            <Italic className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-7 w-7 p-0"
            onClick={() => applyWrap('underline')} disabled={disabled} title="Underline (__text__)">
            <Underline className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-7 w-7 p-0"
            onClick={toggleSpellcheck} disabled={disabled} title="Toggle spell check">
            <SpellCheck2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Textarea
          ref={innerRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          spellCheck
          className={className}
          {...rest}
        />
      </div>
    );
  },
);
FormattedCommentField.displayName = 'FormattedCommentField';
