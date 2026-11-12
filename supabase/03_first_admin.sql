-- ============================================================
-- PARSLEY'S FARM v6 — First people and the Expenses PIN
-- 1. Replace the example emails with real ones.
-- 2. Delete the whole statement (from "insert" to the semicolon) for anyone
--    whose email you don't have yet. You can add them later in the app.
-- 3. Replace 0000 with the PIN you want for the Expenses screen.
-- 4. Run it.
-- ============================================================

insert into public.people (id, name, role, perms, note)
values (lower('ROD-EMAIL@example.com'), 'Rod', 'Admin', '{field,edit_beds,sales,expenses,money,people}', 'Owner')
on conflict (id) do update set name = excluded.name, role = excluded.role, perms = excluded.perms;

insert into public.people (id, name, role, perms, note)
values (lower('LORNA-EMAIL@example.com'), 'Lorna', 'Admin', '{field,edit_beds,sales,expenses,money,people}', 'Buys inputs, records expenses')
on conflict (id) do update set name = excluded.name, role = excluded.role, perms = excluded.perms;

insert into public.people (id, name, role, perms, note)
values (lower('KIPCHOGE-EMAIL@example.com'), 'Kipchoge', 'Checker', '{field,edit_beds,expenses}', 'Checks beds, adds expenses when sent to buy')
on conflict (id) do update set name = excluded.name, role = excluded.role, perms = excluded.perms;

insert into public.settings (key, value) values ('expenses_pin', crypt('0000', gen_salt('bf')))
on conflict (key) do update set value = excluded.value;
