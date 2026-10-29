-- Supabase bật pg_safeupdate cho mọi yêu cầu qua API: UPDATE/DELETE không có WHERE bị từ chối,
-- kể cả trong hàm security definer. Kết nối của pgTAP không chịu ràng buộc này, nên quét mã nguồn
-- các hàm để bắt lỗi sớm (lỗi thật từng gặp ở bootstrap_super_admin / complete_install).
begin;
select plan(2);

create temporary view unqualified_writes as
select p.oid::regprocedure::text as fn, m[1] as stmt
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_language l on l.oid = p.prolang and l.lanname in ('sql', 'plpgsql')
cross join lateral regexp_matches(
  -- Bỏ chú thích, chuỗi ký tự (vd tg_op = 'UPDATE'), khóa dòng (select ... for update)
  -- và insert ... on conflict do update (là INSERT, safeupdate không chặn)
  regexp_replace(
    regexp_replace(regexp_replace(p.prosrc, '--[^\n]*', '', 'g'), '''[^'']*''', '''''', 'g'),
    '(for|do)\s+update', '\1_x', 'gi'
  ),
  '(\m(?:update|delete\s+from)\M[^;]*)', 'gi'
) as m
where n.nspname in ('public', 'private')
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  and m[1] !~* '\mwhere\M';

select is(
  (select coalesce(array_agg(fn || ': ' || left(stmt, 80) order by fn), '{}') from unqualified_writes),
  '{}'::text[],
  'Mọi UPDATE/DELETE trong hàm đều có WHERE'
);

-- Tự kiểm tra bộ quét: một hàm cố ý viết sai phải bị phát hiện
create function private.tmp_bad_write() returns void language sql as $$ update public.app_meta set value = value $$;
select ok(
  exists (select 1 from unqualified_writes where fn = 'private.tmp_bad_write()'),
  'Bộ quét phát hiện được UPDATE thiếu WHERE'
);

select * from finish();
rollback;
