begin;

update public.staff_action_logs l
set actor_name = b.old_actor_name
from public.staff_action_logs_actor_name_backup b
where b.log_id = l.id;

commit;
