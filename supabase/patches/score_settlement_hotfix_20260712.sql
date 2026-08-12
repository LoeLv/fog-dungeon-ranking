-- Score settlement duplicate-submit hotfix.
-- Run this once in Supabase SQL Editor before deploying the updated Edge Function.

begin;

alter table public.score_settlements
  add column if not exists client_request_id text;

create unique index if not exists score_settlements_client_request_uidx
  on public.score_settlements(operator_code_hash, client_request_id)
  where client_request_id is not null;

commit;
