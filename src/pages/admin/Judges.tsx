import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { UserCheck, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';

import { EditUserDialog } from '@/components/admin/EditUserDialog';
import { useToast } from '@/hooks/use-toast';

interface JudgeWithProfile {
  id: string;
  user_id: string;
  role: string;
  profile: {
    user_id: string;
    email: string;
    full_name: string | null;
  } | null;
}

function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let p = '';
  for (let i = 0; i < 14; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p + '!9';
}

export default function Judges() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingJudge, setEditingJudge] = useState<{
    user_id: string;
    email: string;
    full_name: string | null;
  } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingJudge, setDeletingJudge] = useState<JudgeWithProfile | null>(null);
  const [deleting, setDeleting] = useState(false);


  const { data: judges, isLoading } = useQuery({
    queryKey: ['judges'],
    queryFn: async () => {
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('role', 'judge');

      if (roleError) throw roleError;
      if (!roleData || roleData.length === 0) return [];

      const userIds = roleData.map(r => r.user_id);
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, email, full_name')
        .in('user_id', userIds);

      if (profileError) throw profileError;

      return roleData.map(role => ({
        ...role,
        profile: profileData?.find(p => p.user_id === role.user_id) || null,
      })) as JudgeWithProfile[];
    },
  });

  const handleEditJudge = (judge: JudgeWithProfile) => {
    if (judge.profile) {
      setEditingJudge({
        user_id: judge.user_id,
        email: judge.profile.email,
        full_name: judge.profile.full_name,
      });
    }
  };

  const resetForm = () => {
    setFullName('');
    setEmail('');
  };

  const handleAddJudge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const password = generateTempPassword();
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: email.trim().toLowerCase(),
          password,
          fullName: fullName.trim() || null,
          role: 'judge',
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      toast({
        title: 'Judge added',
        description: `${email} can now sign in. Share the temporary password: ${password}`,
      });
      await queryClient.invalidateQueries({ queryKey: ['judges'] });
      resetForm();
      setAddOpen(false);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to add judge',
        description: err.message || 'Unknown error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteJudge = async () => {
    if (!deletingJudge) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId: deletingJudge.user_id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: 'Judge deleted' });
      await queryClient.invalidateQueries({ queryKey: ['judges'] });
      setDeletingJudge(null);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to delete judge',
        description: err.message || 'Unknown error',
      });
    } finally {
      setDeleting(false);
    }
  };


  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Judges</h1>
          <p className="text-muted-foreground mt-1">
            Judges are global logins. Assign them to panels inside each event's configuration.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add Judge
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : judges && judges.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {judges.map((judge) => (
                  <TableRow key={judge.id}>
                    <TableCell className="font-medium">
                      {judge.profile?.full_name || 'No name'}
                    </TableCell>
                    <TableCell>{judge.profile?.email}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditJudge(judge)}
                          title="Edit judge"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingJudge(judge)}
                          title="Delete judge"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>

                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <UserCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No judges yet.</p>
              <p className="text-sm mt-1">Click "Add Judge" to create the first one.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <EditUserDialog
        user={editingJudge}
        open={!!editingJudge}
        onOpenChange={(open) => !open && setEditingJudge(null)}
      />

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent>
          <form onSubmit={handleAddJudge}>
            <DialogHeader>
              <DialogTitle>Add Judge</DialogTitle>
              <DialogDescription>
                Creates a global judge login. A temporary password will be generated — share it with
                them and they can change it after first sign-in.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="judge-name">Full name</Label>
                <Input
                  id="judge-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Smith"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="judge-email">Email</Label>
                <Input
                  id="judge-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="judge@example.com"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !email.trim()}>
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Judge
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
