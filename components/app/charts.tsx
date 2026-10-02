"use client";

import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";

const compact = new Intl.NumberFormat("en-MY", { notation: "compact", maximumFractionDigits: 1 });
const plain = (digits: number) => new Intl.NumberFormat("en-MY", { minimumFractionDigits: digits, maximumFractionDigits: digits });

type TooltipRow = { name: string; value: string; color: string };

function TooltipCard({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="grid min-w-36 gap-1.5 rounded-lg border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-medium">{title}</p>
      {rows.map((row) => (
        <p key={row.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 rounded-[2px]" style={{ background: row.color }} />
            {row.name}
          </span>
          <span className="font-mono font-medium tabular-nums">{row.value}</span>
        </p>
      ))}
    </div>
  );
}

const AXIS = { tickLine: false, axisLine: false, tickMargin: 10 } as const;

/** Income against spending per month. */
export function CashflowChart({ data, currency }: { data: { month: string; income: number; spending: number }[]; currency: string }) {
  const config = {
    income: { label: "Income", color: "hsl(var(--mod))" },
    spending: { label: "Spending", color: "hsl(var(--foreground) / 0.22)" },
  } satisfies ChartConfig;
  const money = new Intl.NumberFormat("en-MY", { style: "currency", currency });

  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <BarChart data={data} barGap={4} margin={{ left: 0, right: 0, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="month" {...AXIS} />
        <YAxis {...AXIS} width={44} tickFormatter={(v: number) => compact.format(v)} />
        <ChartTooltip
          cursor={{ fill: "hsl(var(--muted))" }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TooltipCard
                title={String(label)}
                rows={payload.map((p) => ({ name: config[p.dataKey as keyof typeof config].label, value: money.format(Number(p.value)), color: String(p.color) }))}
              />
            ) : null
          }
        />
        <Bar dataKey="income" fill="var(--color-income)" radius={[5, 5, 0, 0]} maxBarSize={32} />
        <Bar dataKey="spending" fill="var(--color-spending)" radius={[5, 5, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ChartContainer>
  );
}

/** One value per day against a daily goal. Days that met the goal are drawn solid. */
export function GoalBarChart({ data, goal, unit, label }: { data: { day: string; value: number }[]; goal?: number; unit: string; label: string }) {
  const config = { value: { label, color: "hsl(var(--mod))" } } satisfies ChartConfig;
  const number = plain(0);

  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full">
      <BarChart data={data} margin={{ left: 0, right: 0, top: 16 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="day" {...AXIS} />
        <YAxis {...AXIS} width={44} tickFormatter={(v: number) => compact.format(v)} domain={[0, (max: number) => Math.max(max, goal ?? 0)]} />
        <ChartTooltip
          cursor={{ fill: "hsl(var(--muted))" }}
          content={({ active, payload, label: day }) =>
            active && payload?.length ? <TooltipCard title={String(day)} rows={[{ name: label, value: `${number.format(Number(payload[0].value))} ${unit}`, color: "hsl(var(--mod))" }]} /> : null
          }
        />
        {goal != null && goal > 0 && (
          <ReferenceLine y={goal} stroke="hsl(var(--foreground) / 0.45)" strokeDasharray="4 4" label={{ value: `Goal ${number.format(goal)} ${unit}`, position: "insideTopRight", fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
        )}
        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={28}>
          {data.map((d) => (
            <Cell key={d.day} fill="var(--color-value)" fillOpacity={goal != null && d.value < goal ? 0.4 : 1} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/** A single measure over time, e.g. km per litre per tank or score per session. */
export function TrendChart({ data, unit, label, digits = 1 }: { data: { at: string; value: number }[]; unit: string; label: string; digits?: number }) {
  const config = { value: { label, color: "hsl(var(--mod))" } } satisfies ChartConfig;
  const number = plain(digits);

  return (
    <ChartContainer config={config} className="aspect-auto h-52 w-full">
      <LineChart data={data} margin={{ left: 0, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="at" {...AXIS} />
        <YAxis {...AXIS} width={44} domain={["auto", "auto"]} tickFormatter={(v: number) => compact.format(v)} />
        <ChartTooltip
          content={({ active, payload, label: at }) =>
            active && payload?.length ? <TooltipCard title={String(at)} rows={[{ name: label, value: `${number.format(Number(payload[0].value))} ${unit}`, color: "hsl(var(--mod))" }]} /> : null
          }
        />
        <Line dataKey="value" type="monotone" stroke="var(--color-value)" strokeWidth={2} dot={{ r: 3, fill: "var(--color-value)", strokeWidth: 0 }} activeDot={{ r: 5 }} />
      </LineChart>
    </ChartContainer>
  );
}
