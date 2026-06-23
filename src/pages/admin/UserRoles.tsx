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
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Loader2, Trash2, Shield, UserPlus, UserRoundPlus, AlertTriangle, Pencil, Mail } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { EditUserDialog } from '@/components/admin/EditUserDialog';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

const addRoleSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  role: z.enum(['admin', 'portal_admin', 'judge', 'gym_coach'] as const),
});

const createUserSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(1, 'Full name is required'),
  role: z.enum(['admin', 'portal_admin', 'judge', 'gym_coach', 'none'] as const).optional(),
  sendEmail: z.boolean().default(true),
});

type AddRoleFormData = z.infer<typeof addRoleSchema>;
type CreateUserFormData = z.infer<typeof createUserSchema>;

interface UserWithRoles {
  user_id: string;
  email: string;
  full_name: string | null;
  roles: AppRole[];
}

export default function UserRoles() {
  const [isAddRoleDialogOpen, setIsAddRoleDialogOpen] = useState(false);
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserWithRoles | null>(null);
  const [userToEdit, setUserToEdit] = useState<UserWithRoles | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const addRoleForm = useForm<AddRoleFormData>({
    resolver: zodResolver(addRoleSchema),
    defaultValues: {
      email: '',
      role: 'judge',
    },
  });

  const createUserForm = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: '',
      password: '',
      fullName: '',
      role: 'none',
      sendEmail: true,
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
      setIsAddRoleDialogOpen(false);
      addRoleForm.reset();
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: CreateUserFormData) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('create-user', {
        body: {
          email: data.email,
          password: data.password,
          fullName: data.fullName,
          role: data.role === 'none' ? undefined : data.role,
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);

      // Send welcome email if requested
      if (data.sendEmail) {
        const loginUrl = `${window.location.origin}/auth`;
        
        const emailResponse = await supabase.functions.invoke('send-welcome-email', {
          body: {
            email: data.email,
            fullName: data.fullName,
            password: data.password,
            role: data.role === 'none' ? undefined : data.role,
            loginUrl,
          },
        });

        if (emailResponse.error) {
          console.error('Email error:', emailResponse.error);
          return { ...response.data, emailSent: false, emailError: emailResponse.error.message };
        }

        if (emailResponse.data?.error) {
          console.error('Email API error:', emailResponse.data.error);
          return { ...response.data, emailSent: false, emailError: emailResponse.data.error };
        }

        return { ...response.data, emailSent: true };
      }

      return { ...response.data, emailSent: false };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      
      if (result.emailSent) {
        toast({ title: 'User created and welcome email sent!' });
      } else if (result.emailError) {
        toast({ 
          title: 'User created, but email failed',
          description: result.emailError,
          variant: 'destructive',
        });
      } else {
        toast({ title: 'User created successfully!' });
      }
      
      setIsCreateUserDialogOpen(false);
      createUserForm.reset();
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

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('delete-user', {
        body: { userId },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast({ title: 'User deleted successfully!' });
      setUserToDelete(null);
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const resendInviteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const loginUrl = `${window.location.origin}/auth`;
      const response = await supabase.functions.invoke('resend-user-invite', {
        body: { userId, loginUrl },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      toast({ title: 'Invite resent', description: 'A new temporary password has been emailed.' });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Failed to resend invite', description: error.message });
    },
  });


  const handleAddRole = (data: AddRoleFormData) => {
    addRoleMutation.mutate(data);
  };

  const handleCreateUser = (data: CreateUserFormData) => {
    createUserMutation.mutate(data);
  };

  const roleColors: Record<AppRole, string> = {
    admin: 'bg-red-100 text-red-700 border-red-200',
    portal_admin: 'bg-purple-100 text-purple-700 border-purple-200',
    judge: 'bg-blue-100 text-blue-700 border-blue-200',
    gym_coach: 'bg-green-100 text-green-700 border-green-200',
  };

  const roleLabels: Record<AppRole, string> = {
    admin: 'Admin',
    portal_admin: 'Portal Admin',
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
        <div className="flex gap-2">
          <Dialog open={isCreateUserDialogOpen} onOpenChange={setIsCreateUserDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <UserRoundPlus className="w-4 h-4 mr-2" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
              </DialogHeader>
              <Form {...createUserForm}>
                <form onSubmit={createUserForm.handleSubmit(handleCreateUser)} className="space-y-4">
                  <FormField
                    control={createUserForm.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createUserForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="user@example.com" type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createUserForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input placeholder="••••••••" type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createUserForm.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Initial Role (Optional)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="No role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">No role</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="portal_admin">Portal Admin</SelectItem>
                            <SelectItem value="judge">Judge</SelectItem>
                            <SelectItem value="gym_coach">Gym Coach</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createUserForm.control}
                    name="sendEmail"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-3 space-y-0 rounded-lg border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="cursor-pointer">
                            Send welcome email
                          </FormLabel>
                          <p className="text-xs text-muted-foreground">
                            Email login credentials to the new user
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsCreateUserDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createUserMutation.isPending}>
                      {createUserMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      {createUserForm.watch('sendEmail') ? 'Create & Send Email' : 'Create User'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddRoleDialogOpen} onOpenChange={setIsAddRoleDialogOpen}>
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
              <Form {...addRoleForm}>
                <form onSubmit={addRoleForm.handleSubmit(handleAddRole)} className="space-y-4">
                  <FormField
                    control={addRoleForm.control}
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
                    control={addRoleForm.control}
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
                            <SelectItem value="portal_admin">Portal Admin</SelectItem>
                            <SelectItem value="judge">Judge</SelectItem>
                            <SelectItem value="gym_coach">Gym Coach</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsAddRoleDialogOpen(false)}>
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
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Portal Admins</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {users?.filter((u) => u.roles.includes('portal_admin')).length || 0}
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
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setUserToEdit(user)}
                        >
                          <Pencil className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            addRoleForm.setValue('email', user.email);
                            setIsAddRoleDialogOpen(true);
                          }}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add Role
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={resendInviteMutation.isPending && resendInviteMutation.variables === user.user_id}
                          onClick={() => {
                            if (confirm(`Resend invite email to ${user.email}? This generates a new temporary password.`)) {
                              resendInviteMutation.mutate(user.user_id);
                            }
                          }}
                        >
                          {resendInviteMutation.isPending && resendInviteMutation.variables === user.user_id ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <Mail className="w-4 h-4 mr-1" />
                          )}
                          Resend Invite
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setUserToDelete(user)}
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
              <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No users found.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Delete User
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete{' '}
              <span className="font-semibold">{userToDelete?.full_name || userToDelete?.email}</span>?
              <br /><br />
              This will remove their account, profile, and all assigned roles. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteUserMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteUserMutation.isPending}
              onClick={() => userToDelete && deleteUserMutation.mutate(userToDelete.user_id)}
            >
              {deleteUserMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit User Dialog */}
      <EditUserDialog
        user={userToEdit}
        open={!!userToEdit}
        onOpenChange={(open) => !open && setUserToEdit(null)}
      />
    </div>
  );
}
