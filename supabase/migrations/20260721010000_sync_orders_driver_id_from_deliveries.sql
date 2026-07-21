create or replace function public.sync_order_driver_from_delivery()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'DELETE' then
    update public.orders
    set driver_id = null
    where id = OLD.order_id;
    return OLD;
  end if;

  update public.orders
  set driver_id = NEW.driver_id
  where id = NEW.order_id;

  return NEW;
end;
$$;

drop trigger if exists trg_sync_order_driver_from_delivery on public.deliveries;

create trigger trg_sync_order_driver_from_delivery
after insert or update of driver_id or delete on public.deliveries
for each row
execute function public.sync_order_driver_from_delivery();
