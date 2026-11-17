CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX groups_name_unique ON public.groups (lower(btrim(name)));
GRANT ALL ON public.groups TO service_role;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  its_id text NOT NULL UNIQUE,
  phone text NOT NULL,
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX members_group_idx ON public.members (group_id);
GRANT ALL ON public.members TO service_role;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mohalla text NOT NULL,
  address text NOT NULL,
  timing time NOT NULL,
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX locations_unique_slot ON public.locations (lower(btrim(mohalla)), lower(btrim(address)), timing);
CREATE UNIQUE INDEX locations_group_timing_unique ON public.locations (group_id, timing) WHERE group_id IS NOT NULL;
GRANT ALL ON public.locations TO service_role;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;