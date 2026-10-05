import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface AccuScoreField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'time' | 'number' | 'select' | 'radio' | 'checkbox' | 'checkbox-group' | 'skills';
  required?: boolean;
  options?: string[];
  help?: string;
}

export type AccuScoreAnswers = Record<string, string | string[]>;

/** Skill scripting rows are stored as "Skill name × count" strings. */
const SEP = ' × ';
export function parseSkillRow(row: string): { skill: string; count: string } {
  const i = row.lastIndexOf(SEP);
  return i < 0 ? { skill: row, count: '1' } : { skill: row.slice(0, i), count: row.slice(i + SEP.length) };
}
export const formatSkillRow = (skill: string, count: string) => `${skill}${SEP}${count}`;
/** Rows with a skill name filled in — used for required checks and submission. */
export const filledSkillRows = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v : []).filter((r) => parseSkillRow(r).skill.trim());

function SkillScripting({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const rows = (value.length ? value : [formatSkillRow('', '1')]).map(parseSkillRow);
  const emit = (next: { skill: string; count: string }[]) => onChange(next.map((r) => formatSkillRow(r.skill, r.count)));
  return (
    <div className="space-y-2">
      <div className="flex gap-2 pr-10">
        <span className="flex-1 text-xs font-medium text-muted-foreground">Skill</span>
        <span className="w-32 text-xs font-medium text-muted-foreground"># performed</span>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="flex gap-2">
          <Input className="flex-1" value={r.skill} placeholder={`Skill #${i + 1}`} maxLength={200}
            onChange={(e) => emit(rows.map((x, j) => (j === i ? { ...x, skill: e.target.value } : x)))} />
          <Input className="w-32" type="number" min={1} max={999} inputMode="numeric" placeholder="1" value={r.count}
            onChange={(e) => emit(rows.map((x, j) => (j === i ? { ...x, count: e.target.value } : x)))} />
          {rows.length > 1 ? (
            <Button type="button" variant="ghost" size="icon" onClick={() => emit(rows.filter((_, j) => j !== i))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : <span className="w-10" />}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" disabled={rows.length >= 50} onClick={() => emit([...rows, { skill: '', count: '1' }])}>
        <Plus className="mr-1 h-4 w-4" /> Add skill
      </Button>
    </div>
  );
}

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
          {f.type === 'skills' ? (
            <SkillScripting value={Array.isArray(answers[f.key]) ? answers[f.key] as string[] : []} onChange={(v) => onChange(f.key, v)} />
          ) : f.type === 'textarea' ? (
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
