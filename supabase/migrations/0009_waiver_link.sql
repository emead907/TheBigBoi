-- Gym Stars Hub · parent portal waiver link in class emails
alter table public.gyms add column if not exists waiver_url text;

update public.gyms
set waiver_url = 'https://www.gomotionapp.com/Login5.jsp?team=idgs&_tu_Login_Redirect_=%2Fteam%2Fidgs%2Fcontroller%2Fcms%2Fadmin%2Findex%23%2Fmy-account%2Fagreements'
where slug = 'gym-stars';

-- Link the waiver wording in the class emails (only ones that don't already have the link).
update public.templates
set body = replace(
      replace(body, 'sign the waiver in your parent portal', '[sign the waiver in your parent portal]({{waiver_link}})'),
      ' before class: {{portal_link}}.', ' before class.')
where key in ('spot_ready', 'first_day_reminder', 'follow_up', 'follow_up_2')
  and body ilike '%sign the waiver in your parent portal%'
  and body not like '%{{waiver_link}}%';
