-- Notification triggers: new inquiry / waitlist rows → notify-inquiry edge
-- function via pg_net. Apply AFTER the edge function is deployed.
-- Replace <NOTIFY_SECRET> with the same value set as an edge-function secret
-- (or remove the header line entirely if not using a secret).

create extension if not exists pg_net;

create or replace function public.notify_new_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://wmhqlssdxuwfqoniebjl.supabase.co/functions/v1/notify-inquiry',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-notify-secret', '<NOTIFY_SECRET>'
    ),
    body := to_jsonb(NEW) || jsonb_build_object('_table', TG_TABLE_NAME)
  );
  return NEW;
end;
$$;

drop trigger if exists trg_notify_inquiry on public.inquiries;
create trigger trg_notify_inquiry
  after insert on public.inquiries
  for each row execute function public.notify_new_lead();

drop trigger if exists trg_notify_waitlist on public.print_waitlist;
create trigger trg_notify_waitlist
  after insert on public.print_waitlist
  for each row execute function public.notify_new_lead();
