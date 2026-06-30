import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldName: string;
  currentPoints: number;
  maxPoints: number;
  onConfirm: (reason: string) => Promise<void>;
}

export default function ScoreFieldOverrideDialog({
  open, onOpenChange, fieldName, currentPoints, maxPoints, onConfirm,
}: Props) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setReason(''); setSaving(false); } }, [open]);

  const handleConfirm = async () => {
    if (!reason.trim()) return;
    setSaving(true);
    try {
      await onConfirm(reason.trim());
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            Override score to 0
          </DialogTitle>
          <DialogDescription>
            This will set <strong>{fieldName}</strong> from{' '}
            <strong>{Number(currentPoints).toFixed(2)}</strong> to <strong>0</strong> (max {Number(maxPoints).toFixed(2)}).
            The original score and your reason are logged.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium">Reason for override <span className="text-destructive">*</span></label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Skill not performed, illegal element, judge error confirmed by head judge..."
            rows={4}
            maxLength={500}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={saving || !reason.trim()}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Set to 0
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
