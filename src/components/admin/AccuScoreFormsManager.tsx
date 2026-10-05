import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, Trash2, ArrowUp, ArrowDown, Copy, Eye } from 'lucide-react';
import type { AccuScoreField } from '@/pages/review/ScoreReview';
import { AccuScoreFormFields, type AccuScoreAnswers } from '@/components/accuscore/AccuScoreFormFields';

const TYPES: { value: AccuScoreField['type']; label: string }[] = [
  { value: 'text', label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'time', label: 'Time (video timestamp)' },
  { value: 'select', label: 'Drop-down' },
  { value: 'radio', label: 'Single choice (radio)' },
  { value: 'checkbox-group', label: 'Multiple choice (checkboxes)' },
  { value: 'checkbox', label: 'Acknowledgment checkbox' },
];
const HAS_OPTIONS = ['select', 'radio', 'checkbox-group'];

interface Form {
  id?: string;
  name: string;
  slug: string;
  description: string | null;
  fields: AccuScoreField[];
  display_order: number;
  is_active: boolean;
}

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function AccuScoreFormsManager() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState<Form | null>(null);
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [previewAnswers, setPreviewAnswers] = useState<AccuScoreAnswers>({});

  const { data: forms, isLoading } = useQuery({
    queryKey: ['accuscore-forms-admin'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('accuscore_forms').select('*').order('display_order').order('name');
      if (error) throw error;
      return data as Form[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['accuscore-forms-admin'] });

  const toggleActive = async (f: Form, v: boolean) => {
    const { error } = await (supabase as any).from('accuscore_forms').update({ is_active: v }).eq('id', f.id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const remove = async (f: Form) => {
    const { count } = await (supabase as any).from('accuscore_requests').select('id', { count: 'exact', head: true }).eq('form_id', f.id);
    if (count) return toast.error(`This form has ${count} request(s). Turn it off instead of deleting.`);
    if (!confirm(`Delete "${f.name}"?`)) return;
    await (supabase as any).from('event_accuscore_forms').delete().eq('form_id', f.id);
    const { error } = await (supabase as any).from('accuscore_forms').delete().eq('id', f.id);
    if (error) return toast.error(error.message);
    toast.success('Form deleted');
    refresh();
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) return toast.error('Form name is required');
    const fields = editing.fields.map((f) => ({
      ...f,
      key: f.key || slugify(f.label).replace(/-/g, '_') || `field_${Math.random().toString(36).slice(2, 7)}`,
      options: HAS_OPTIONS.includes(f.type) ? (f.options || []).map((o) => o.trim()).filter(Boolean) : undefined,
    }));
    if (fields.some((f) => !f.label.trim())) return toast.error('Every question needs a label');
    if (fields.some((f) => HAS_OPTIONS.includes(f.type) && !f.options?.length)) return toast.error('Choice questions need at least one option');
    const keys = fields.map((f) => f.key);
    if (new Set(keys).size !== keys.length) return toast.error('Two questions share the same label — make them unique');
    setSaving(true);
    const payload = {
      name: editing.name.trim(),
      slug: editing.slug || slugify(editing.name),
      description: editing.description || null,
      fields,
      display_order: editing.display_order,
      is_active: editing.is_active,
    };
    const q = editing.id
      ? (supabase as any).from('accuscore_forms').update(payload).eq('id', editing.id)
      : (supabase as any).from('accuscore_forms').insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Form saved');
    setEditing(null);
    refresh();
  };

  const updField = (i: number, patch: Partial<AccuScoreField>) =>
    setEditing((e) => e && { ...e, fields: e.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) });
  const move = (i: number, d: number) =>
    setEditing((e) => {
      if (!e) return e;
      const arr = [...e.fields];
      const j = i + d;
      if (j < 0 || j >= arr.length) return e;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...e, fields: arr };
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Forms coaches can fill out. Turn forms on per event in the event editor.</p>
        <Button size="sm" onClick={() => setEditing({ name: '', slug: '', description: '', fields: [], display_order: (forms?.length || 0) + 1, is_active: true })}>
          <Plus className="w-4 h-4 mr-1" /> New form
        </Button>
      </div>
      <Card>
        <CardContent className="p-0 divide-y">
          {isLoading && <Loader2 className="m-6 w-5 h-5 animate-spin text-primary" />}
          {forms?.map((f) => (
            <div key={f.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{f.name}</p>
                <p className="text-xs text-muted-foreground">{f.fields.length} questions</p>
              </div>
              {!f.is_active && <Badge variant="outline">Off</Badge>}
              <Switch checked={f.is_active} onCheckedChange={(v) => toggleActive(f, v)} aria-label="Active" />
              <Button variant="ghost" size="icon" aria-label="Preview as coach" onClick={() => { setPreviewAnswers({}); setPreviewing(f); }}><Eye className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" aria-label="Duplicate" onClick={() => setEditing({ ...f, id: undefined, slug: '', name: `${f.name} (copy)` })}><Copy className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => { setShowLivePreview(false); setEditing(structuredClone(f)); }}><Pencil className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => remove(f)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className={`${showLivePreview ? 'max-w-6xl' : 'max-w-3xl'} max-h-[90vh] overflow-y-auto`}>
          <DialogHeader>
            <div className="flex items-center justify-between gap-3 pr-6">
              <DialogTitle>{editing?.id ? 'Edit form' : 'New form'}</DialogTitle>
              <Button variant="outline" size="sm" onClick={() => { setPreviewAnswers({}); setShowLivePreview((v) => !v); }}>
                <Eye className="w-4 h-4 mr-1" /> {showLivePreview ? 'Hide preview' : 'Preview as coach'}
              </Button>
            </div>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-[1fr_120px] gap-3">
                <div><Label>Form name</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
                <div><Label>Order</Label><Input type="number" value={editing.display_order} onChange={(e) => setEditing({ ...editing, display_order: Number(e.target.value) || 0 })} /></div>
              </div>
              <div><Label>Instructions for coaches</Label><Textarea rows={3} value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>

              <div className="space-y-3">
                <Label>Questions</Label>
                {editing.fields.map((f, i) => (
                  <Card key={i}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex gap-2 items-start">
                        <span className="text-xs text-muted-foreground mt-2.5 w-5">{i + 1}.</span>
                        <Textarea rows={1} className="flex-1 min-h-9" placeholder="Question" value={f.label} onChange={(e) => updField(i, { label: e.target.value })} />
                        <Select value={f.type} onValueChange={(v) => updField(i, { type: v as AccuScoreField['type'] })}>
                          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                          <SelectContent>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => move(i, 1)} disabled={i === editing.fields.length - 1}><ArrowDown className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setEditing({ ...editing, fields: editing.fields.filter((_, j) => j !== i) })}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                      <div className="pl-7 space-y-2">
                        <Input placeholder="Help text (optional)" value={f.help || ''} onChange={(e) => updField(i, { help: e.target.value })} />
                        {HAS_OPTIONS.includes(f.type) && (
                          <Textarea rows={3} placeholder="Options — one per line" value={(f.options || []).join('\n')} onChange={(e) => updField(i, { options: e.target.value.split('\n') })} />
                        )}
                        <label className="flex items-center gap-2 text-sm">
                          <Switch checked={!!f.required} onCheckedChange={(v) => updField(i, { required: v })} /> Required
                        </label>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <Button variant="outline" size="sm" onClick={() => setEditing({ ...editing, fields: [...editing.fields, { key: '', label: '', type: 'text' }] })}>
                  <Plus className="w-4 h-4 mr-1" /> Add question
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Save form</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
