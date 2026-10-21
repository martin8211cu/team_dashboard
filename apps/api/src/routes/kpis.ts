import { Hono } from "hono";
import type { KpiSummary } from "@team-dashboard/shared";
import { getKpiById, listKpis, type KpiRow } from "../db";

export const kpiRoutes = new Hono();

function toSummary(row: KpiRow & { updated_at: string }): KpiSummary {
  return {
    id: row.id,
    name: row.name,
    value: row.value,
    unit: row.unit,
    updatedAt: row.updated_at,
  };
}

kpiRoutes.get("/", async (c) => {
  const rows = await listKpis();
  return c.json(rows.map(toSummary));
});

kpiRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const row = await getKpiById(id);

  if (!row) {
    return c.json({ error: "KPI not found" }, 404);
  }

  return c.json(toSummary(row));
});
