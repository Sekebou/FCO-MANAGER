INSERT INTO public.app_config (key, value) VALUES ('min_version_ios', '1.0.0');
INSERT INTO public.app_config (key, value) VALUES ('min_version_android', '1.0.0');
DELETE FROM public.app_config WHERE key = 'min_version';