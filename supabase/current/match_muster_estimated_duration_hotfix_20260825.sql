-- Match muster estimated duration hotfix.
-- Lets each manually-created muster keep its own displayed estimated duration.

begin;

alter table public.match_musters
  add column if not exists estimated_duration text not null default '';

commit;

-- Verification.
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'match_musters'
  and column_name = 'estimated_duration';
