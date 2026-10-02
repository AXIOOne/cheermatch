INSERT INTO public.event_accuscore_forms (event_id, form_id)
SELECT e.id, f.id FROM public.events e CROSS JOIN public.accuscore_forms f WHERE f.slug = 'general'
ON CONFLICT DO NOTHING;