INSERT INTO public.events (slug,title,tagline,summary,body,status,format,theme,country_code,city,venue,starts_at,ends_at,registration_close,capacity,hero_url,colour,hosts,is_placeholder) VALUES
('caribbean-economic-leadership-summit-2026','Caribbean Economic Leadership Summit','Test the decisions that shape the next decade.','Heads of Government, finance ministers and central bankers test national economic choices side by side, using live data from the ten GDPVision Chambers.','A two-day working summit. Each delegation brings one priority decision and leaves with a tested option, the data behind it and a plan for delivery.','published','in_person','Growth & resilience','ATG','St. John''s','Placeholder venue, Antigua','2026-11-18 13:00+00','2026-11-19 21:00+00','2026-11-11 23:59+00',180,'/__l5e/assets-v1/059bbedb-798d-4a73-8d95-43da80d2f6ff/event-summit.jpg','sea',ARRAY['OPEN Interactive','GDPVision'],true),
('ministers-data-roundtable-2027','Ministers'' Data Roundtable','One table. Every ministry. Shared numbers.','A closed working session for permanent secretaries and ministers on connecting ministry data to Cabinet decisions.','Small-group sessions on the National Data Ledger, ministry scorecards and the Caribbean Indices.','published','hybrid','Government delivery','LCA','Castries','Placeholder venue, Saint Lucia','2027-01-27 14:00+00','2027-01-27 21:00+00','2027-01-20 23:59+00',40,'/__l5e/assets-v1/70ee7f30-d1c1-4016-812e-23d568630edd/event-forum.jpg','mango',ARRAY['GDPVision'],true),
('caribbean-energy-and-investment-forum-2027','Energy & Investment Forum','Price the transition before you commit to it.','Investors, utilities and governments compare energy and investment options using the Investment & Resilience Studio.','Keynotes, investor clinics and live scenario sessions on power costs, resilience and capital flows.','published','in_person','Energy & investment','BRB','Bridgetown','Placeholder venue, Barbados','2027-02-24 13:00+00','2027-02-25 21:00+00','2027-02-17 23:59+00',300,'/__l5e/assets-v1/f29d2d07-afea-4d4e-93ac-10537ca9a68c/event-stage.jpg','coral',ARRAY['GDPVision','OPEN Interactive'],true),
('national-record-briefing-2026','National Record Briefing','How the Second Brain keeps a nation''s record.','A public briefing on the National Record and the Caribbean Indices first edition.','Recording available on request.','published','online','Data & transparency',NULL,NULL,'Online','2026-09-15 15:00+00','2026-09-15 16:30+00','2026-09-14 23:59+00',NULL,'/__l5e/assets-v1/70ee7f30-d1c1-4016-812e-23d568630edd/event-forum.jpg','palm',ARRAY['GDPVision'],true);

INSERT INTO public.event_sessions (event_id,position,starts_at,title,description,speaker_names)
SELECT e.id, s.pos, e.starts_at + (s.pos * interval '90 minutes'), s.title, s.descr, s.spk
FROM public.events e
CROSS JOIN (VALUES
 (0,'Opening: the decision in front of us','Why the region needs one current view of its economy.',ARRAY['Speaker to be confirmed']),
 (1,'Live test: one national decision','A delegation tests a real choice in the Policy Scenario Engine.',ARRAY['Speaker to be confirmed']),
 (2,'From decision to delivery','Turning Cabinet commitments into measurable delivery.',ARRAY['Speaker to be confirmed'])
) AS s(pos,title,descr,spk)
WHERE e.is_placeholder;

INSERT INTO public.event_speakers (event_id,position,name,role,organisation)
SELECT e.id, 0, 'Speaker to be confirmed', 'Keynote', 'To be announced' FROM public.events e WHERE e.is_placeholder;

INSERT INTO public.event_links (event_id,kind,ref,label)
SELECT e.id, l.kind, l.ref, l.label FROM public.events e
JOIN (VALUES
 ('caribbean-economic-leadership-summit-2026','chamber','03','Policy Scenario Engine'),
 ('caribbean-economic-leadership-summit-2026','index','CGX','Caribbean Growth Index'),
 ('caribbean-economic-leadership-summit-2026','page','/present','The GDPVision briefing'),
 ('ministers-data-roundtable-2027','chamber','01','National Data Ledger'),
 ('ministers-data-roundtable-2027','chamber','02','Ministry Growth & Delivery'),
 ('ministers-data-roundtable-2027','index','CGV','Caribbean Governance Index'),
 ('caribbean-energy-and-investment-forum-2027','chamber','04','Investment & Resilience Studio'),
 ('caribbean-energy-and-investment-forum-2027','index','CCX','Caribbean Capital Index'),
 ('national-record-briefing-2026','page','/record','The National Record'),
 ('national-record-briefing-2026','index','CHX','Caribbean Human Index')
) AS l(slug,kind,ref,label) ON l.slug = e.slug;