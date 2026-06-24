import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, X } from 'lucide-react';
import type { AggregationMode } from '@/lib/scoring';

export interface FieldOption {
  temp_id: string;
  id?: string;
  label: string;
  value: number;
}

export interface SkillOption {
  temp_id: string;
  id?: string;
  label: string;
  value: number;
}

export interface DriverSkill {
  temp_id: string;
  id?: string;
  name: string;
  description?: string;
  options: SkillOption[];
}

export type ScoreType = 'difficulty' | 'execution';

export interface ScoringField {
  temp_id: string;
  id?: string;
  name: string;
  description?: string;
  field_type: 'number' | 'dropdown' | 'difficulty_driver';
  score_type: ScoreType;
  min_value: number;
  max_value: number;
  step: number;
  max_points: number;
  aggregation: AggregationMode;
  panels: string[]; // array of panel abbreviations
  options: FieldOption[];
  skills: DriverSkill[];
}

const DEFAULT_PANELS = ['B1', 'B2', 'T1', 'T2', 'OV', 'ALL'];

function tempId() {
  return `temp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function blankField(): ScoringField {
  return {
    temp_id: tempId(),
    name: '',
    field_type: 'number',
    score_type: 'difficulty',
    min_value: 0,
    max_value: 10,
    step: 0.25,
    max_points: 10,
    aggregation: 'average',
    panels: [],
    options: [],
    skills: [],
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: ScoringField | null;
  availablePanels?: string[]; // optional list from event judge_panels
  onSave: (field: ScoringField) => void;
}

export default function FieldBuilderDialog({ open, onOpenChange, initial, availablePanels, onSave }: Props) {
  const [draft, setDraft] = useState<ScoringField>(blankField());

  useEffect(() => {
    if (open) setDraft(initial
      ? {
          ...initial,
          options: [...initial.options],
          panels: [...initial.panels],
          skills: (initial.skills || []).map(sk => ({ ...sk, options: [...sk.options] })),
        }
      : blankField());
  }, [open, initial]);

  const panelChoices = (availablePanels && availablePanels.length > 0 ? availablePanels : DEFAULT_PANELS);

  const togglePanel = (abbr: string) => {
    setDraft(d => ({
      ...d,
      panels: d.panels.includes(abbr) ? d.panels.filter(p => p !== abbr) : [...d.panels, abbr],
    }));
  };

  const addOption = () => {
    setDraft(d => ({ ...d, options: [...d.options, { temp_id: tempId(), label: '', value: 0 }] }));
  };
  const updateOption = (idx: number, patch: Partial<FieldOption>) => {
    setDraft(d => {
      const next = [...d.options];
      next[idx] = { ...next[idx], ...patch };
      return { ...d, options: next };
    });
  };
  const removeOption = (idx: number) => {
    setDraft(d => ({ ...d, options: d.options.filter((_, i) => i !== idx) }));
  };

  // Skill helpers (for difficulty_driver fields)
  const addSkill = () => {
    setDraft(d => ({
      ...d,
      skills: [...d.skills, { temp_id: tempId(), name: '', options: [{ temp_id: tempId(), label: '', value: 0 }] }],
    }));
  };
  const updateSkill = (idx: number, patch: Partial<DriverSkill>) => {
    setDraft(d => {
      const next = [...d.skills];
      next[idx] = { ...next[idx], ...patch };
      return { ...d, skills: next };
    });
  };
  const removeSkill = (idx: number) => {
    setDraft(d => ({ ...d, skills: d.skills.filter((_, i) => i !== idx) }));
  };
  const addSkillOption = (skillIdx: number) => {
    setDraft(d => {
      const next = [...d.skills];
      next[skillIdx] = { ...next[skillIdx], options: [...next[skillIdx].options, { temp_id: tempId(), label: '', value: 0 }] };
      return { ...d, skills: next };
    });
  };
  const updateSkillOption = (skillIdx: number, optIdx: number, patch: Partial<SkillOption>) => {
    setDraft(d => {
      const skills = [...d.skills];
      const opts = [...skills[skillIdx].options];
      opts[optIdx] = { ...opts[optIdx], ...patch };
      skills[skillIdx] = { ...skills[skillIdx], options: opts };
      return { ...d, skills };
    });
  };
  const removeSkillOption = (skillIdx: number, optIdx: number) => {
    setDraft(d => {
      const skills = [...d.skills];
      skills[skillIdx] = { ...skills[skillIdx], options: skills[skillIdx].options.filter((_, i) => i !== optIdx) };
      return { ...d, skills };
    });
  };

  const save = () => {
    if (!draft.name.trim()) return;
    if (draft.field_type === 'dropdown' && draft.options.length === 0) return;
    if (draft.field_type === 'difficulty_driver') {
      if (draft.skills.length === 0) return;
      if (draft.skills.some(sk => !sk.name.trim() || sk.options.length === 0 || sk.options.some(o => !o.label.trim()))) return;
    }
    onSave(draft);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit Field' : 'Add Field'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Field Name</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft(d => ({ ...d, name: e.target.value }))}
                placeholder="e.g., Difficulty"
              />
            </div>
            <div className="col-span-2">
              <Label>Description (optional)</Label>
              <Input
                value={draft.description || ''}
                onChange={(e) => setDraft(d => ({ ...d, description: e.target.value }))}
                placeholder="What this field measures"
              />
            </div>
            <div>
              <Label>Field Type</Label>
              <Select
                value={draft.field_type}
                onValueChange={(v) => setDraft(d => ({ ...d, field_type: v as 'number' | 'dropdown' | 'difficulty_driver' }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="number">Number (+/-)</SelectItem>
                  <SelectItem value="dropdown">Dropdown</SelectItem>
                  <SelectItem value="difficulty_driver">Difficulty Driver (skills)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Score Type</Label>
              <Select
                value={draft.score_type}
                onValueChange={(v) => setDraft(d => ({ ...d, score_type: v as ScoreType }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="difficulty">Difficulty</SelectItem>
                  <SelectItem value="execution">Execution</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Max Points (contributes to row total)</Label>
              <Input
                type="number"
                step="0.01"
                value={draft.max_points}
                onChange={(e) => setDraft(d => ({ ...d, max_points: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          </div>




          {draft.field_type === 'number' && (
            <div className="grid grid-cols-3 gap-3 bg-muted/30 p-3 rounded-md">
              <div>
                <Label>Min</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={draft.min_value}
                  onChange={(e) => setDraft(d => ({ ...d, min_value: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <Label>Max</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={draft.max_value}
                  onChange={(e) => setDraft(d => ({ ...d, max_value: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <Label>Step</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={draft.step}
                  onChange={(e) => setDraft(d => ({ ...d, step: parseFloat(e.target.value) || 0.25 }))}
                />
              </div>
            </div>
          )}

          {draft.field_type === 'dropdown' && (
            <div className="space-y-2 bg-muted/30 p-3 rounded-md">
              <div className="flex items-center justify-between">
                <Label>Dropdown Options</Label>
                <Button type="button" size="sm" variant="outline" onClick={addOption}>
                  <Plus className="w-3 h-3 mr-1" /> Add Option
                </Button>
              </div>
              {draft.options.length === 0 && (
                <p className="text-xs text-muted-foreground">Add at least one option.</p>
              )}
              {draft.options.map((opt, idx) => (
                <div key={opt.temp_id} className="flex items-center gap-2">
                  <Input
                    placeholder="Label (e.g., Excellent)"
                    value={opt.label}
                    onChange={(e) => updateOption(idx, { label: e.target.value })}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Points"
                    value={opt.value}
                    onChange={(e) => updateOption(idx, { value: parseFloat(e.target.value) || 0 })}
                    className="w-28"
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeOption(idx)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label>Assigned Judge Panels</Label>
            <p className="text-xs text-muted-foreground">
              Pick which panel slots score this field. Pick 2+ for a multi-judge field.
            </p>
            <div className="flex flex-wrap gap-2">
              {panelChoices.map((abbr) => {
                const active = draft.panels.includes(abbr);
                return (
                  <button
                    key={abbr}
                    type="button"
                    onClick={() => togglePanel(abbr)}
                    className={
                      'px-3 py-1 rounded-full border text-sm transition ' +
                      (active
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:bg-muted')
                    }
                  >
                    {abbr}
                  </button>
                );
              })}
            </div>
            {draft.panels.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {draft.panels.map((p) => (
                  <Badge key={p} variant="secondary" className="gap-1">
                    {p}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => togglePanel(p)} />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {draft.panels.length > 1 && (
            <div>
              <Label>Aggregation across judges</Label>
              <Select
                value={draft.aggregation}
                onValueChange={(v) => setDraft(d => ({ ...d, aggregation: v as AggregationMode }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="average">Average</SelectItem>
                  <SelectItem value="trimmed_mean">Trimmed mean (drop high/low)</SelectItem>
                  <SelectItem value="min">Minimum</SelectItem>
                  <SelectItem value="max">Maximum</SelectItem>
                  <SelectItem value="sum">Sum</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={save}>{initial ? 'Save Field' : 'Add Field'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
