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
import { Plus, Calendar, Loader2, Pencil, Trash2, Search, BarChart3, Users, Trophy, FileText, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { format, differenceInDays, isPast, isToday } from 'date-fns';

// Helper to get deadline status info
const getDeadlineStatus = (deadline: string | null) => {
  if (!deadline) return null;
  
  const deadlineDate = new Date(deadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadlineDate.setHours(0, 0, 0, 0);
  
  const daysRemaining = differenceInDays(deadlineDate, today);
  
  if (isPast(deadlineDate) && !isToday(deadlineDate)) {
    return { days: Math.abs(daysRemaining), label: 'Overdue', variant: 'destructive' as const, isPast: true };
  }
  if (isToday(deadlineDate)) {
    return { days: 0, label: 'Today', variant: 'destructive' as const, isPast: false };
  }
  if (daysRemaining <= 3) {
    return { days: daysRemaining, label: `${daysRemaining}d left`, variant: 'destructive' as const, isPast: false };
  }
  if (daysRemaining <= 7) {
    return { days: daysRemaining, label: `${daysRemaining}d left`, variant: 'secondary' as const, isPast: false };
  }
  return { days: daysRemaining, label: `${daysRemaining}d left`, variant: 'outline' as const, isPast: false };
};

const eventSchema = z.object({
  name: z.string().min(2, 'Event name must be at least 2 characters'),
  description: z.string().optional(),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  registration_deadline: z.string().min(1, 'Registration deadline is required'),
  broadcast_deadline: z.string().optional(),
  accuscore_end_at: z.string().optional(),
  status: z.enum(['draft', 'registration_open', 'registration_closed', 'in_progress', 'completed', 'archived']),
  
});

type EventFormData = z.infer<typeof eventSchema>;

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  registration_open: 'Registration Open',
  registration_closed: 'Registration Closed',
  in_progress: 'In Progress',
  completed: 'Completed',
  archived: 'Archived',
};

const statusVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  registration_open: 'default',
  registration_closed: 'outline',
  in_progress: 'default',
  completed: 'secondary',
  archived: 'outline',
};

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
      registration_deadline: '',
      broadcast_deadline: '',
      accuscore_end_at: '',
      status: 'draft',
    },
  });


  const { data: events, isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          teams:teams(count)
        `)
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
        registration_deadline: data.registration_deadline,
        broadcast_deadline: data.broadcast_deadline || null,
        status: data.status,
        created_by: user!.id,
      }]);
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
        registration_deadline: data.registration_deadline,
        broadcast_deadline: data.broadcast_deadline || null,
        status: data.status,
      }).eq('id', id);
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
      registration_deadline: event.registration_deadline.split('T')[0],
      broadcast_deadline: event.broadcast_deadline || '',
      status: event.status,
    });
    setIsDialogOpen(true);
  };

  const handleNewEvent = () => {
    setEditingEvent(null);
    form.reset();
    setIsDialogOpen(true);
  };


  const getTeamsCount = (teams: any) => {
    if (Array.isArray(teams) && teams.length > 0 && teams[0]?.count !== undefined) {
      return teams[0].count;
    }
    return 0;
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
            <DialogContent className="max-w-lg">
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
                      name="registration_deadline"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Registration Deadline</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="broadcast_deadline"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Submission Deadline</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
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
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="registration_open">Registration Open</SelectItem>
                            <SelectItem value="registration_closed">Registration Closed</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
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
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="registration_open">Registration Open</SelectItem>
                    <SelectItem value="registration_closed">Registration Closed</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
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
                    <TableHead>Submission Deadline</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Scoring</TableHead>
                    <TableHead>Registrations</TableHead>
                    
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedEvents.map((event) => {
                    const teamsCount = getTeamsCount(event.teams);
                    
                    return (
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
                          {event.broadcast_deadline ? (
                            <div className="flex flex-col gap-1">
                              <span>{format(new Date(event.broadcast_deadline), 'MMM d, yyyy')}</span>
                              {(() => {
                                const status = getDeadlineStatus(event.broadcast_deadline);
                                if (!status) return null;
                                return (
                                  <Badge 
                                    variant={status.variant} 
                                    className={`text-xs w-fit ${status.isPast ? 'animate-pulse' : ''}`}
                                  >
                                    <Clock className="w-3 h-3 mr-1" />
                                    {status.label}
                                  </Badge>
                                );
                              })()}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariants[event.status]}>
                            {statusLabels[event.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Link to={`/admin/events/${event.id}/scoring`}>
                            <Badge variant="default" className="hover:bg-primary/80 cursor-pointer">
                              Scoring
                            </Badge>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link to={`/admin/events/${event.id}/registrations`}>
                            <Badge variant="default" className="hover:bg-primary/80 cursor-pointer">
                              {teamsCount} teams
                            </Badge>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" asChild title="Results">
                              <Link to={`/admin/events/${event.id}/results`}>
                                <Trophy className="w-4 h-4" />
                              </Link>
                            </Button>
                            <Button variant="ghost" size="sm" asChild title="Participants">
                              <Link to={`/admin/events/${event.id}/participants`}>
                                <Users className="w-4 h-4" />
                              </Link>
                            </Button>
                            <Button variant="ghost" size="sm" asChild title="Average Report">
                              <Link to={`/admin/events/${event.id}/reports`}>
                                <FileText className="w-4 h-4" />
                              </Link>
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(event)} title="Edit">
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
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
