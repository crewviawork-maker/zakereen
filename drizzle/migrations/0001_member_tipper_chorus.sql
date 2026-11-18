ALTER TABLE public.members ADD COLUMN role text NOT NULL DEFAULT 'chorus';
ALTER TABLE public.members ADD CONSTRAINT members_role_check CHECK (role IN ('tipper', 'chorus'));
CREATE UNIQUE INDEX members_one_tipper_per_group ON public.members (group_id) WHERE role = 'tipper' AND group_id IS NOT NULL;