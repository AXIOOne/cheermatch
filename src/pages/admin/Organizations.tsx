import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Building2, Plus, Pencil, Trash2, Search, X, Loader2 } from 'lucide-react';
import { useOrganizations, type Organization } from '@/hooks/useOrganizations';
import { OrganizationDialog } from '@/components/admin/OrganizationDialog';

const sb = supabase as any;

export default function Organizations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Organization | null>(null);
  const [toDelete, setToDelete] = useState<Organization | null>(null);

  const { data: organizations, isLoading } = useOrganizations();

  const { data: counts } = useQuery({
    queryKey: ['organization-counts'],
    queryFn: async () => {
      const [{ data: profiles }, { data: teams }] = await Promise.all([
        sb.from('profiles').select('organization_id'),
        sb.from('teams').select('organization_id'),
      ]);
      const users: Record<string, number> = {};
      const teamCounts: Record<string, number> = {};
      (profiles || []).forEach((p: any) => {
        if (p.organization_id) users[p.organization_id] = (users[p.organization_id] || 0) + 1;
      });
      (teams || []).forEach((t: any) => {
        if (t.organization_id) teamCounts[t.organization_id] = (teamCounts[t.organization_id] || 0) + 1;
      });
      return { users, teams: teamCounts };
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (org: Organization) => {
      const userCount = counts?.users[org.id] || 0;
      const teamCount = counts?.teams[org.id] || 0;
      if (userCount > 0 || teamCount > 0) {
        throw new Error(
          `This organization still has ${userCount} user(s) and ${teamCount} team(s) assigned. Reassign them first.`
        );
      }
      const { error } = await sb.from('organizations').delete().eq('id', org.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['organization-counts'] });
      toast({ title: 'Organization deleted' });
      setToDelete(null);
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Cannot delete', description: e.message }),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (organizations || []).filter((o) =>
      q === '' ||
      o.name.toLowerCase().includes(q) ||
      (o.code || '').toLowerCase().includes(q) ||
      (o.contact_email || '').toLowerCase().includes(q) ||
      (o.city || '').toLowerCase().includes(q)
    );
  }, [organizations, search]);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Organizations</h1>
          <p className="text-muted-foreground mt-1">Gyms and programs that users and teams belong to</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Organization
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search organizations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-9"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Teams</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-medium">{org.name}</p>
                          {org.code && <p className="text-xs text-muted-foreground">{org.code}</p>}
                        </div>
                        {!org.is_active && <Badge variant="outline">Inactive</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{org.contact_name || '—'}</p>
                        <p className="text-muted-foreground">{org.contact_email || org.contact_phone || ''}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {[org.city, org.state].filter(Boolean).join(', ') || '—'}
                    </TableCell>
                    <TableCell>{counts?.users[org.id] || 0}</TableCell>
                    <TableCell>{counts?.teams[org.id] || 0}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => { setEditing(org); setDialogOpen(true); }}>
                          <Pencil className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setToDelete(org)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No organizations found.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <OrganizationDialog open={dialogOpen} onOpenChange={setDialogOpen} organization={editing} />

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete organization</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold">{toDelete?.name}</span>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(e) => { e.preventDefault(); if (toDelete) deleteMutation.mutate(toDelete); }}
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
