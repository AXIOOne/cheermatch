import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { UserCheck, Loader2, Pencil, CalendarPlus } from 'lucide-react';
import { EditUserDialog } from '@/components/admin/EditUserDialog';
import { JudgeAssignmentDialog } from '@/components/admin/JudgeAssignmentDialog';

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
  const [assigningJudge, setAssigningJudge] = useState<JudgeWithProfile | null>(null);

  const { data: judges, isLoading } = useQuery({
    queryKey: ['judges'],
    queryFn: async () => {
      // First get all judge user_ids
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('role', 'judge');
      
      if (roleError) throw roleError;
      if (!roleData || roleData.length === 0) return [];
      
      // Then get their profiles
      const userIds = roleData.map(r => r.user_id);
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, email, full_name')
        .in('user_id', userIds);
      
      if (profileError) throw profileError;
      
      // Combine the data
      return roleData.map(role => ({
        ...role,
        profile: profileData?.find(p => p.user_id === role.user_id) || null,
      })) as JudgeWithProfile[];
    },
  });

  const { data: assignments } = useQuery({
    queryKey: ['judge-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('judge_assignments')
        .select(`
          *,
          event:events(name),
          division:divisions(name),
          level:levels(name)
        `);
      if (error) throw error;
      return data;
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Judges</h1>
        <p className="text-muted-foreground mt-1">Manage judge accounts and assignments</p>
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
                  <TableHead>Assigned Events</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {judges.map((judge) => {
                  const judgeAssignments = assignments?.filter(a => a.judge_user_id === judge.user_id) || [];
                  return (
                    <TableRow key={judge.id}>
                      <TableCell className="font-medium">
                        {judge.profile?.full_name || 'No name'}
                      </TableCell>
                      <TableCell>{judge.profile?.email}</TableCell>
                      <TableCell>
                        {judgeAssignments.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {judgeAssignments.slice(0, 3).map((a) => (
                              <span key={a.id} className="px-2 py-0.5 bg-muted rounded-full text-xs">
                                {a.event?.name}
                              </span>
                            ))}
                            {judgeAssignments.length > 3 && (
                              <span className="text-xs text-muted-foreground">
                                +{judgeAssignments.length - 3} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">No assignments</span>
                        )}
                      </TableCell>
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
                            onClick={() => setAssigningJudge(judge)}
                            title="Manage assignments"
                          >
                            <CalendarPlus className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
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

      <JudgeAssignmentDialog
        judge={assigningJudge}
        open={!!assigningJudge}
        onOpenChange={(open) => !open && setAssigningJudge(null)}
      />
    </div>
  );
}
