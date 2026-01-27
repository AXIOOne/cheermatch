import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Loader2 } from 'lucide-react';

export default function Teams() {
  const { data: teams, isLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select(`
          *,
          event:events(name),
          division:divisions(name),
          level:levels(name, level_number)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Teams</h1>
        <p className="text-muted-foreground mt-1">View all registered teams across events</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : teams && teams.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team Name</TableHead>
                  <TableHead>Gym</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Division</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Athletes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((team) => (
                  <TableRow key={team.id}>
                    <TableCell className="font-medium">{team.name}</TableCell>
                    <TableCell>{team.gym_name}</TableCell>
                    <TableCell>{team.event?.name}</TableCell>
                    <TableCell>{team.division?.name}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1">
                        <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                          {team.level?.level_number}
                        </span>
                        {team.level?.name}
                      </span>
                    </TableCell>
                    <TableCell>{team.athlete_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No teams registered yet.</p>
              <p className="text-sm mt-1">Teams will appear here once gyms register through the Coach Portal.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
