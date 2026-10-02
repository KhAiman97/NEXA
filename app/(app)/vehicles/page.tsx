import { Suspense } from "react";
import { getSession } from "@/lib/app/session";
import { fuelFields, maintenanceFields, parkingFields, toOptions, vehicleFields } from "@/lib/app/forms";
import { date, dateTime, day, dayWithYear, label, money, num } from "@/lib/format";
import { createFuelLog, createMaintenanceLog, createParkingLog, createVehicle, deleteFuelLog, deleteMaintenanceLog, deleteParkingLog, deleteVehicle, updateFuelLog, updateMaintenanceLog, updateParkingLog, updateVehicle } from "@/lib/actions/vehicles";
import { fuelLogs, listFuelSegments, listMaintenanceDue, listRunningCosts, maintenanceLogs, parkingLogs, vehicles } from "@/lib/services/vehicles";
import { TrendChart } from "@/components/app/charts";
import { DeleteButton } from "@/components/app/delete-button";
import { EntryDialog } from "@/components/app/entry-dialog";
import { LogoLoader } from "@/components/app/logo";
import { ModuleTabs } from "@/components/app/module-tabs";
import { RowActions, Empty, Figure, ModulePage, Panel, Pill, Row, RowList, Section, Table, Td } from "@/components/app/ui";

export const metadata = { title: "Vehicles" };

/** Malaysian plates are white characters on black, so the plate is drawn that way in both themes. */
function Plate({ children }: { children: string }) {
  return <span className="inline-block rounded border border-white/20 bg-neutral-950 px-2 py-0.5 font-mono text-sm font-medium tracking-[0.18em] text-white">{children}</span>;
}

async function VehiclesContent() {
  const { db, today, currency, timezone } = await getSession();
  const rm = (n: number) => money(n, currency);

  const [vehicleRows, costs, fuel, maintenance, parking] = await Promise.all([
    vehicles.list(db, { limit: 100 }),
    listRunningCosts(db),
    fuelLogs.list(db, { limit: 15 }),
    maintenanceLogs.list(db, { limit: 15 }),
    parkingLogs.list(db, { limit: 15 }),
  ]);

  if (vehicleRows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4">
        <Empty title="No vehicles yet">Add a car or motorcycle to start tracking fuel, servicing and parking.</Empty>
        <EntryDialog label="Add vehicle" fields={vehicleFields} action={createVehicle} />
      </div>
    );
  }

  const details = await Promise.all(
    vehicleRows.map(async (v) => ({ id: v.id, segments: await listFuelSegments(db, v.id, 12), due: await listMaintenanceDue(db, v.id, today) })),
  );
  const detailOf = new Map(details.map((d) => [d.id, d]));
  const costOf = new Map(costs.map((c) => [c.vehicle_id, c]));
  const nameOf = new Map(vehicleRows.map((v) => [v.id, v.name]));
  const vehicleOptions = toOptions(vehicleRows);

  const garageTab = (
    <Section id="garage" title="Garage" hint="Running cost counts fuel, servicing and parking since each vehicle was added." aside={<EntryDialog label="Add vehicle" fields={vehicleFields} action={createVehicle} />}>
      <div className="grid gap-4 xl:grid-cols-2">
        {vehicleRows.map((v) => {
          const cost = costOf.get(v.id);
          const detail = detailOf.get(v.id);
          const segments = detail?.segments ?? [];
          const latest = segments[0];
          const economy = [...segments].reverse().filter((s) => s.km_per_liter != null).map((s) => ({ at: date(s.ended_at, timezone), value: Number(s.km_per_liter) }));
          const total = Number(cost?.total_cost ?? 0);
          const parts = [
            { name: "Fuel", value: Number(cost?.fuel_cost ?? 0), className: "bg-mod" },
            { name: "Servicing", value: Number(cost?.maintenance_cost ?? 0), className: "bg-mod/55" },
            { name: "Parking", value: Number(cost?.parking_cost ?? 0), className: "bg-foreground/30" },
          ];
          // A service can be due by date and by distance at once: list it once.
          const reminders = [...new Map([...(detail?.due.overdueByDate ?? []), ...(detail?.due.dueByOdometer ?? [])].map((r) => [r.id, r])).values()];
          return (
            <Panel key={v.id} className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-semibold tracking-tight">{v.name}</h3>
                  <p className="text-sm text-muted-foreground">{[v.make, v.model, v.year].filter(Boolean).join(" ")}</p>
                </div>
                <div className="flex items-center gap-2">
                  {v.plate_number && <Plate>{v.plate_number}</Plate>}
                  <RowActions>
<EntryDialog label="Edit vehicle" fields={vehicleFields} edit={{ id: v.id, values: v }} update={updateVehicle} />
<DeleteButton id={v.id} what={v.name} action={deleteVehicle} />
</RowActions>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">
                <Figure label="Odometer" value={`${num(cost?.current_odometer_km ?? v.initial_odometer_km)} km`} hint={`${num(cost?.distance_km)} km tracked`} />
                <Figure label="Cost per km" value={cost?.cost_per_km != null ? money(Number(cost.cost_per_km), currency, 3) : "—"} hint={`${rm(total)} in total`} />
                <Figure
                  label="Last full tank"
                  value={latest?.km_per_liter != null ? `${num(Number(latest.km_per_liter), 1)} km/L` : "—"}
                  hint={latest ? `${num(Number(latest.distance_km))} km on ${num(Number(latest.liters), 1)} L` : "Needs two full fills"}
                />
              </div>

              {total > 0 && (
                <div className="mt-6">
                  <div className="flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={parts.map((p) => `${p.name} ${rm(p.value)}`).join(", ")}>
                    {parts.map((p) => (
                      <div key={p.name} className={p.className} style={{ width: `${(p.value / total) * 100}%` }} />
                    ))}
                  </div>
                  <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                    {parts.map((p) => (
                      <li key={p.name} className="inline-flex items-center gap-2">
                        <span aria-hidden className={`size-2.5 rounded-sm ${p.className}`} />
                        {p.name} <span className="figure text-foreground">{rm(p.value)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {economy.length > 1 && (
                <div className="mt-6 border-t pt-5">
                  <p className="mb-3 text-sm text-muted-foreground">Fuel economy per tank</p>
                  <TrendChart data={economy} unit="km/L" label="Economy" />
                </div>
              )}

              {reminders.length > 0 && (
                <ul className="mt-6 flex flex-col gap-2 border-t pt-4">
                  {reminders.map((r) => (
                    <li key={`${r.id}-due`} className="flex items-center justify-between gap-3 text-sm">
                      <span>{label(r.kind)} is due</span>
                      <Pill tone="warn">{r.next_due_on && r.next_due_on <= today ? `Since ${day(r.next_due_on)}` : `At ${num(r.next_due_km)} km`}</Pill>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          );
        })}
      </div>
    </Section>
  );

  const fuelTab = (
    <Section id="fuel" title="Fuel" hint="The latest 15 fill-ups." aside={<EntryDialog label="Add fill-up" fields={fuelFields(vehicleOptions)} action={createFuelLog} />}>
      {fuel.length === 0 ? (
        <Empty title="No fill-ups yet">Log each visit to the pump to see what a kilometre costs.</Empty>
      ) : (
        <Table
          head={[{ label: "Date" }, { label: "Vehicle" }, { label: "Station" }, { label: "Odometer", right: true }, { label: "Litres", right: true }, { label: "Per litre", right: true }, { label: "Cost", right: true }, { label: "" }]}
          minWidth="48rem"
        >
          {fuel.map((f) => (
            <tr key={f.id}>
              <Td>{date(f.filled_at, timezone)}</Td>
              <Td>{nameOf.get(f.vehicle_id)}</Td>
              <Td>
                {f.station ?? "—"} {!f.is_full_tank && <Pill>Partial</Pill>}
              </Td>
              <Td right>{num(f.odometer_km)}</Td>
              <Td right>{num(Number(f.liters), 1)}</Td>
              <Td right>{money(Number(f.price_per_liter), currency)}</Td>
              <Td right>{rm(Number(f.total_cost))}</Td>
              <Td className="w-px text-right">
                <RowActions>
<EntryDialog label="Edit fill-up" fields={fuelFields(vehicleOptions)} edit={{ id: f.id, values: f }} update={updateFuelLog} />
<DeleteButton id={f.id} what="fill-up" action={deleteFuelLog} />
</RowActions>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </Section>
  );

  const servicingTab = (
    <Section id="servicing" title="Servicing" hint="Services, repairs, road tax and insurance." aside={<EntryDialog label="Add service" fields={maintenanceFields(vehicleOptions)} action={createMaintenanceLog} />}>
      {maintenance.length === 0 ? (
        <Empty title="Nothing logged yet">Log a service to get a reminder when the next one is due.</Empty>
      ) : (
        <RowList>
          {maintenance.map((m) => (
            <Row
              key={m.id}
              title={m.description || label(m.kind)}
              meta={[dayWithYear(m.performed_on), nameOf.get(m.vehicle_id), label(m.kind), m.workshop].filter(Boolean).join(" · ")}
              value={rm(Number(m.cost))}
              sub={m.next_due_on ? `Next due ${day(m.next_due_on)}` : m.next_due_km ? `Next at ${num(m.next_due_km)} km` : undefined}
              actions={<RowActions>
<EntryDialog label="Edit service" fields={maintenanceFields(vehicleOptions)} edit={{ id: m.id, values: m }} update={updateMaintenanceLog} />
<DeleteButton id={m.id} what={m.description || label(m.kind)} action={deleteMaintenanceLog} />
</RowActions>}
            />
          ))}
        </RowList>
      )}
    </Section>
  );

  const parkingTab = (
    <Section id="parking" title="Parking" hint="The latest 15 sessions." aside={<EntryDialog label="Add parking" fields={parkingFields(vehicleOptions)} action={createParkingLog} />}>
      {parking.length === 0 ? (
        <Empty title="No parking logged yet" />
      ) : (
        <RowList>
          {parking.map((p) => (
            <Row
              key={p.id}
              title={p.location || "Parking"}
              meta={[dateTime(p.started_at, timezone), p.authority, p.zone, p.payment_method].filter(Boolean).join(" · ")}
              value={p.ended_at ? rm(Number(p.cost)) : <Pill tone="mod">Running now</Pill>}
              actions={<RowActions>
<EntryDialog label="Edit parking" fields={parkingFields(vehicleOptions)} edit={{ id: p.id, values: p }} update={updateParkingLog} />
<DeleteButton id={p.id} what="parking session" action={deleteParkingLog} />
</RowActions>}
            />
          ))}
        </RowList>
      )}
    </Section>
  );

  return (
    <ModuleTabs
      tabs={[
        { id: "garage", label: "Garage", content: garageTab },
        { id: "fuel", label: "Fuel", content: fuelTab },
        { id: "servicing", label: "Servicing", content: servicingTab },
        { id: "parking", label: "Parking", content: parkingTab },
      ]}
    />
  );
}

export default function VehiclesPage() {
  return (
    <ModulePage module="vehicles" title="Vehicles" lede="Fuel, servicing and parking for everything you drive, and what each kilometre costs.">
      <Suspense fallback={<LogoLoader />}>
        <VehiclesContent />
      </Suspense>
    </ModulePage>
  );
}
