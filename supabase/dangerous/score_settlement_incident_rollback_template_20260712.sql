-- Score settlement incident rollback template.
-- Do not run the rollback block until TARGET_SETTLEMENT_IDS is replaced with the exact duplicated settlement IDs.
-- The normal path is:
-- 1. Run the read-only locator query.
-- 2. Keep one correct settlement, put only the duplicated settlement IDs into target_settlements.
-- 3. Run the transaction.
-- 4. Recheck player scores and available draws.

-- Read-only locator: recent non-revoked score settlements.
select
  s.id,
  s.created_at,
  s.dungeon_name,
  s.source_type,
  s.operator_name,
  s.total_players,
  s.total_ascension,
  s.total_audience,
  s.total_score,
  string_agg(e.player_name || '(' || e.score_deng || '/' || e.score_jin || ')', ', ' order by e.player_name) as players
from public.score_settlements s
join public.score_settlement_entries e on e.settlement_id = s.id
where s.is_revoked = false
  and s.created_at >= now() - interval '3 days'
group by s.id
order by s.created_at desc;

-- Preview exact rollback impact after filling target_settlements.
-- with target_settlements(id) as (
--   values
--     ('TARGET_SETTLEMENT_ID_1'::uuid),
--     ('TARGET_SETTLEMENT_ID_2'::uuid)
-- )
-- select
--   e.player_code_hash,
--   e.player_name,
--   sum(e.score_deng) as rollback_deng,
--   sum(e.score_jin) as rollback_jin,
--   p.ascension_score as current_ascension,
--   p.audience_score as current_audience,
--   greatest(0, round((p.ascension_score - sum(e.score_deng))::numeric, 1)) as next_ascension,
--   greatest(0, round((p.audience_score - sum(e.score_jin))::numeric, 1)) as next_audience
-- from target_settlements t
-- join public.score_settlement_entries e on e.settlement_id = t.id
-- join public.player_profiles p on p.invite_code_hash = e.player_code_hash
-- group by e.player_code_hash, e.player_name, p.ascension_score, p.audience_score
-- order by e.player_name;

-- Rollback transaction. Leave one correct settlement out of this list.
-- begin;
--
-- create temporary table target_settlements(id uuid primary key) on commit drop;
-- insert into target_settlements(id) values
--   ('TARGET_SETTLEMENT_ID_1'::uuid),
--   ('TARGET_SETTLEMENT_ID_2'::uuid);
--
-- create temporary table rollback_entries on commit drop as
-- select
--   e.player_code_hash,
--   e.player_name,
--   sum(e.score_deng)::numeric(8, 1) as rollback_deng,
--   sum(e.score_jin)::numeric(8, 1) as rollback_jin
-- from target_settlements t
-- join public.score_settlement_entries e on e.settlement_id = t.id
-- group by e.player_code_hash, e.player_name;
--
-- update public.player_profiles p
-- set ascension_score = greatest(0, round((p.ascension_score - r.rollback_deng)::numeric, 1)),
--     audience_score = greatest(0, round((p.audience_score - r.rollback_jin)::numeric, 1)),
--     updated_at = now()
-- from rollback_entries r
-- where p.invite_code_hash = r.player_code_hash;
--
-- update public.score_settlements s
-- set is_revoked = true,
--     revoke_remark = coalesce(s.revoke_remark, '') || case when coalesce(s.revoke_remark, '') = '' then '' else E'\n' end || '事故回滚：重复点击产生的重复结算',
--     revoked_by_name = '事故回滚SQL',
--     revoked_at = now()
-- from target_settlements t
-- where s.id = t.id
--   and s.is_revoked = false;
--
-- insert into public.score_change_logs (
--   player_code_hash,
--   player_name,
--   change_deng,
--   change_jin,
--   source_type,
--   settlement_id,
--   operator_name,
--   revoke_remark
-- )
-- select
--   e.player_code_hash,
--   e.player_name,
--   -e.score_deng,
--   -e.score_jin,
--   'revoke',
--   e.settlement_id,
--   '事故回滚SQL',
--   '重复点击结算事故回滚'
-- from target_settlements t
-- join public.score_settlement_entries e on e.settlement_id = t.id;
--
-- insert into public.score_messages (
--   player_code_hash,
--   player_name,
--   settlement_id,
--   msg_type,
--   content
-- )
-- select
--   e.player_code_hash,
--   e.player_name,
--   e.settlement_id,
--   'revoke',
--   '【结算撤销｜事故回滚】重复点击产生的重复结算已回滚。登神回滚：' || (-e.score_deng) || '，觐见回滚：' || (-e.score_jin)
-- from target_settlements t
-- join public.score_settlement_entries e on e.settlement_id = t.id;
--
-- commit;

-- Draw-risk check after score rollback.
-- Available draws are derived from ascension_score, so unused extra draws disappear automatically.
-- If spent_draws is already greater than corrected earned draws, the player may have consumed accident-granted draws.
-- select
--   p.display_name,
--   p.ascension_score,
--   coalesce(ds.spent_draws, 0) as spent_draws,
--   15 + greatest(0, floor((p.ascension_score - 1000) / 10)) as earned_draws_after_rollback,
--   greatest(0, coalesce(ds.spent_draws, 0) - (15 + greatest(0, floor((p.ascension_score - 1000) / 10)))) as overspent_draws
-- from public.player_profiles p
-- left join public.talent_draw_state ds on ds.invite_code_hash = p.invite_code_hash
-- where p.invite_code_hash in (
--   select distinct player_code_hash from public.score_settlement_entries where settlement_id in (
--     'TARGET_SETTLEMENT_ID_1'::uuid,
--     'TARGET_SETTLEMENT_ID_2'::uuid
--   )
-- )
-- order by overspent_draws desc, p.display_name;
