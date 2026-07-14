-- Migration to add route_polyline column to carpool_posts table
ALTER TABLE public.carpool_posts
ADD COLUMN IF NOT EXISTS route_polyline text;
