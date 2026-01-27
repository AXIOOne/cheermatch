-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'judge', 'gym_coach');

-- Create enum for event status
CREATE TYPE public.event_status AS ENUM ('draft', 'registration_open', 'registration_closed', 'in_progress', 'completed', 'archived');

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Create profiles table for additional user info
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    email TEXT NOT NULL,
    full_name TEXT,
    phone TEXT,
    organization_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create events table
CREATE TABLE public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    registration_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    status event_status NOT NULL DEFAULT 'draft',
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create divisions table
CREATE TABLE public.divisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    min_age INTEGER,
    max_age INTEGER,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create levels table
CREATE TABLE public.levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    level_number INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create scoring_templates table
CREATE TABLE public.scoring_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create scoring_categories table (rubric categories)
CREATE TABLE public.scoring_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES public.scoring_templates(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    max_points DECIMAL(5,2) NOT NULL,
    weight DECIMAL(3,2) NOT NULL DEFAULT 1.00,
    display_order INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create teams table
CREATE TABLE public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
    division_id UUID REFERENCES public.divisions(id) NOT NULL,
    level_id UUID REFERENCES public.levels(id) NOT NULL,
    name TEXT NOT NULL,
    gym_name TEXT NOT NULL,
    coach_user_id UUID REFERENCES auth.users(id) NOT NULL,
    athlete_count INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create judge_assignments table
CREATE TABLE public.judge_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
    judge_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    division_id UUID REFERENCES public.divisions(id),
    level_id UUID REFERENCES public.levels(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (event_id, judge_user_id, division_id, level_id)
);

-- Enable RLS on all tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.judge_assignments ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get user roles
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS SETOF app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
$$;

-- User roles policies
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Profiles policies
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Events policies
CREATE POLICY "Anyone can view non-draft events"
ON public.events FOR SELECT
USING (status != 'draft' OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage events"
ON public.events FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Divisions policies
CREATE POLICY "Anyone can view divisions of visible events"
ON public.divisions FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_id
    AND (e.status != 'draft' OR public.has_role(auth.uid(), 'admin'))
));

CREATE POLICY "Admins can manage divisions"
ON public.divisions FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Levels policies
CREATE POLICY "Anyone can view levels of visible events"
ON public.levels FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_id
    AND (e.status != 'draft' OR public.has_role(auth.uid(), 'admin'))
));

CREATE POLICY "Admins can manage levels"
ON public.levels FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Scoring templates policies
CREATE POLICY "Judges and admins can view scoring templates"
ON public.scoring_templates FOR SELECT
USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'judge')
);

CREATE POLICY "Admins can manage scoring templates"
ON public.scoring_templates FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Scoring categories policies
CREATE POLICY "Judges and admins can view scoring categories"
ON public.scoring_categories FOR SELECT
USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'judge')
);

CREATE POLICY "Admins can manage scoring categories"
ON public.scoring_categories FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Teams policies
CREATE POLICY "Coaches can view their own teams"
ON public.teams FOR SELECT
USING (coach_user_id = auth.uid());

CREATE POLICY "Coaches can manage their own teams"
ON public.teams FOR ALL
USING (coach_user_id = auth.uid());

CREATE POLICY "Admins can view all teams"
ON public.teams FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all teams"
ON public.teams FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Judges can view teams in their assignments"
ON public.teams FOR SELECT
USING (
    public.has_role(auth.uid(), 'judge') AND
    EXISTS (
        SELECT 1 FROM public.judge_assignments ja
        WHERE ja.judge_user_id = auth.uid()
        AND ja.event_id = teams.event_id
        AND (ja.division_id IS NULL OR ja.division_id = teams.division_id)
        AND (ja.level_id IS NULL OR ja.level_id = teams.level_id)
    )
);

-- Judge assignments policies
CREATE POLICY "Judges can view their own assignments"
ON public.judge_assignments FOR SELECT
USING (judge_user_id = auth.uid());

CREATE POLICY "Admins can manage judge assignments"
ON public.judge_assignments FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updating updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_events_updated_at
BEFORE UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_teams_updated_at
BEFORE UPDATE ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scoring_templates_updated_at
BEFORE UPDATE ON public.scoring_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signup (creates profile automatically)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email)
    VALUES (NEW.id, NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-create profile on signup
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();