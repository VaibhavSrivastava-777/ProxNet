-- Migration to set the default of active_location to 'home' and update existing users
ALTER TABLE public.users ALTER COLUMN active_location SET DEFAULT 'home';
UPDATE public.users SET active_location = 'home';
