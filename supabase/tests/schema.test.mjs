// Applies every migration to an in-memory Postgres (PGlite, with Supabase's auth schema stubbed)
// and asserts RLS, constraints and view logic. Run: npm run test:schema
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { readdirSync, readFileSync } from 'node:fs'

const dir = new URL('../migrations', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const db = new PGlite({ extensions: { pg_trgm } })

// Stub the bits of Supabase the migrations rely on.
await db.exec(`
  create schema auth;
  create schema extensions;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
  create or replace function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create or replace function auth.jwt() returns jsonb language sql stable as
    $$ select jsonb_build_object('sub', nullif(current_setting('request.jwt.claim.sub', true), ''), 'email', nullif(current_setting('request.jwt.claim.email', true), '')) $$;
  create role authenticated nologin;
  create role anon nologin;
  grant usage on schema auth to authenticated;
  grant execute on function auth.uid() to authenticated;
  grant execute on function auth.jwt() to authenticated;
  grant usage on schema extensions to authenticated;
`)

for (const f of readdirSync(dir).sort()) {
  try { await db.exec(readFileSync(`${dir}/${f}`, 'utf8')); console.log('OK  ', f) }
  catch (e) { console.log('FAIL', f, '\n    ', e.message); process.exit(1) }
}

let pass = 0, fail = 0
const check = (name, cond, extra = '') => { if (cond) pass++; else fail++; console.log(cond ? 'PASS' : 'FAIL', name, extra) }
const as = async (uid, sql) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false);`)
  try { return await db.query(sql) } finally { await db.exec('reset role') }
}
const expectErr = async (uid, sql) => { try { await as(uid, sql); return null } catch (e) { return e.message } }

// RLS enabled everywhere?
const rls = await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`)
check('RLS enabled on every public table', rls.rows.length === 0, JSON.stringify(rls.rows))
const pol = await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname)`)
check('every table has a policy', pol.rows.length === 0, JSON.stringify(pol.rows))
const trg = await db.query(`select count(*)::int n from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and t.tgname='set_updated_at'`)
console.log('updated_at triggers:', trg.rows[0].n)

const A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
await db.exec(`insert into auth.users (id,email) values ('${A}','a@x.com'),('${B}','b@x.com')`)
check('profile auto-created', (await db.query('select count(*)::int n from public.profiles')).rows[0].n === 2)

// Isolation
await as(A, `insert into finance_accounts (name) values ('A-bank')`)
await as(B, `insert into finance_accounts (name) values ('B-bank')`)
check('A sees only own accounts', (await as(A, 'select name from finance_accounts')).rows.map(r => r.name).join() === 'A-bank')
check('anon-less insert w/ foreign user_id rejected', !!(await expectErr(A, `insert into finance_accounts (user_id,name) values ('${B}','evil')`)))

// Cross-user FK
const bAcc = (await as(B, 'select id from finance_accounts')).rows[0].id
const e = await expectErr(A, `insert into transactions (type,amount,title,account_id) values ('expense',5,'x','${bAcc}')`)
check('cross-user account reference rejected by composite FK', !!e, e ?? '')

// Set-null on delete keeps the txn
const aAcc = (await as(A, 'select id from finance_accounts')).rows[0].id
await as(A, `insert into transactions (type,amount,title,account_id) values ('expense',5,'coffee','${aAcc}')`)
await as(A, `delete from finance_accounts where id='${aAcc}'`)
const t = (await as(A, `select account_id from transactions where title='coffee'`)).rows[0]
check('deleting account nulls account_id only (txn kept, user_id intact)', t && t.account_id === null)

// Liabilities
await as(A, `insert into liabilities (id,name,kind,principal,opening_paid,monthly_payment) values ('11111111-1111-1111-1111-111111111111','Laptop plan','hardware_installment',3600,300,300)`)
await as(A, `insert into liability_payments (liability_id,amount) values ('11111111-1111-1111-1111-111111111111',300),('11111111-1111-1111-1111-111111111111',300)`)
const lb = (await as(A, 'select outstanding, total_paid, months_remaining from liability_balances')).rows[0]
check('liability outstanding = 3600-300-600 = 2700, 9 months left', Number(lb.outstanding) === 2700 && lb.months_remaining === 9, JSON.stringify(lb))

// Assets / net worth
await as(A, `insert into assets (id,name,amount_invested) values ('22222222-2222-2222-2222-222222222222','ASNB',1000)`)
await as(A, `insert into asset_valuations (asset_id,valued_on,value) values ('22222222-2222-2222-2222-222222222222','2026-01-01',1100),('22222222-2222-2222-2222-222222222222','2026-06-01',1500)`)
const nw = (await as(A, 'select total_assets,total_liabilities,net_worth from net_worth')).rows[0]
check('net worth = 1500 - 2700 = -1200', Number(nw.net_worth) === -1200, JSON.stringify(nw))
check('B sees no net worth rows', (await as(B, 'select * from net_worth')).rows.length === 0)

// Subscription generated monthly cost
await as(A, `insert into subscriptions (name,kind,amount,billing_cycle) values ('VPS','cloud_infra',120,'yearly'),('Domain','domain_hosting',10,'monthly')`)
check('yearly 120 -> 10.00/mo', (await as(A, `select monthly_cost from subscriptions where name='VPS'`)).rows[0].monthly_cost == 10)

// Projects + cost summary
await as(A, `insert into projects (id,name,expense_tag,budget) values ('33333333-3333-3333-3333-333333333333','Pi NAS','pi-nas',500)`)
await as(A, `insert into transactions (type,amount,title,project_id) values ('expense',200,'Pi 5','33333333-3333-3333-3333-333333333333')`)
check('bad expense tag rejected', !!(await expectErr(A, `insert into projects (name,expense_tag) values ('x','Bad Tag!')`)))
await as(A, `insert into inventory_items (id,name,category,quantity,unit_cost) values ('44444444-4444-4444-4444-444444444444','Pi 5','sbc',1,200)`)
await as(A, `insert into project_components (project_id,item_id,quantity) values ('33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444',1)`)
const pc = (await as(A, 'select spent,budget_remaining,bom_value from project_cost_summary')).rows[0]
check('project spent 200, remaining 300, bom 200', Number(pc.spent) === 200 && Number(pc.budget_remaining) === 300 && Number(pc.bom_value) === 200, JSON.stringify(pc))

// Vehicle: fills at 1000(full) 1400(full,40L) 1500(partial,10L) 1800(full,30L)
await as(A, `insert into vehicles (id,name,initial_odometer_km) values ('55555555-5555-5555-5555-555555555555','Myvi',1000)`)
await as(A, `insert into fuel_logs (vehicle_id,filled_at,odometer_km,liters,price_per_liter,total_cost,is_full_tank) values
  ('55555555-5555-5555-5555-555555555555','2026-01-01',1000,30,2.05,61.5,true),
  ('55555555-5555-5555-5555-555555555555','2026-01-10',1400,40,2.05,82,true),
  ('55555555-5555-5555-5555-555555555555','2026-01-15',1500,10,2.05,20.5,false),
  ('55555555-5555-5555-5555-555555555555','2026-01-20',1800,30,2.05,61.5,true)`)
const seg = (await as(A, 'select distance_km,liters,km_per_liter,fuel_cost_per_km from vehicle_fuel_segments order by end_odometer_km')).rows
check('2 segments', seg.length === 2, JSON.stringify(seg))
check('seg1 400km/40L = 10.00 km/L', seg[0] && Number(seg[0].km_per_liter) === 10 && Number(seg[0].distance_km) === 400)
check('seg2 (partial included) 400km/40L = 10.00 km/L', seg[1] && Number(seg[1].km_per_liter) === 10 && Number(seg[1].liters) === 40)
await as(A, `insert into maintenance_logs (vehicle_id,kind,cost,odometer_km) values ('55555555-5555-5555-5555-555555555555','oil_change',150,1850)`)
await as(A, `insert into parking_logs (vehicle_id,cost,authority) values ('55555555-5555-5555-5555-555555555555',3,'MBPJ'),('55555555-5555-5555-5555-555555555555',5,'DBKL')`)
const rc = (await as(A, 'select total_cost,distance_km,cost_per_km from vehicle_running_costs')).rows[0]
// fuel 225.5 + maint 150 + parking 8 = 383.5 ; distance 1850-1000 = 850 ; 0.451
check('running cost 383.50 over 850km = 0.451/km', Number(rc.total_cost) === 383.5 && Number(rc.distance_km) === 850 && Number(rc.cost_per_km) === 0.451, JSON.stringify(rc))

// Hydration, local-day bucketing (KL = UTC+8: 17:00Z on 1st is 01:00 on 2nd)
await as(A, `insert into hydration_logs (logged_at,beverage,volume_ml,caffeine_mg) values
  ('2026-03-01T17:00:00Z','kopi',250,95),('2026-03-02T01:00:00Z','water',500,0)`)
const dh = (await as(A, 'select day::text,total_volume_ml,total_caffeine_mg from daily_hydration')).rows
check('both drinks bucket into local day 2026-03-02 (750ml, 95mg)', dh.length === 1 && dh[0].day === '2026-03-02' && Number(dh[0].total_volume_ml) === 750 && Number(dh[0].total_caffeine_mg) === 95, JSON.stringify(dh))

// Racket
await as(A, `insert into racket_matches (id,sport) values ('66666666-6666-6666-6666-666666666666','badminton')`)
await as(A, `insert into racket_match_games (match_id,game_no,my_score,opponent_score) values
  ('66666666-6666-6666-6666-666666666666',1,21,15),('66666666-6666-6666-6666-666666666666',2,18,21),('66666666-6666-6666-6666-666666666666',3,21,19)`)
const rm = (await as(A, 'select games_won,games_lost,result from racket_match_results')).rows[0]
check('badminton 2-1 = win', rm.result === 'win' && Number(rm.games_won) === 2, JSON.stringify(rm))

// Shooting
await as(A, `insert into shooting_sessions (discipline,total_shots,shots_on_target,total_score,max_score) values ('air_rifle',60,57,580,600)`)
check('accuracy 95.00%', (await as(A, 'select accuracy_pct from shooting_sessions')).rows[0].accuracy_pct == 95)
check('hits > shots rejected', !!(await expectErr(A, `insert into shooting_sessions (total_shots,shots_on_target) values (10,11)`)))

// updated_at trigger
await as(A, `update goals set name=name where false`)
await as(A, `insert into goals (name,target_amount) values ('Emergency',5000)`)
const before = (await as(A, 'select updated_at from goals')).rows[0].updated_at
await new Promise(r => setTimeout(r, 20))
await as(A, `update goals set current_amount=100`)
const after = (await as(A, 'select updated_at from goals')).rows[0].updated_at
check('updated_at advances on update', after > before)

// Read RPCs (migration 10): one round trip each, still behind RLS
await as(A, `insert into transactions (type,amount,title,occurred_at) values
  ('income',100,'p1','2031-05-01T10:00:00+08'),('expense',10,'p2','2031-05-02T10:00:00+08'),('expense',20,'p3','2031-05-03T10:00:00+08')`)
const aCount = (await as(A, 'select count(*)::int n from transactions')).rows[0].n
const pg1 = (await as(A, 'select transactions_page(2, 0) as p')).rows[0].p
const pg2 = (await as(A, 'select transactions_page(2, 2) as p')).rows[0].p
check('transactions_page: total is the caller row count', pg1.total === aCount, JSON.stringify({ total: pg1.total, aCount }))
check('transactions_page: newest first, limit respected', pg1.rows.length === 2 && pg1.rows[0].title === 'p3' && pg1.rows[1].title === 'p2', JSON.stringify(pg1.rows.map(r => r.title)))
check('transactions_page: pages do not overlap', pg2.rows.every(r => !pg1.rows.some(q => q.id === r.id)) && pg2.rows[0].title === 'p1')
const pgB = (await as(B, 'select transactions_page(100, 0) as p')).rows[0].p
check('transactions_page: other users see none of it', pgB.rows.every(r => !['p1', 'p2', 'p3'].includes(r.title)) && pgB.total === pgB.rows.length, JSON.stringify(pgB.total))
check('transactions_page: empty page is [] not null', Array.isArray((await as(A, 'select transactions_page(20, 9999) as p')).rows[0].p.rows))
await as(A, `insert into monthly_goals (month,income_target,expense_limit) values ('2031-05-01',500,300)`)
const ov = (await as(A, `select * from finance_overview('2031-05-01')`)).rows
check('finance_overview: month totals and targets in one row', ov.length === 1 && Number(ov[0].income) === 100 && Number(ov[0].expense) === 30 && Number(ov[0].income_target) === 500 && Number(ov[0].expense_limit) === 300, JSON.stringify(ov))
const worthNow = (await as(A, 'select net_worth from net_worth')).rows[0]
check('finance_overview: net worth matches the view', Number(ov[0].net_worth) === Number(worthNow?.net_worth ?? 0), JSON.stringify([ov[0].net_worth, worthNow]))
const ovB = (await as(B, `select * from finance_overview('2031-05-01')`)).rows
check('finance_overview: other users get zeros for that month', ovB.length === 1 && Number(ovB[0].income) === 0 && Number(ovB[0].income_target) === 0, JSON.stringify(ovB))
await db.exec('set role anon')
let anonErr = null
try { await db.query('select transactions_page(1, 0)') } catch (e) { anonErr = e.message } finally { await db.exec('reset role') }
check('RPCs are not executable by anon', !!anonErr, String(anonErr))

// Page bundles (migration 11): each returns what the separate requests returned, in one call
const one = async (uid, sql) => (await as(uid, sql)).rows[0]
const ses = (await one(A, 'select app_session() as j')).j
check('app_session: verified user id and profile settings', ses.user_id === A && ses.profile && typeof ses.profile.timezone === 'string' && typeof ses.profile.currency === 'string', JSON.stringify(ses))

await as(A, `insert into transactions (type,amount,title,occurred_at) values ('expense',7,'Kopi 50% off_deal','2031-05-04T10:00:00+08')`)
const tp = async (uid, args) => (await one(uid, `select transactions_page(${args}) as j`)).j
const inc = await tp(A, `10, 0, 'income'`)
check('transactions_page: type filter runs in the database', inc.rows.length > 0 && inc.rows.every(r => r.type === 'income') && inc.total === inc.rows.length, JSON.stringify(inc.total))
check('transactions_page: totals follow the filter', Number(inc.expense) === 0 && Number(inc.income) === inc.rows.reduce((n, r) => n + Number(r.amount), 0), JSON.stringify([inc.income, inc.expense]))
const found = await tp(A, `10, 0, null, null, null, 'KOPI'`)
check('transactions_page: search is case-insensitive', found.total === 1 && found.rows[0].title === 'Kopi 50% off_deal', JSON.stringify(found.rows.map(r => r.title)))
check('transactions_page: % and _ in a search are literal', (await tp(A, `10, 0, null, null, null, '50% off_d'`)).total === 1 && (await tp(A, `10, 0, null, null, null, '%'`)).total === 1 && (await tp(A, `10, 0, null, null, null, 'p_'`)).total === 0)
const aAccId = (await one(A, `insert into finance_accounts (name) values ('RPC-bank') returning id`)).id
await as(A, `insert into transactions (type,amount,title,account_id,occurred_at) values ('expense',3,'acc-filter','${aAccId}','2031-04-01T10:00:00+08')`)
const byAcc = await tp(A, `10, 0, null, null, '${aAccId}'`)
check('transactions_page: account filter', byAcc.total >= 1 && byAcc.rows.every(r => r.account_id === aAccId), JSON.stringify(byAcc.total))
const ranged = await tp(A, `10, 0, null, null, null, null, '2031-05-02T00:00:00+08', '2031-05-03T00:00:00+08'`)
check('transactions_page: date range is from-inclusive, to-exclusive', ranged.total === 1 && ranged.rows[0].title === 'p2', JSON.stringify(ranged.rows.map(r => r.title)))

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const ids = rows => rows.map(r => r.id ?? r.project_id ?? r.vehicle_id ?? r.liability_id ?? r.asset_id)
const direct = async (uid, sql) => (await as(uid, `select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) as j from (${sql}) x`)).rows[0].j

const fin = (await one(A, `select finance_bundle('2031-05-01', 2, 0) as j`)).j
check('finance_bundle: every section present', ['overview', 'cashflow', 'ledger', 'categories', 'accounts', 'subscriptions', 'liabilities', 'balances', 'asset_values', 'assets', 'goals'].every(k => k in fin), Object.keys(fin).join())
check('finance_bundle: overview matches finance_overview', Number(fin.overview.income) === 100 && Number(fin.overview.expense) === 37 && Number(fin.overview.income_target) === 500, JSON.stringify(fin.overview))
check('finance_bundle: ledger is the paged RPC', fin.ledger.rows.length === 2 && same(fin.ledger, await tp(A, '2, 0')))
check('finance_bundle: accounts match the table, by name', same(fin.accounts, await direct(A, 'select * from finance_accounts order by name limit 500')) && fin.accounts.length > 0)
check('finance_bundle: balances and asset values match the views', same(fin.balances, await direct(A, 'select * from liability_balances order by name limit 100')) && same(fin.asset_values, await direct(A, 'select * from asset_latest_values order by name limit 100')))
check('finance_bundle: cashflow newest month first', same(fin.cashflow, await direct(A, 'select * from monthly_cashflow order by month desc limit 6')) && fin.cashflow.length > 0)
const finB = (await one(B, `select finance_bundle('2031-05-01') as j`)).j
check('finance_bundle: other users see only their own', finB.accounts.every(a => a.name !== 'A-bank') && finB.ledger.rows.every(r => !['p1', 'p2', 'p3'].includes(r.title)))

const veh = (await one(A, 'select vehicles_bundle() as j')).j
check('vehicles_bundle: lists match the tables and views', same(veh.vehicles, await direct(A, 'select * from vehicles order by name limit 100')) && same(veh.costs, await direct(A, 'select * from vehicle_running_costs order by name limit 100')) && same(veh.fuel, await direct(A, 'select * from fuel_logs order by filled_at desc limit 15')), JSON.stringify(ids(veh.vehicles)))
const segDirect = await direct(A, 'select * from vehicle_fuel_segments order by vehicle_id, ended_at desc')
check('vehicles_bundle: fuel segments per vehicle, newest first, no helper column', veh.segments.length === Math.min(segDirect.length, 12 * veh.vehicles.length) && veh.segments.every(x => !('rn' in x)) && same(veh.segments, segDirect.slice(0, veh.segments.length)), JSON.stringify(veh.segments.length))
const vId = veh.vehicles[0]?.id
if (vId) {
  await as(A, `insert into maintenance_logs (vehicle_id,kind,performed_on,cost) values ('${vId}','oil_change','2031-01-01',10),('${vId}','oil_change','2031-03-01',10),('${vId}','tyres','2031-02-01',10)`)
  const latest = (await one(A, 'select vehicles_bundle() as j')).j.latest_services.filter(m => m.vehicle_id === vId && ['oil_change', 'tyres'].includes(m.kind) && m.performed_on >= '2031-01-01')
  check('vehicles_bundle: only the latest service of each kind', latest.length === 2 && latest.find(m => m.kind === 'oil_change').performed_on === '2031-03-01', JSON.stringify(latest.map(m => [m.kind, m.performed_on])))
}

const prj = (await one(A, 'select projects_bundle() as j')).j
check('projects_bundle: matches the three requests', same(prj.projects, await direct(A, 'select * from projects order by created_at desc limit 200')) && same(prj.costs, await direct(A, 'select * from project_cost_summary order by name limit 100')) && same(prj.inventory, await direct(A, 'select * from inventory_items order by name limit 500')), JSON.stringify([prj.projects.length, prj.inventory.length]))

const nut = (await one(A, `select nutrition_bundle('2026-03-02', '2026-03-01T16:00:00Z', '2026-03-02T16:00:00Z', '2026-02-17') as j`)).j
const dhDirect = (await as(A, `select * from daily_hydration where day = '2026-03-02'`)).rows[0]
check('nutrition_bundle: day totals match the views', nut.day.hydration && Number(nut.day.hydration.total_volume_ml) === Number(dhDirect.total_volume_ml) && same(nut.trend, await direct(A, `select * from daily_hydration where day >= '2026-02-17' and day <= '2026-03-02' order by day`)), JSON.stringify(nut.day.hydration))
check('nutrition_bundle: the day’s raw entries, newest first', same(nut.day.drinks, await direct(A, `select * from hydration_logs where logged_at >= '2026-03-01T16:00:00Z' and logged_at < '2026-03-02T16:00:00Z' order by logged_at desc limit 500`)) && nut.day.drinks.length > 0 && same(nut.foods, await direct(A, 'select * from foods order by name limit 200')))

const fit = (await one(A, `select fitness_bundle('2031-05-04', '2031-05-03T16:00:00Z', '2031-05-04T16:00:00Z', '2031-03-05') as j`)).j
check('fitness_bundle: match results and sessions match', same(fit.match_results, await direct(A, 'select * from racket_match_results order by played_at desc limit 500')) && fit.match_results.length > 0 && same(fit.shooting_sessions, await direct(A, 'select * from shooting_sessions order by session_at desc limit 60')) && same(fit.matches, await direct(A, 'select * from racket_matches order by played_at desc limit 10')))
check('fitness_bundle: every section is an array', ['workouts', 'match_results', 'bookings', 'shooting_sessions', 'matches', 'exercise_goals', 'daily_exercise', 'today_logs'].every(k => Array.isArray(fit[k])))

const dash = (await one(A, `select dashboard_bundle('2031-05-01', '2031-05-04', '2031-05-03T16:00:00Z', '2031-05-04T16:00:00Z', '2031-04-27T16:00:00Z') as j`)).j
check('dashboard_bundle: every section present', ['overview', 'active_subscriptions', 'running_costs', 'project_costs', 'low_stock', 'day', 'recent_workouts', 'upcoming_bookings', 'exercise_goals', 'exercise_today'].every(k => k in dash), Object.keys(dash).join())
check('dashboard_bundle: overview and running costs match', Number(dash.overview.income) === 100 && same(dash.running_costs, veh.costs.length ? await direct(A, 'select * from vehicle_running_costs order by name limit 100') : []))
await as(A, `insert into inventory_items (name,quantity,reorder_level) values ('zz-low',1,5),('zz-ok',9,5),('zz-untracked',0,0)`)
const low = (await one(A, `select dashboard_bundle('2031-05-01', '2031-05-04', '2031-05-03T16:00:00Z', '2031-05-04T16:00:00Z', '2031-04-27T16:00:00Z') as j`)).j.low_stock.map(i => i.name).filter(n => n.startsWith('zz-'))
check('dashboard_bundle: low stock is filtered in the database', same(low, ['zz-low']), JSON.stringify(low))
const dashB = (await one(B, `select dashboard_bundle('2031-05-01', '2031-05-04', '2031-05-03T16:00:00Z', '2031-05-04T16:00:00Z', '2031-04-27T16:00:00Z') as j`)).j
check('dashboard_bundle: other users get none of it', dashB.low_stock.length === 0 && Number(dashB.overview.income) === 0)

await db.exec('set role anon')
const denied = []
for (const call of ['app_session()', 'finance_bundle(current_date)', 'vehicles_bundle()', 'projects_bundle()', 'dashboard_bundle(current_date, current_date, now(), now(), now())', 'nutrition_bundle(current_date, now(), now(), current_date)', 'fitness_bundle(current_date, now(), now(), current_date)']) {
  try { await db.query(`select ${call}`); denied.push(`${call} ran`) } catch { /* expected */ }
}
await db.exec('reset role')
check('bundles are not executable by anon', denied.length === 0, denied.join('; '))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
