import { transportReportTemplate } from "../constants/transport";
import type { BuiltTransportRow, GroupReportRow, ResponseCounts } from "../types/app.types";

export const EMPTY_COUNTS: ResponseCounts = {
  transport_count: 0,
  dejeuner_count: 0,
  equipement_count: 0,
  autres_count: 0,
};

export function buildTransportRowsForGroup(
  rowsFromDb: GroupReportRow[],
  groupNumber: number
): BuiltTransportRow[] {
  return transportReportTemplate.map((templateRow) => {
    const existing = rowsFromDb.find(
      (row) =>
        String(row.theme) === "transport" &&
        Number(row.group_number) === groupNumber &&
        String(row.row_key) === templateRow.rowKey
    );

    return {
      id: existing?.id ?? null,
      rowKey: String(existing?.row_key ?? templateRow.rowKey),
      label: String(existing?.label ?? templateRow.label),
      factor: Number(existing?.factor ?? templateRow.factor),
      persons: Number(existing?.persons ?? 0),
      distanceTotalKm: Number(existing?.quantity ?? 0),
      updatedBy: existing?.updated_by ?? null,
    };
  });
}
