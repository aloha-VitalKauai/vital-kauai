select 'relation:'||c.relkind::text||':'||c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='finance' and c.relkind in ('r','v','i','m')
union all
select 'viewdef:'||c.relname||':'||md5(pg_get_viewdef(c.oid))||':'||coalesce(array_to_string(c.reloptions,'+'),'-')
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='finance' and c.relkind='v'
union all
select 'indexdef:'||c.relname||':'||md5(pg_get_indexdef(c.oid))
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='finance' and c.relkind='i'
union all
select 'routinedef:'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||'):'||md5(p.prosrc)||':'||p.provolatile::text||':'||coalesce(array_to_string(p.proconfig,'+'),'-')
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='finance'
union all
select 'grant:'||table_name||':'||grantee||':'||privilege_type||':'||coalesce(column_name,'*')
  from information_schema.column_privileges where table_schema='finance'
union all
select 'type:'||t.typname from pg_type t join pg_namespace n on n.oid=t.typnamespace
  where n.nspname='finance' and t.typtype='e'
union all
select 'routine:'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||'):'||p.prokind::text||':'||p.prosecdef::text
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='finance'
union all
select 'trigger:'||c.relname||':'||t.tgname from pg_trigger t join pg_class c on c.oid=t.tgrelid
  join pg_namespace n on n.oid=c.relnamespace where n.nspname='finance' and not t.tgisinternal
union all
select 'constraint:'||c.relname||':'||con.conname||':'||con.contype::text||':'||pg_get_constraintdef(con.oid) from pg_constraint con
  join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='finance'
union all
select 'policy:'||tablename||':'||policyname||':'||cmd||':'||regexp_replace(coalesce(qual,'-')||'/'||coalesce(with_check,'-'), '\s+', ' ', 'g')||':'||':'||array_to_string(roles,'+') from pg_policies where schemaname='finance'
union all
select 'rls:'||c.relname||':'||c.relrowsecurity::text||':'||c.relforcerowsecurity::text
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='finance' and c.relkind='r'
order by 1
