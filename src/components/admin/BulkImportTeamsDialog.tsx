import { useState, useMemo } from 'react';
import Papa from 'papaparse';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, FileText, AlertTriangle, Download } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
}

type CsvRow = {
  team_name?: string;
  gym_name?: string;
  division?: string;
  level?: string;
  athletes_male?: string;
  athletes_female?: string;
  coach_name?: string;
  coach_email?: string;
  coach_phone?: string;
  coach_password?: string;
};

type ParsedRow = {
  raw: CsvRow;
  errors: string[];
  orgAction?: 'existing' | 'create';
  coachAction?: 'create' | 'reset';
  payload?: {
    team_name: string; gym_name: string; division_id: string; level_id: string;
    athletes_male: number; athletes_female: number;
    coach_name: string | null; coach_email: string; coach_phone: string | null;
    coach_password: string;
  };
};

type ImportSummary = {
  teamsImported: number;
  organizationsCreated: number;
  coachesCreated: number;
  coachPasswordsReset: number;
  failures: { row: string; message: string }[];
};

const SAMPLE_HEADERS = [
  'team_name','gym_name','division','level','athletes_male','athletes_female','coach_name','coach_email','coach_phone','coach_password'
];

export function BulkImportTeamsDialog({ open, onOpenChange, eventId }: Props) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: divisions } = useQuery({
    queryKey: ['divisions-for-import'],
    queryFn: async () => {
      const { data, error } = await supabase.from('divisions').select('id, name');
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: levels } = useQuery({
    queryKey: ['levels-for-import'],
    queryFn: async () => {
      const { data, error } = await supabase.from('levels').select('id, name');
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: existingTeams } = useQuery({
    queryKey: ['teams-for-import', eventId],
    queryFn: async () => {
      const { data, error } = await supabase.from('teams').select('name').eq('event_id', eventId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });
  const { data: existingOrgs } = useQuery({
    queryKey: ['orgs-for-import'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('organizations').select('id, name');
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
    enabled: open,
  });
  const { data: existingCoaches } = useQuery({
    queryKey: ['coach-emails-for-import'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('email');
      if (error) throw error;
      return (data ?? []) as { email: string | null }[];
    },
    enabled: open,
  });

  const validate = (parsed: CsvRow[]): ParsedRow[] => {
    const divMap = new Map((divisions ?? []).map(d => [d.name.toLowerCase(), d.id]));
    const lvlMap = new Map((levels ?? []).map(l => [l.name.toLowerCase(), l.id]));
    const existing = new Set((existingTeams ?? []).map(t => t.name.toLowerCase()));
    const orgSet = new Set((existingOrgs ?? []).map(o => o.name.trim().toLowerCase()));
    const coachSet = new Set((existingCoaches ?? []).map(c => (c.email || '').trim().toLowerCase()).filter(Boolean));
    const seen = new Set<string>();
    const passwordByEmail = new Map<string, string>();

    return parsed.map(raw => {
      const errors: string[] = [];
      const teamName = (raw.team_name || '').trim();
      const gymName = (raw.gym_name || '').trim();
      const division = (raw.division || '').trim();
      const level = (raw.level || '').trim();
      const coachEmail = (raw.coach_email || '').trim().toLowerCase();
      const coachPassword = (raw.coach_password || '').trim();
      const male = Number(raw.athletes_male ?? 0);
      const female = Number(raw.athletes_female ?? 0);

      if (!teamName) errors.push('team_name required');
      if (!gymName) errors.push('gym_name required');
      if (!division) errors.push('division required');
      else if (!divMap.has(division.toLowerCase())) errors.push(`unknown division "${division}"`);
      if (!level) errors.push('level required');
      else if (!lvlMap.has(level.toLowerCase())) errors.push(`unknown level "${level}"`);
      if (!coachEmail) errors.push('coach_email required');
      if (!coachPassword) errors.push('coach_password required');
      else if (coachPassword.length < 8) errors.push('coach_password must be at least 8 characters');
      if (coachEmail && coachPassword) {
        const prior = passwordByEmail.get(coachEmail);
        if (prior && prior !== coachPassword) errors.push('conflicting passwords for same coach_email');
        else passwordByEmail.set(coachEmail, coachPassword);
      }
      if (teamName && existing.has(teamName.toLowerCase())) errors.push('team name already exists');
      if (teamName && seen.has(teamName.toLowerCase())) errors.push('duplicate in CSV');
      if (teamName) seen.add(teamName.toLowerCase());
      if (!Number.isFinite(male) || male < 0) errors.push('athletes_male invalid');
      if (!Number.isFinite(female) || female < 0) errors.push('athletes_female invalid');

      const orgAction: 'existing' | 'create' | undefined = gymName
        ? (orgSet.has(gymName.toLowerCase()) ? 'existing' : 'create')
        : undefined;
      const coachAction: 'create' | 'reset' | undefined = coachEmail
        ? (coachSet.has(coachEmail) ? 'reset' : 'create')
        : undefined;

      const payload = errors.length === 0 ? {
        team_name: teamName,
        gym_name: gymName,
        division_id: divMap.get(division.toLowerCase())!,
        level_id: lvlMap.get(level.toLowerCase())!,
        athletes_male: Number.isFinite(male) ? male : 0,
        athletes_female: Number.isFinite(female) ? female : 0,
        coach_name: (raw.coach_name || '').trim() || null,
        coach_email: coachEmail,
        coach_phone: (raw.coach_phone || '').trim() || null,
        coach_password: coachPassword,
      } : undefined;

      return { raw, errors, orgAction, coachAction, payload };
    });
  };

  const handleFile = (file: File) => {
    setFileName(file.name);
    setSummary(null);
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
      complete: (results) => {
        setRows(validate(results.data));
      },
      error: (err) => toast({ variant: 'destructive', title: 'CSV error', description: err.message }),
    });
  };

  const valid = useMemo(() => rows.filter(r => r.errors.length === 0), [rows]);
  const invalid = useMemo(() => rows.filter(r => r.errors.length > 0), [rows]);

  const importMutation = useMutation({
    mutationFn: async () => {
      if (valid.length === 0) throw new Error('No valid rows to import');
      const { data, error } = await supabase.functions.invoke('import-registrations', {
        body: { eventId, rows: valid.map(r => r.payload!) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.summary as ImportSummary;
    },
    onSuccess: (result) => {
      setSummary(result);
      toast({ title: `Imported ${result.teamsImported} teams` });
      queryClient.invalidateQueries({ queryKey: ['event-teams', eventId] });
      queryClient.invalidateQueries({ queryKey: ['coach-account-status', eventId] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      setRows([]);
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Import failed', description: e.message }),
  });

  const downloadSample = () => {
    const csv = SAMPLE_HEADERS.join(',') + '\n' +
      'Team Spirit,Elite Gym,Senior 5,Level 5,18,4,Jane Coach,jane@example.com,555-1212,ChangeMe123\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'teams-import-sample.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => { setRows([]); setFileName(''); setSummary(null); };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Bulk import teams</DialogTitle>
          <DialogDescription>
            Upload a CSV with columns: {SAMPLE_HEADERS.join(', ')}. Missing gyms are created as organizations, and coach
            accounts are created (or their password reset) using the password in the file.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            <Button variant="outline" onClick={downloadSample} type="button">
              <Download className="w-4 h-4 mr-2" /> Sample
            </Button>
          </div>

          {summary && (
            <div className="rounded border p-3 text-sm space-y-1">
              <div className="font-medium">Import complete</div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{summary.teamsImported} teams imported</Badge>
                <Badge variant="secondary">{summary.organizationsCreated} organizations created</Badge>
                <Badge variant="secondary">{summary.coachesCreated} coach accounts created</Badge>
                <Badge variant="secondary">{summary.coachPasswordsReset} passwords reset</Badge>
              </div>
              {summary.failures.length > 0 && (
                <ul className="mt-2 space-y-1 text-destructive text-xs">
                  {summary.failures.map((f, i) => <li key={i}>{f.row}: {f.message}</li>)}
                </ul>
              )}
            </div>
          )}

          {fileName && !summary && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="w-4 h-4" /> {fileName} — {rows.length} rows
              <Badge variant="default" className="bg-green-600 ml-2">{valid.length} valid</Badge>
              {invalid.length > 0 && <Badge variant="destructive">{invalid.length} errors</Badge>}
            </div>
          )}
          {rows.length > 0 && (
            <div className="max-h-80 overflow-auto border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team</TableHead>
                    <TableHead>Gym</TableHead>
                    <TableHead>Org</TableHead>
                    <TableHead>Division</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Coach</TableHead>
                    <TableHead>Coach account</TableHead>
                    <TableHead>Issues</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i} className={r.errors.length ? 'bg-destructive/5' : ''}>
                      <TableCell>{r.raw.team_name}</TableCell>
                      <TableCell>{r.raw.gym_name}</TableCell>
                      <TableCell className="text-xs">
                        {r.orgAction === 'create'
                          ? <Badge variant="outline">will create</Badge>
                          : r.orgAction === 'existing' ? <span className="text-muted-foreground">existing</span> : '—'}
                      </TableCell>
                      <TableCell>{r.raw.division}</TableCell>
                      <TableCell>{r.raw.level}</TableCell>
                      <TableCell className="text-xs">{r.raw.coach_email}</TableCell>
                      <TableCell className="text-xs">
                        {r.coachAction === 'create'
                          ? <Badge variant="outline">create account</Badge>
                          : r.coachAction === 'reset' ? <span className="text-muted-foreground">reset password</span> : '—'}
                      </TableCell>
                      <TableCell>
                        {r.errors.length > 0 ? (
                          <span className="text-destructive text-xs inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> {r.errors.join('; ')}
                          </span>
                        ) : <span className="text-green-600 text-xs">OK</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button
            onClick={() => importMutation.mutate()}
            disabled={importMutation.isPending || valid.length === 0}
          >
            {importMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            <Upload className="w-4 h-4 mr-2" />
            Import {valid.length} team{valid.length === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
