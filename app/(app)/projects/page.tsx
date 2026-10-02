import { Suspense } from "react";
import { getSession } from "@/lib/app/session";
import { componentFields, inventoryFields, projectFields, toOptions } from "@/lib/app/forms";
import { label, money, num } from "@/lib/format";
import { createInventoryItem, createProject, deleteInventoryItem, deleteProject, saveProjectComponent, updateInventoryItem, updateProject } from "@/lib/actions/projects";
import { loadProjectsPage } from "@/lib/services/projects";
import type { InventoryItem, Project } from "@/lib/validators/projects";
import { DeleteButton } from "@/components/app/delete-button";
import { EntryDialog } from "@/components/app/entry-dialog";
import { LogoLoader } from "@/components/app/logo";
import { ModuleTabs } from "@/components/app/module-tabs";
import { RowActions, Empty, Meter, ModulePage, Panel, Pill, Row, RowList, Section, Table, Td } from "@/components/app/ui";

export const metadata = { title: "Projects" };

const PROJECT_TONE: Record<Project["status"], "mod" | "pos" | "warn" | "neutral" | "neg"> = {
  idea: "neutral",
  active: "mod",
  paused: "warn",
  done: "pos",
  abandoned: "neg",
};

const ITEM_TONE: Record<InventoryItem["status"], "mod" | "pos" | "warn" | "neutral" | "neg"> = {
  in_stock: "pos",
  in_use: "mod",
  reserved: "warn",
  broken: "neg",
  sold: "neutral",
};

const STATUS_ORDER: Project["status"][] = ["active", "paused", "idea", "done", "abandoned"];

async function ProjectsContent() {
  const { db, currency } = await getSession();
  const rm = (n: number) => money(n, currency);

  const { projects: projectRows, costs, inventory: items } = await loadProjectsPage(db);

  const costOf = new Map(costs.map((c) => [c.project_id, c]));
  const sortedProjects = [...projectRows].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
  const lowStock = items.filter((i) => i.status !== "sold" && i.status !== "broken" && i.reorder_level > 0 && i.quantity <= i.reorder_level);
  const stockValue = items.filter((i) => i.status !== "sold").reduce((sum, i) => sum + i.quantity * Number(i.unit_cost), 0);

  const buildsTab = (
    <Section
      id="builds"
      title="Builds"
      hint="Spending is every expense tagged to the build. Parts value is what its allocated parts cost."
      aside={
        <>
          {projectRows.length > 0 && items.length > 0 && (
            <EntryDialog label="Allocate part" description="Assign a part from inventory to a build." variant="outline" fields={componentFields(toOptions(projectRows), toOptions(items))} action={saveProjectComponent} />
          )}
          <EntryDialog label="Add build" fields={projectFields} action={createProject} />
        </>
      }
    >
      {sortedProjects.length === 0 ? (
        <Empty title="No builds yet">Add a build to track its budget and the parts it uses.</Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {sortedProjects.map((p) => {
            const cost = costOf.get(p.id);
            const spent = Number(cost?.spent ?? 0);
            const budget = p.budget != null ? Number(p.budget) : null;
            return (
              <Panel key={p.id} className="flex flex-col p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-display text-lg font-semibold tracking-tight">{p.name}</h3>
                    <p className="font-mono text-xs text-muted-foreground">#{p.expense_tag}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Pill tone={PROJECT_TONE[p.status]}>{label(p.status)}</Pill>
                    <RowActions>
<EntryDialog label="Edit build" fields={projectFields} edit={{ id: p.id, values: p }} update={updateProject} />
<DeleteButton id={p.id} what={p.name} action={deleteProject} />
</RowActions>
                  </div>
                </div>
                {p.description && <p className="mt-3 text-sm text-muted-foreground">{p.description}</p>}
                <div className="mt-auto pt-5">
                  <div className="mb-2 flex items-baseline justify-between gap-4 text-sm">
                    <span className="figure font-medium">{rm(spent)} spent</span>
                    <span className="text-muted-foreground">{budget != null ? `of ${rm(budget)} budget` : "No budget set"}</span>
                  </div>
                  <Meter label={`${p.name} budget used`} value={spent} max={budget ?? spent} limit />
                  <p className="mt-3 text-sm text-muted-foreground">
                    {num(cost?.bom_lines)} {Number(cost?.bom_lines ?? 0) === 1 ? "part" : "parts"} allocated, worth {rm(Number(cost?.bom_value ?? 0))}
                  </p>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </Section>
  );

  const inventoryTab = (
    <>
      {lowStock.length > 0 && (
        <Section id="low-stock" title="Running low" hint="Parts at or below the reorder level you set.">
          <RowList>
            {lowStock.map((i) => (
              <Row key={i.id} title={i.name} meta={[label(i.category), i.vendor].filter(Boolean).join(" · ")} value={`${num(i.quantity)} left`} sub={`Reorder at ${num(i.reorder_level)}`} />
            ))}
          </RowList>
        </Section>
      )}

      <Section id="inventory" title="Inventory" hint={`${num(items.length)} items worth ${rm(stockValue)}.`} aside={<EntryDialog label="Add item" fields={inventoryFields} action={createInventoryItem} />}>
        {items.length === 0 ? (
          <Empty title="Inventory is empty">Add parts and tools to know what is on the shelf.</Empty>
        ) : (
          <Table head={[{ label: "Item" }, { label: "Category" }, { label: "Location" }, { label: "Status" }, { label: "Qty", right: true }, { label: "Unit cost", right: true }, { label: "" }]} minWidth="46rem">
            {items.map((i) => (
              <tr key={i.id}>
                <Td>
                  <p className="font-medium">{i.name}</p>
                  {(i.manufacturer || i.model) && <p className="text-xs text-muted-foreground">{[i.manufacturer, i.model].filter(Boolean).join(" ")}</p>}
                </Td>
                <Td>{label(i.category)}</Td>
                <Td>{i.location ?? "—"}</Td>
                <Td>
                  <Pill tone={ITEM_TONE[i.status]}>{label(i.status)}</Pill>
                </Td>
                <Td right>{num(i.quantity)}</Td>
                <Td right>{rm(Number(i.unit_cost))}</Td>
                <Td className="w-px text-right">
                  <RowActions>
<EntryDialog label="Edit item" fields={inventoryFields} edit={{ id: i.id, values: i }} update={updateInventoryItem} />
<DeleteButton id={i.id} what={i.name} action={deleteInventoryItem} />
</RowActions>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Section>
    </>
  );

  return (
    <ModuleTabs
      tabs={[
        { id: "builds", label: "Builds", content: buildsTab },
        { id: "inventory", label: lowStock.length > 0 ? `Inventory (${lowStock.length} low)` : "Inventory", content: inventoryTab },
      ]}
    />
  );
}

export default function ProjectsPage() {
  return (
    <ModulePage module="projects" title="Projects" lede="Electronics builds, what they have cost, and the parts on hand.">
      <Suspense fallback={<LogoLoader />}>
        <ProjectsContent />
      </Suspense>
    </ModulePage>
  );
}
