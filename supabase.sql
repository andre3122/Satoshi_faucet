-- Cooldown constraint via trigger (10 seconds per address)
create or replace function prevent_spam() returns trigger as $$
begin
  if exists (
    select 1 from claims
    where address = new.address
      and created_at > now() - interval '10 seconds'
      and status in ('pending','sent')
  ) then
    raise exception 'cooldown';
  end if;
  return new;
end$$ language plpgsql;