create table public.property_analytics (
  id bigserial not null,
  property_id uuid not null,
  user_id uuid null,
  session_id text not null,
  user_email text null,
  user_first_name text null,
  user_last_name text null,
  user_phone text null,
  property_address text not null,
  property_price numeric null,
  view_start_time timestamp with time zone null default now(),
  view_end_time timestamp with time zone null,
  duration_seconds integer null,
  page_views integer null default 1,
  scrolled_to_bottom boolean null default false,
  viewed_description boolean null default false,
  viewed_repairs boolean null default false,
  viewed_photos boolean null default false,
  clicked_more_photos boolean null default false,
  clicked_share boolean null default false,
  zoomed_map boolean null default false,
  referrer text null,
  user_agent text null,
  ip_address inet null,
  device_type text null,
  viewport_width integer null,
  viewport_height integer null,
  country text null,
  region text null,
  city text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  utm_source text null,
  images_viewed integer null default 0,
  full_view_achieved boolean null default false,
  active_time_seconds integer null default 0,
  tab_switches integer null default 0,
  last_active_time timestamp with time zone null,
  is_special_link_access boolean null default false,
  utm_code text null,
  contact_status text null default 'not_contacted'::text,
  contacted_at timestamp with time zone null,
  contacted_by text null,
  contact_notes text null,
  constraint property_analytics_pkey primary key (id),
  constraint property_analytics_contact_status_check check (
    (
      contact_status = any (array['contacted'::text, 'not_contacted'::text])
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_property_analytics_property_id on public.property_analytics using btree (property_id) TABLESPACE pg_default;

create index IF not exists idx_property_analytics_user_id on public.property_analytics using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_property_analytics_session_id on public.property_analytics using btree (session_id) TABLESPACE pg_default;

create index IF not exists idx_property_analytics_created_at on public.property_analytics using btree (created_at desc) TABLESPACE pg_default;

create index IF not exists idx_property_analytics_view_start on public.property_analytics using btree (view_start_time desc) TABLESPACE pg_default;

create index IF not exists idx_property_analytics_duration on public.property_analytics using btree (duration_seconds desc) TABLESPACE pg_default;

create unique INDEX IF not exists idx_property_analytics_unique_daily_session on public.property_analytics using btree (
  property_id,
  session_id,
  date ((created_at AT TIME ZONE 'UTC'::text))
) TABLESPACE pg_default;

create index IF not exists idx_property_analytics_special_link on public.property_analytics using btree (is_special_link_access) TABLESPACE pg_default
where
  (is_special_link_access = true);

create index IF not exists idx_property_analytics_utm_code on public.property_analytics using btree (utm_code) TABLESPACE pg_default
where
  (utm_code is not null);

create index IF not exists idx_property_analytics_contact_status on public.property_analytics using btree (contact_status) TABLESPACE pg_default;

create index IF not exists idx_property_analytics_property_contact on public.property_analytics using btree (property_id, contact_status) TABLESPACE pg_default;

create trigger update_property_analytics_updated_at BEFORE
update on property_analytics for EACH row
execute FUNCTION update_updated_at_column ();


DATA IN PROPERTY ANALYSIS: 


INSERT INTO "public"."property_analytics" ("id", "property_id", "user_id", "session_id", "user_email", "user_first_name", "user_last_name", "user_phone", "property_address", "property_price", "view_start_time", "view_end_time", "duration_seconds", "page_views", "scrolled_to_bottom", "viewed_description", "viewed_repairs", "viewed_photos", "clicked_more_photos", "clicked_share", "zoomed_map", "referrer", "user_agent", "ip_address", "device_type", "viewport_width", "viewport_height", "country", "region", "city", "created_at", "updated_at", "utm_source", "images_viewed", "full_view_achieved", "active_time_seconds", "tab_switches", "last_active_time", "is_special_link_access", "utm_code", "contact_status", "contacted_at", "contacted_by", "contact_notes") VALUES ('329', '2b09da5e-d747-4e44-8bb2-6f2fc83e2f3c', '1244fd90-27e4-48e2-b972-7134c7a39b67', 'session_1770999223856_vlx3hvfhi', 'yousaf.zhd3@gmail.com', 'yousaf', 'zahid', '(330) 439-0232', '1134 Ogle Rd', '124900', '2026-02-13 16:13:44.951464+00', null, null, '10', 'false', 'false', 'false', 'false', 'false', 'false', 'false', 'https://deelmap-production-16a1.up.railway.app/2b09da5e-d747-4e44-8bb2-6f2fc83e2f3c', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '39.59.24.87', 'desktop', '1662', '940', null, null, null, '2026-02-13 16:13:44.951464+00', '2026-02-13 16:23:16.190275+00', null, '0', 'false', '35', '0', '2026-02-13 16:23:16.148+00', 'false', null, 'not_contacted', null, null, null), ('330', '2b09da5e-d747-4e44-8bb2-6f2fc83e2f3c', 'bbbefeb5-e951-4de1-89e5-4a90d5308a5e', 'session_1770999251123_ysang6e7j', 'info@airosofts.com', 'Jeffery', 'Anderson', '(432) 323-2324', '1134 Ogle Rd', '124900', '2026-02-13 16:14:21.948006+00', null, null, '9', 'true', 'false', 'false', 'true', 'false', 'false', 'false', 'https://deelmap-production-16a1.up.railway.app/2b09da5e-d747-4e44-8bb2-6f2fc83e2f3c', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '39.59.24.87', 'desktop', '1496', '846', null, null, null, '2026-02-13 16:14:21.948006+00', '2026-02-13 16:18:33.710615+00', null, '0', 'false', '21', '0', '2026-02-13 16:18:33.715+00', 'false', null, 'not_contacted', null, null, null), ('340', '2b09da5e-d747-4e44-8bb2-6f2fc83e2f3c', '1244fd90-27e4-48e2-b972-7134c7a39b67', 'session_1770999452216_toe6tdus6', 'yousaf.zhd3@gmail.com', 'yousaf', 'zahid', '(330) 439-0232', '1134 Ogle Rd', '124900', '2026-02-13 16:17:42.778117+00', '2026-02-13 16:20:57.996+00', '77', '3', 'false', 'false', 'false', 'true', 'false', 'false', 'false', 'http://localhost:3000/2b09da5e-d747-4e44-8bb2-6f2fc83e2f3c', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', '::1', 'desktop', '1710', '951', null, null, null, '2026-02-13 16:17:42.778117+00', '2026-02-13 16:20:58.298914+00', null, '0', 'false', '80', '0', '2026-02-13 16:20:57.914+00', 'false', null, 'not_contacted', null, null, null);


create table public.page_visits (
  id bigserial not null,
  session_id text not null,
  user_id uuid null,
  user_email text null,
  page_url text not null,
  page_title text null,
  property_id uuid null,
  property_address text null,
  time_spent_seconds integer null,
  scroll_depth_percent integer null,
  device_type text null,
  referrer text null,
  visited_at timestamp with time zone null default now(),
  left_at timestamp with time zone null,
  constraint page_visits_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_page_visits_session_id on public.page_visits using btree (session_id) TABLESPACE pg_default;

create index IF not exists idx_page_visits_visited_at on public.page_visits using btree (visited_at) TABLESPACE pg_default;

create index IF not exists idx_page_visits_property_id on public.page_visits using btree (property_id) TABLESPACE pg_default;

DATA: 

INSERT INTO "public"."page_visits" ("id", "session_id", "user_id", "user_email", "page_url", "page_title", "property_id", "property_address", "time_spent_seconds", "scroll_depth_percent", "device_type", "referrer", "visited_at", "left_at") VALUES ('413', 'live_1770998935406_pt2l1pkuz', '1244fd90-27e4-48e2-b972-7134c7a39b67', 'yousaf.zhd3@gmail.com', '/marketplace', '1134 Ogle Rd, O''Fallon, IL 62269, USA - $124,900', '2b09da5e-d747-4e44-8bb2-6f2fc83e2f3c', '1134 Ogle Rd, O''Fallon, IL 62269, USA', '3', '0', 'desktop', '', '2026-02-13 16:13:44.771599+00', '2026-02-13 16:13:44.079+00'), ('414', 'live_1770739514609_mvx02nbe5', null, null, '/', 'DeelMap - Property Deals Marketplace', null, null, '20', '0', 'desktop', 'https://deelmap-production-16a1.up.railway.app/our-story', '2026-02-13 16:13:46.791545+00', '2026-02-13 16:13:46.785+00'), ('415', 'live_1770739514609_mvx02nbe5', null, null, '/join-seller', 'DeelMap - Property Deals Marketplace', null, null, '4', '0', 'desktop', 'https://deelmap-production-16a1.up.railway.app/our-story', '2026-02-13 16:13:50.312059+00', '2026-02-13 16:13:50.317+00'), ('416', 'live_1770739514609_mvx02nbe5', null, null, '/financing', 'DeelMap - Property Deals Marketplace', null, null, '1', '0', 'desktop', 'https://deelmap-production-16a1.up.railway.app/our-story', '2026-02-13 16:13:50.870697+00', '2026-02-13 16:13:50.855+00'), ('417', 'live_1770739514609_mvx02nbe5', null, null, '/login', 'DeelMap - Property Deals Marketplace', null, null, '5', '0', 'desktop', 'https://deelmap-production-16a1.up.railway.app/our-story', '2026-02-13 16:13:56.547935+00', '2026-02-13 16:13:56.519+00'), ('418', 'live_1770999243515_wjdcdiisv', null, null, '/marketplace', '1134 Ogle Rd, O''Fallon, IL 62269, USA - $124,900', '2b09da5e-d747-4e44-8bb2-6f2fc83e2f3c', '1134 Ogle Rd, O''Fallon, IL 62269, USA', '5', '0', 'desktop', '', '2026-02-13 16:14:11.316304+00', '2026-02-13 16:14:11.3+00'), ('419', 'live_1770999006961_glirsw895', null, null, '/', 'DeelMap - Property Deals Marketplace', null, null, '18', '0', 'desktop', 'http://localhost:3000/marketplace', '2026-02-13 16:16:11.494082+00', '2026-02-13 16:16:10.627+00'), ('420', 'live_1770999006961_glirsw895', '1244fd90-27e4-48e2-b972-7134c7a39b67', 'yousaf.zhd3@gmail.com', '/2b09da5e-d747-4e44-8bb2-6f2fc83e2f3c', 'DeelMap - Property Deals Marketplace', null, null, '23', '0', 'desktop', 'http://localhost:3000/marketplace', '2026-02-13 16:18:05.216242+00', '2026-02-13 16:18:04.635+00'), ('421', 'live_1770999006961_glirsw895', '1244fd90-27e4-48e2-b972-7134c7a39b67', 'yousaf.zhd3@gmail.com', '/buyer/inbox', 'DeelMap - Property Deals Marketplace', null, null, '23', '0', 'desktop', 'http://localhost:3000/marketplace', '2026-02-13 16:18:27.647279+00', '2026-02-13 16:18:27.32+00');







create table public.live_sessions (
  id uuid not null default gen_random_uuid (),
  session_id text not null,
  user_id uuid null,
  user_email text null,
  user_first_name text null,
  user_last_name text null,
  is_guest boolean null default true,
  current_page text not null,
  current_page_title text null,
  property_id uuid null,
  property_address text null,
  started_at timestamp with time zone null default now(),
  last_heartbeat timestamp with time zone null default now(),
  is_active boolean null default true,
  device_type text null,
  browser text null,
  os text null,
  screen_width integer null,
  screen_height integer null,
  referrer text null,
  utm_source text null,
  utm_medium text null,
  utm_campaign text null,
  ip_address text null,
  country text null,
  city text null,
  constraint live_sessions_pkey primary key (id),
  constraint live_sessions_session_id_key unique (session_id)
) TABLESPACE pg_default;

create index IF not exists idx_live_sessions_last_heartbeat on public.live_sessions using btree (last_heartbeat) TABLESPACE pg_default;

create index IF not exists idx_live_sessions_is_active on public.live_sessions using btree (is_active) TABLESPACE pg_default;

create index IF not exists idx_live_sessions_session_id on public.live_sessions using btree (session_id) TABLESPACE pg_default;

create index IF not exists idx_live_sessions_property_id on public.live_sessions using btree (property_id) TABLESPACE pg_default;





DATA : 
INSERT INTO "public"."live_sessions" ("id", "session_id", "user_id", "user_email", "user_first_name", "user_last_name", "is_guest", "current_page", "current_page_title", "property_id", "property_address", "started_at", "last_heartbeat", "is_active", "device_type", "browser", "os", "screen_width", "screen_height", "referrer", "utm_source", "utm_medium", "utm_campaign", "ip_address", "country", "city") VALUES ('03e78235-374f-4ced-910d-fb9cb78276af', 'live_1771930406360_4la0iduux', '1244fd90-27e4-48e2-b972-7134c7a39b67', 'yousaf.zhd3@gmail.com', 'yousaf', 'zahid', 'false', '/2b09da5e-d747-4e44-8bb2-6f2fc83e2f3c', '1134 Ogle Rd, O''Fallon, IL 62269, USA - $124,900', '2b09da5e-d747-4e44-8bb2-6f2fc83e2f3c', '1134 Ogle Rd, O''Fallon, IL 62269, USA', '2026-02-24 10:53:26.717+00', '2026-02-24 16:15:11.305+00', 'false', 'desktop', 'Chrome', 'MacOS', null, null, '', null, null, null, '139.135.32.227', null, null);
