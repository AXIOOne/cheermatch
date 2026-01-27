import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Settings as SettingsIcon, Users, Shield, Bell, Loader2 } from 'lucide-react';

export default function Settings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [securityDialogOpen, setSecurityDialogOpen] = useState(false);
  const [notificationsDialogOpen, setNotificationsDialogOpen] = useState(false);
  const [integrationsDialogOpen, setIntegrationsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Security settings state
  const [requireStrongPassword, setRequireStrongPassword] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState('60');

  // Notification settings state
  const [emailNewSubmission, setEmailNewSubmission] = useState(true);
  const [emailReviewRequest, setEmailReviewRequest] = useState(true);
  const [emailScoreComplete, setEmailScoreComplete] = useState(false);

  // Integration settings state
  const [brightcoveAccountId, setBrightcoveAccountId] = useState('');
  const [brightcoveApiKey, setBrightcoveApiKey] = useState('');

  const handleSaveSettings = (type: string) => {
    setSaving(true);
    // Simulate saving
    setTimeout(() => {
      setSaving(false);
      toast({ title: `${type} settings saved!` });
      if (type === 'Security') setSecurityDialogOpen(false);
      if (type === 'Notification') setNotificationsDialogOpen(false);
      if (type === 'Integration') setIntegrationsDialogOpen(false);
    }, 500);
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage platform settings and configurations</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">User Management</CardTitle>
                <CardDescription>Invite users and manage roles</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Add new admins, judges, and gym owners to the platform.
            </p>
            <Button variant="outline" onClick={() => navigate('/admin/roles')}>
              Manage Users
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Security</CardTitle>
                <CardDescription>Password and authentication settings</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Configure security policies and authentication requirements.
            </p>
            <Button variant="outline" onClick={() => setSecurityDialogOpen(true)}>
              Security Settings
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bell className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Notifications</CardTitle>
                <CardDescription>Email and notification preferences</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Set up email notifications for events and score updates.
            </p>
            <Button variant="outline" onClick={() => setNotificationsDialogOpen(true)}>
              Notification Settings
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <SettingsIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Integrations</CardTitle>
                <CardDescription>Brightcove and external services</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Configure Brightcove video integration and other services.
            </p>
            <Button variant="outline" onClick={() => setIntegrationsDialogOpen(true)}>
              Configure Integrations
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Security Settings Dialog */}
      <Dialog open={securityDialogOpen} onOpenChange={setSecurityDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Security Settings</DialogTitle>
            <DialogDescription>Configure authentication and security policies</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Require Strong Passwords</Label>
                <p className="text-sm text-muted-foreground">
                  Minimum 8 characters with uppercase, lowercase, and numbers
                </p>
              </div>
              <Switch
                checked={requireStrongPassword}
                onCheckedChange={setRequireStrongPassword}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
              <Input
                id="sessionTimeout"
                type="number"
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(e.target.value)}
                className="w-32"
              />
              <p className="text-sm text-muted-foreground">
                Auto-logout after inactivity period
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSecurityDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => handleSaveSettings('Security')} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Notifications Settings Dialog */}
      <Dialog open={notificationsDialogOpen} onOpenChange={setNotificationsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notification Settings</DialogTitle>
            <DialogDescription>Configure email notification preferences</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>New Video Submissions</Label>
                <p className="text-sm text-muted-foreground">
                  Email when a team submits a new video
                </p>
              </div>
              <Switch
                checked={emailNewSubmission}
                onCheckedChange={setEmailNewSubmission}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Review Requests</Label>
                <p className="text-sm text-muted-foreground">
                  Email when a coach requests a score review
                </p>
              </div>
              <Switch
                checked={emailReviewRequest}
                onCheckedChange={setEmailReviewRequest}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Scoring Complete</Label>
                <p className="text-sm text-muted-foreground">
                  Email when all judges finish scoring a submission
                </p>
              </div>
              <Switch
                checked={emailScoreComplete}
                onCheckedChange={setEmailScoreComplete}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setNotificationsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => handleSaveSettings('Notification')} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Integrations Settings Dialog */}
      <Dialog open={integrationsDialogOpen} onOpenChange={setIntegrationsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Integration Settings</DialogTitle>
            <DialogDescription>Configure external service connections</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <h4 className="font-medium">Brightcove Video Platform</h4>
              <div className="space-y-2">
                <Label htmlFor="brightcoveAccountId">Account ID</Label>
                <Input
                  id="brightcoveAccountId"
                  placeholder="Enter your Brightcove account ID"
                  value={brightcoveAccountId}
                  onChange={(e) => setBrightcoveAccountId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brightcoveApiKey">API Key</Label>
                <Input
                  id="brightcoveApiKey"
                  type="password"
                  placeholder="Enter your Brightcove API key"
                  value={brightcoveApiKey}
                  onChange={(e) => setBrightcoveApiKey(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIntegrationsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => handleSaveSettings('Integration')} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
