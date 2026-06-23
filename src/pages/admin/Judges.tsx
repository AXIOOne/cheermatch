import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { UserCheck, Loader2, Pencil } from 'lucide-react';
import { EditUserDialog } from '@/components/admin/EditUserDialog';

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

export default function Judges() {
  const [editingJudge, setEditingJudge] = useState<{
    user_id: string;
    email: string;
    full_name: string | null;
  } | null>(null);

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

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Judges</h1>
          <p className="text-muted-foreground mt-1">
            Judges are global logins. Assign them to panels inside each event's configuration.
          </p>
        </div>
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditJudge(judge)}
                        title="Edit judge"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <UserCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No judges yet.</p>
              <p className="text-sm mt-1">Judges will appear here once they're assigned the judge role.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <EditUserDialog
        user={editingJudge}
        open={!!editingJudge}
        onOpenChange={(open) => !open && setEditingJudge(null)}
      />
    </div>
  );
}
