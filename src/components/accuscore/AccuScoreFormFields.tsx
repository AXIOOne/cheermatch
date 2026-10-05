import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface AccuScoreField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'time' | 'number' | 'select' | 'radio' | 'checkbox' | 'checkbox-group';
  required?: boolean;
  options?: string[];
  help?: string;
}

export type AccuScoreAnswers = Record<string, string | string[]>;

interface Props {
  fields: AccuScoreField[];
  answers: AccuScoreAnswers;
  onChange: (key: string, value: string | string[]) => void;
}

/**
 * Renders AccuScore form questions exactly as coaches see them on the
 * review page. Shared by ScoreReview (coach page) and the admin form
 * preview so the two can never drift apart.
 */
export function AccuScoreFormFields({ fields, answers, onChange }: Props) {
  return (
    <>
      {fields.map((f, i) => (
        <div key={f.key || i} className="space-y-1">
          <Label>{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
          {f.type === 'textarea' ? (
            <Textarea rows={4} value={typeof answers[f.key] === 'string' ? answers[f.key] : ''} onChange={(e) => onChange(f.key, e.target.value)} maxLength={4000} />
          ) : f.type === 'checkbox' ? (
            <label className="flex items-start gap-2 rounded-md border p-3 cursor-pointer">
              <Checkbox
                checked={answers[f.key] === 'Acknowledged'}
                onCheckedChange={(checked) => onChange(f.key, checked ? 'Acknowledged' : '')}
                className="mt-0.5"
              />
              <span className="text-sm">I acknowledge this statement</span>
            </label>
          ) : f.type === 'checkbox-group' ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {(f.options || []).map((option) => {
                const selected = Array.isArray(answers[f.key]) ? answers[f.key] as string[] : [];
                return (
                  <label key={option} className="flex items-start gap-2 rounded-md border p-3 cursor-pointer">
                    <Checkbox
                      checked={selected.includes(option)}
                      onCheckedChange={(checked) => onChange(f.key, checked ? [...selected, option] : selected.filter((item) => item !== option))}
                      className="mt-0.5"
                    />
                    <span className="text-sm">{option}</span>
                  </label>
                );
              })}
            </div>
          ) : f.type === 'radio' ? (
            <RadioGroup value={typeof answers[f.key] === 'string' ? answers[f.key] as string : ''} onValueChange={(v) => onChange(f.key, v)}>
              {(f.options || []).map((option) => (
                <label key={option} className="flex items-center gap-2 rounded-md border p-3 cursor-pointer">
                  <RadioGroupItem value={option} />
                  <span className="text-sm">{option}</span>
                </label>
              ))}
            </RadioGroup>
          ) : f.type === 'select' ? (
            <Select value={typeof answers[f.key] === 'string' ? answers[f.key] as string : ''} onValueChange={(v) => onChange(f.key, v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{(f.options || []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
            </Select>
          ) : (
            <Input
              value={typeof answers[f.key] === 'string' ? answers[f.key] : ''}
              onChange={(e) => onChange(f.key, e.target.value)}
              placeholder={f.type === 'time' ? 'mm:ss' : undefined}
              inputMode={f.type === 'number' ? 'decimal' : undefined}
              maxLength={500}
            />
          )}
          {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
        </div>
      ))}
    </>
  );
}
