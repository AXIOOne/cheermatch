import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Loader2, Trash2, Shield, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

const addRoleSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  role: z.enum(['admin', 'judge', 'gym_coach'] as const),
});

type AddRoleFormData = z.infer<typeof addRoleSchema>;

interface UserWithRoles {
  user_id: string;
  email: string;
  full_name: string | null;
  roles: AppRole[];
}

export default function UserRoles() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<AddRoleFormData>({
    resolver: zodResolver(addRoleSchema),
    defaultValues: {
      email: '',
      role: 'judge',
    },
  });

  // Fetch all users with their roles
  const { data: users, isLoading } = useQuery({
    queryKey: ['users-with-roles'],
    queryFn: async () => {
      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, email, full_name')
        .order('email');

      if (profilesError) throw profilesError;

      // Get all roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Combine profiles with roles
      const usersWithRoles: UserWithRoles[] = profiles.map((profile) => ({
        user_id: profile.user_id,
        email: profile.email,
        full_name: profile.full_name,
        roles: roles
          .filter((r) => r.user_id === profile.user_id)
          .map((r) => r.role),
      }));

      return usersWithRoles;
    },
  });

  const addRoleMutation = useMutation({
    mutationFn: async (data: AddRoleFormData) => {
      // First find the user by email
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', data.email)
        .single();

      if (profileError) {
        if (profileError.code === 'PGRST116') {
          throw new Error('No user found with this email address');
        }
        throw profileError;
      }

      // Add the role
      const { error } = await supabase.from('user_roles').insert({
        user_id: profile.user_id,
        role: data.role,
      });

      if (error) {
        if (error.code === '23505') {
          throw new Error('This user already has this role');
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast({ title: 'Role added successfully!' });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const removeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast({ title: 'Role removed successfully!' });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const handleSubmit = (data: AddRoleFormData) => {
    addRoleMutation.mutate(data);
  };

  const roleColors: Record<AppRole, string> = {
    admin: 'bg-red-100 text-red-700 border-red-200',
    judge: 'bg-blue-100 text-blue-700 border-blue-200',
    gym_coach: 'bg-green-100 text-green-700 border-green-200',
  };

  const roleLabels: Record<AppRole, string> = {
    admin: 'Admin',
    judge: 'Judge',
    gym_coach: 'Gym Coach',
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">User Roles</h1>
          <p className="text-muted-foreground mt-1">Manage user permissions and access levels</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="w-4 h-4 mr-2" />
              Add Role
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Role to User</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>User Email</FormLabel>
                      <FormControl>
                        <Input placeholder="user@example.com" type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="judge">Judge</SelectItem>
                          <SelectItem value="gym_coach">Gym Coach</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={addRoleMutation.isPending}>
                    {addRoleMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Add Role
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Admins</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {users?.filter((u) => u.roles.includes('admin')).length || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Judges</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {users?.filter((u) => u.roles.includes('judge')).length || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gym Coaches</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {users?.filter((u) => u.roles.includes('gym_coach')).length || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : users && users.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{user.full_name || 'No name'}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {user.roles.length > 0 ? (
                          user.roles.map((role) => (
                            <Badge
                              key={role}
                              variant="outline"
                              className={`${roleColors[role]} flex items-center gap-1`}
                            >
                              {roleLabels[role]}
                              <button
                                onClick={() => {
                                  if (confirm(`Remove ${roleLabels[role]} role from ${user.email}?`)) {
                                    removeRoleMutation.mutate({ userId: user.user_id, role });
                                  }
                                }}
                                className="ml-1 hover:text-destructive"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">No roles assigned</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          form.setValue('email', user.email);
                          setIsDialogOpen(true);
                        }}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Role
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No users found.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
