import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Upload, Trash2, Eye, EyeOff } from 'lucide-react';
import { OrganizationCombobox } from '@/components/organization/OrganizationCombobox';
import { useOrganizations } from '@/hooks/useOrganizations';

const editUserSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  fullName: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional().or(z.literal('')),
  organizationId: z.string().optional(),
});

type EditUserFormData = z.infer<typeof editUserSchema>;

interface EditUserDialogProps {
  user: {
    user_id: string;
    email: string;
    full_name: string | null;
    avatar_url?: string | null;
    organization_id?: string | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function initialsOf(name: string | null, email: string): string {
  const src = (name || email || '').trim();
  if (!src) return '?';
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export function EditUserDialog({ user, open, onOpenChange }: EditUserDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarDirty, setAvatarDirty] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);


  useOrganizations({ activeOnly: true });

  const form = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: { email: '', fullName: '', password: '', organizationId: 'none' },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        email: user.email,
        fullName: user.full_name || '',
        password: '',
        organizationId: user.organization_id || 'none',
      });
      setAvatarUrl(user.avatar_url || null);
      setAvatarDirty(false);
    }
  }, [user, form]);

  const handlePickFile = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Invalid file', description: 'Please choose an image file.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'File too large', description: 'Avatar must be 5MB or smaller.' });
      return;
    }
    setUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = `avatars/${user.user_id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('email-assets')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('email-assets').getPublicUrl(path);
      setAvatarUrl(pub.publicUrl);
      setAvatarDirty(true);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Upload failed', description: err.message });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl(null);
    setAvatarDirty(true);
  };

  const updateUserMutation = useMutation({
    mutationFn: async (data: EditUserFormData) => {
      if (!user) throw new Error('No user selected');

      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('update-user', {
        body: {
          userId: user.user_id,
          email: data.email !== user.email ? data.email : undefined,
          fullName: data.fullName !== user.full_name ? data.fullName : undefined,
          password: data.password || undefined,
          avatarUrl: avatarDirty ? avatarUrl : undefined,
          organizationId:
            (data.organizationId === 'none' ? null : data.organizationId ?? null) !==
            (user.organization_id ?? null)
              ? data.organizationId === 'none'
                ? null
                : data.organizationId
              : undefined,
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      queryClient.invalidateQueries({ queryKey: ['coach-options'] });
      queryClient.invalidateQueries({ queryKey: ['organization-counts'] });
      toast({ title: 'User updated successfully!' });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const handleSubmit = (data: EditUserFormData) => {
    updateUserMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={avatarUrl || undefined} alt={user?.full_name || user?.email || ''} />
                <AvatarFallback className="text-lg">
                  {initialsOf(user?.full_name ?? null, user?.email ?? '')}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={handlePickFile} disabled={uploading}>
                    {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                    {avatarUrl ? 'Change' : 'Upload'}
                  </Button>
                  {avatarUrl && (
                    <Button type="button" variant="ghost" size="sm" onClick={handleRemoveAvatar} disabled={uploading}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">PNG or JPG, up to 5MB.</p>
              </div>
            </div>

            <FormField
              control={form.control}
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
              control={form.control}
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
              control={form.control}
              name="organizationId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Organization</FormLabel>
                  <FormControl>
                    <OrganizationCombobox
                      value={field.value || 'none'}
                      onChange={field.onChange}
                      placeholder="Select an organization"
                      allowNone
                      noneLabel="No organization"
                      activeOnly
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password (leave blank to keep current)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        placeholder="••••••••"
                        type={showPassword ? 'text' : 'password'}
                        className="pr-10"
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full w-10 text-muted-foreground hover:bg-transparent"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateUserMutation.isPending || uploading}>
                {updateUserMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
