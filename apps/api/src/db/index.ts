import { getDb } from "@team-dashboard/db";

export type KpiRow = {
  id: string;
  name: string;
  value: number;
  unit: string;
  updated_at: Date | string;
};

function rowToKpi(row: KpiRow): KpiRow & { updated_at: string } {
  return {
    ...row,
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

export async function listKpis(): Promise<Array<KpiRow & { updated_at: string }>> {
  const rows = await getDb()("kpis").select<KpiRow[]>("*").orderBy("name");
  return rows.map(rowToKpi);
}

export async function getKpiById(id: string): Promise<(KpiRow & { updated_at: string }) | null> {
  const row = await getDb()("kpis").where({ id }).first<KpiRow>();
  return row ? rowToKpi(row) : null;
}
