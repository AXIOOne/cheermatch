import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Calendar, Loader2, Pencil, Trash2, Search, BarChart3, Users, Trophy, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const DISCIPLINES = [
  { value: 'allstar_cheer', label: 'All-Star Cheer' },
  { value: 'allstar_dance', label: 'All-Star Dance' },
  { value: 'nca_cheer', label: 'NCA Cheer' },
  { value: 'nca_dance', label: 'NCA Dance' },
  { value: 'uca_cheer', label: 'UCA Cheer' },
  { value: 'uca_dance', label: 'UCA Dance' },
  { value: 'usa_cheer', label: 'USA Cheer' },
  { value: 'usa_dance', label: 'USA Dance' },
] as const;

const disciplineLabel = (v: string | null | undefined) =>
  DISCIPLINES.find((d) => d.value === v)?.label ?? '—';

const TIME_ZONES: string[] = (() => {
  try {
    // @ts-ignore - supportedValuesOf is in modern runtimes
    const list = (Intl as any).supportedValuesOf?.('timeZone');
    if (Array.isArray(list) && list.length) return list as string[];
  } catch {}
  return [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Anchorage',
    'Pacific/Honolulu',
    'UTC',
  ];
})();

const eventSchema = z.object({
  name: z.string().min(2, 'Event name must be at least 2 characters'),
  description: z.string().optional(),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  time_zone: z.string().min(1, 'Time zone is required'),
  discipline: z.enum(['allstar_cheer','allstar_dance','nca_cheer','nca_dance','uca_cheer','uca_dance','usa_cheer','usa_dance']),
  accuscore_end_at: z.string().optional(),
  status: z.enum(['draft', 'registration_open', 'registration_closed', 'open_for_capture', 'open_for_scoring', 'in_progress', 'completed', 'archived']),
  duration_of_capture: z.coerce.number().int().min(15, 'Must be at least 15 seconds').max(900, 'Must be 900 seconds or less'),
  screen_capture_cnt: z.coerce.number().int().min(1, 'At least 1 attempt').max(5, 'At most 5 attempts'),
  registration_open_at: z.string().optional(),
  registration_close_at: z.string().optional(),
  submission_open_at: z.string().optional(),
  submission_close_at: z.string().optional(),
  scoring_open_at: z.string().optional(),
  scoring_close_at: z.string().optional(),
});

const toIso = (v?: string) => (v && v.trim() ? new Date(v).toISOString() : null);
const fromIso = (v?: string | null) =>
  v ? new Date(v).toISOString().slice(0, 16) : '';

type EventFormData = z.infer<typeof eventSchema>;

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  registration_open: 'Registration Open',
  registration_closed: 'Registration Closed',
  open_for_capture: 'Open for Capture',
  open_for_scoring: 'Open for Scoring',
  in_progress: 'In Progress',
  completed: 'Completed',
  archived: 'Archived',
};

const statusVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  registration_open: 'default',
  registration_closed: 'outline',
  open_for_capture: 'default',
  open_for_scoring: 'default',
  in_progress: 'default',
  completed: 'secondary',
  archived: 'outline',
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'registration_open', label: 'Registration Open' },
  { value: 'open_for_capture', label: 'Open for Capture' },
  { value: 'open_for_scoring', label: 'Open for Scoring' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
];


export default function Events() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      name: '',
      description: '',
      start_date: '',
      end_date: '',
      time_zone: 'America/New_York',
      discipline: 'allstar_cheer',
      accuscore_end_at: '',
      status: 'registration_open',
      duration_of_capture: 150,
      screen_capture_cnt: 2,
      registration_open_at: '',
      registration_close_at: '',
      submission_open_at: '',
      submission_close_at: '',
      scoring_open_at: '',
      scoring_close_at: '',
    },
  });


  const { data: events, isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Filter and search events
  const filteredEvents = useMemo(() => {
    if (!events) return [];
    
    return events.filter((event) => {
      const matchesStatus = statusFilter === 'all' || event.status === statusFilter;
      const matchesSearch = searchQuery === '' || 
        event.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [events, statusFilter, searchQuery]);

  // Pagination
  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEvents.slice(start, start + pageSize);
  }, [filteredEvents, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredEvents.length / pageSize);
  const startEntry = filteredEvents.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endEntry = Math.min(currentPage * pageSize, filteredEvents.length);

  // Reset to page 1 when filters change
  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value));
    setCurrentPage(1);
  };

  const createMutation = useMutation({
    mutationFn: async (data: EventFormData) => {
      const { error } = await supabase.from('events').insert([{
        name: data.name,
        description: data.description || null,
        start_date: data.start_date,
        end_date: data.end_date,
        time_zone: data.time_zone,
        discipline: data.discipline,
        accuscore_end_at: data.accuscore_end_at ? new Date(data.accuscore_end_at).toISOString() : null,
        status: data.status,
        duration_of_capture: data.duration_of_capture,
        screen_capture_cnt: data.screen_capture_cnt,
        registration_open_at: toIso(data.registration_open_at),
        registration_close_at: toIso(data.registration_close_at),
        submission_open_at: toIso(data.submission_open_at),
        submission_close_at: toIso(data.submission_close_at),
        scoring_open_at: toIso(data.scoring_open_at),
        scoring_close_at: toIso(data.scoring_close_at),
        created_by: user!.id,
      } as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({ title: 'Event created successfully!' });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EventFormData }) => {
      // Update event
      const { error } = await supabase.from('events').update({
        name: data.name,
        description: data.description || null,
        start_date: data.start_date,
        end_date: data.end_date,
        time_zone: data.time_zone,
        discipline: data.discipline,
        accuscore_end_at: data.accuscore_end_at ? new Date(data.accuscore_end_at).toISOString() : null,
        status: data.status,
        duration_of_capture: data.duration_of_capture,
        screen_capture_cnt: data.screen_capture_cnt,
        registration_open_at: toIso(data.registration_open_at),
        registration_close_at: toIso(data.registration_close_at),
        submission_open_at: toIso(data.submission_open_at),
        submission_close_at: toIso(data.submission_close_at),
        scoring_open_at: toIso(data.scoring_open_at),
        scoring_close_at: toIso(data.scoring_close_at),
      } as any).eq('id', id);
      if (error) throw error;

    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['all-scoring-templates'] });
      toast({ title: 'Event updated successfully!' });
      setIsDialogOpen(false);
      setEditingEvent(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('events').update({ status } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({ title: 'Status updated!' });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({ title: 'Event deleted successfully!' });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const handleSubmit = (data: EventFormData) => {
    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (event: any) => {
    setEditingEvent(event);
    form.reset({
      name: event.name,
      description: event.description || '',
      start_date: event.start_date,
      end_date: event.end_date,
      time_zone: event.time_zone || 'America/New_York',
      discipline: event.discipline || 'allstar_cheer',
      accuscore_end_at: event.accuscore_end_at
        ? new Date(event.accuscore_end_at).toISOString().slice(0, 16)
        : '',
      status: event.status,
      duration_of_capture: event.duration_of_capture ?? 150,
      screen_capture_cnt: event.screen_capture_cnt ?? 2,
      registration_open_at: fromIso(event.registration_open_at),
      registration_close_at: fromIso(event.registration_close_at),
      submission_open_at: fromIso(event.submission_open_at),
      submission_close_at: fromIso(event.submission_close_at),
      scoring_open_at: fromIso(event.scoring_open_at),
      scoring_close_at: fromIso(event.scoring_close_at),
    });
    setIsDialogOpen(true);
  };

  const handleNewEvent = () => {
    setEditingEvent(null);
    form.reset();
    setIsDialogOpen(true);
  };



  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Events</h1>
          <p className="text-muted-foreground mt-1">Manage your cheerleading competitions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/admin/events/summary">
              <BarChart3 className="w-4 h-4 mr-2" />
              Summary Report
            </Link>
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleNewEvent}>
                <Plus className="w-4 h-4 mr-2" />
                New Event
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingEvent ? 'Edit Event' : 'Create New Event'}</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Event Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Spring Championship 2026" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Event description..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="start_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="end_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="discipline"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Discipline</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a discipline" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {DISCIPLINES.map((d) => (
                                <SelectItem key={d.value} value={d.value}>
                                  {d.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="time_zone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Time Zone</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a time zone" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="max-h-80">
                              {TIME_ZONES.map((tz) => (
                                <SelectItem key={tz} value={tz}>
                                  {tz}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="accuscore_end_at"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>AccuScore Review Cutoff</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">When coaches can no longer request a scoresheet review.</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="duration_of_capture"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Capture Duration (seconds)</FormLabel>
                          <FormControl>
                            <Input type="number" min={15} max={900} {...field} />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">
                            Recording auto-stops after this many seconds. Default 150 (2:30).
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="screen_capture_cnt"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Capture Attempts</FormLabel>
                          <FormControl>
                            <Input type="number" min={1} max={5} {...field} />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">
                            Number of takes each team can record before choosing one to submit.
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Lifecycle windows */}
                  <div className="border-t pt-4 space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold">Lifecycle Windows</h3>
                      <p className="text-xs text-muted-foreground">
                        Optional. When set, these gate the registration / submission / scoring phases independently of Status.
                      </p>
                    </div>
                    {([
                      ['Registration', 'registration_open_at', 'registration_close_at'],
                      ['Submission', 'submission_open_at', 'submission_close_at'],
                      ['Scoring', 'scoring_open_at', 'scoring_close_at'],
                    ] as const).map(([label, openKey, closeKey]) => (
                      <div key={label} className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name={openKey as any}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{label} opens</FormLabel>
                              <FormControl><Input type="datetime-local" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={closeKey as any}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{label} closes</FormLabel>
                              <FormControl><Input type="datetime-local" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    ))}
                  </div>
                  <FormField
                    control={form.control}
                    name="status"

                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="registration_open">Registration Open</SelectItem>
                            <SelectItem value="open_for_capture">Open for Capture</SelectItem>
                            <SelectItem value="open_for_scoring">Open for Scoring</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="archived">Archived</SelectItem>

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
                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                      {(createMutation.isPending || updateMutation.isPending) && (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      )}
                      {editingEvent ? 'Update' : 'Create'} Event
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Status:</span>
                <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="registration_open">Registration Open</SelectItem>
                    <SelectItem value="open_for_capture">Open for Capture</SelectItem>
                    <SelectItem value="open_for_scoring">Open for Scoring</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>

                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Show:</span>
                <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">entries</span>
              </div>
            </div>
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9 w-full sm:w-[250px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : paginatedEvents && paginatedEvents.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event Name</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="font-medium">
                        <Link to={`/admin/events/${event.id}/registrations`} className="text-primary hover:underline">
                          {event.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {format(new Date(event.start_date), 'MMM d')} - {format(new Date(event.end_date), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Badge variant={statusVariants[event.status]} className="whitespace-nowrap cursor-pointer hover:opacity-80">
                              {statusLabels[event.status]}
                            </Badge>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            {STATUS_OPTIONS.map(({ value, label }) => (
                              <DropdownMenuItem
                                key={value}
                                onClick={() => updateStatusMutation.mutate({ id: event.id, status: value })}
                                className={value === event.status ? 'bg-accent' : ''}
                              >
                                {label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" asChild title="Scoring Control Panel">
                            <Link to={`/admin/events/${event.id}/scoring`}>
                              <BarChart3 className="w-4 h-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" asChild title="Registrations">
                            <Link to={`/admin/events/${event.id}/registrations`}>
                              <Users className="w-4 h-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" asChild title="Results">
                            <Link to={`/admin/events/${event.id}/results`}>
                              <Trophy className="w-4 h-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(event)} title="Edit Event">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this event?')) {
                                deleteMutation.mutate(event.id);
                              }
                            }}
                            title="Delete Event"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {startEntry} to {endEntry} of {filteredEvents.length} entries
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>
                {searchQuery || statusFilter !== 'all' 
                  ? 'No events match your filters.'
                  : 'No events yet. Create your first event to get started.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
