import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { adminDataQuery } from "@/lib/queries";
import { cellText, parseRole, parseTiming } from "@/lib/roster";
import { importLocations, importMembers, type ImportReport } from "@/lib/roster.functions";
import { Modal } from "./modal";

type Kind = "members" | "locations";

const CONFIG = {
  members: {
    title: "Import members",
    columns: ["Name", "ITS", "Contact", "Type (optional)"],
    example: [
      ["Husain Ali", "12345678", "9876543210", "Tipper"],
      ["Murtaza Saifee", "23456789", "9876500011", "Chorus"],
    ],
    note: "Type can be Tipper or Chorus. Leave it empty for Chorus.",
    file: "zakereen-members-template.xlsx",
  },
  locations: {
    title: "Import locations",
    columns: ["Mohalla", "Address", "Timing", "Group name (optional)"],
    example: [
      ["Ezzy", "12 Saifee Street", "7:30 PM", ""],
      ["Ezzy", "4 Burhani Lane", "8:00 PM", "Group A"],
    ],
    note: "Timing like 7:30 PM or 19:30. Group name must match an existing group exactly.",
    file: "zakereen-locations-template.xlsx",
  },
} as const;

// Header words used to find each column; falls back to column order when no header row.
const HEADERS: Record<Kind, string[][]> = {
  members: [["name"], ["its"], ["contact", "phone", "mobile", "number"], ["type", "role", "tipper", "chorus"]],
  locations: [["mohalla"], ["address"], ["timing", "time"], ["group"]],
};

function mapColumns(kind: Kind, firstRow: unknown[]): { indexes: number[]; hasHeader: boolean } {
  const cells = firstRow.map((c) => cellText(c).toLowerCase());
  const indexes = HEADERS[kind].map((words) => cells.findIndex((c) => words.some((w) => c.includes(w))));
  const hasHeader = indexes.slice(0, 3).filter((i) => i >= 0).length >= 2;
  return hasHeader
    ? { indexes: indexes.map((i, pos) => (i >= 0 ? i : pos === 3 ? -1 : pos)), hasHeader }
    : { indexes: [0, 1, 2, 3], hasHeader: false };
}

export function ImportSheet({ kind, open, onOpenChange }: { kind: Kind; open: boolean; onOpenChange: (o: boolean) => void }) {
  const cfg = CONFIG[kind];
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const importMembersFn = useServerFn(importMembers);
  const importLocationsFn = useServerFn(importLocations);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<unknown[][]>([]);
  const [startRow, setStartRow] = useState(1);
  const [indexes, setIndexes] = useState<number[]>([0, 1, 2, 3]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);

  useEffect(() => {
    if (open) {
      setFileName(null);
      setRows([]);
      setError(null);
      setReport(null);
    }
  }, [open]);

  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([cfg.columns.map((c) => c.replace(" (optional)", "")), ...cfg.example.map((r) => [...r])]);
    ws["!cols"] = cfg.columns.map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, kind === "members" ? "Members" : "Locations");
    XLSX.writeFile(wb, cfg.file);
  }

  async function onFile(file: File) {
    setError(null);
    setReport(null);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer());
      const sheetName = wb.SheetNames[0];
      const sheet = sheetName ? wb.Sheets[sheetName] : undefined;
      if (!sheet) throw new Error("The file has no sheets.");
      const all = XLSX.utils
        .sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, blankrows: false, defval: "" })
        .filter((r) => r.some((c) => cellText(c) !== ""));
      if (!all.length) throw new Error("The sheet is empty.");
      const { indexes: idx, hasHeader } = mapColumns(kind, all[0] ?? []);
      setIndexes(idx);
      setStartRow(hasHeader ? 2 : 1);
      setRows(hasHeader ? all.slice(1) : all);
      setFileName(file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file. Use an .xlsx file.");
      setRows([]);
      setFileName(null);
    }
  }

  const pick = (r: unknown[], col: number) => (indexes[col]! >= 0 ? r[indexes[col]!] : "");

  async function runImport() {
    setBusy(true);
    setError(null);
    try {
      const result =
        kind === "members"
          ? await importMembersFn({
              data: {
                rows: rows.map((r, i) => ({
                  row: i + startRow,
                  name: cellText(pick(r, 0)),
                  itsId: cellText(pick(r, 1)),
                  phone: cellText(pick(r, 2)),
                  role: parseRole(pick(r, 3)),
                })),
              },
            })
          : await importLocationsFn({
              data: {
                rows: rows.map((r, i) => ({
                  row: i + startRow,
                  mohalla: cellText(pick(r, 0)),
                  address: cellText(pick(r, 1)),
                  timing: parseTiming(pick(r, 2)),
                  groupName: cellText(pick(r, 3)),
                })),
              },
            });
      setReport(result);
      await qc.invalidateQueries({ queryKey: adminDataQuery.queryKey });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={cfg.title} description="Upload an Excel (.xlsx) file.">
      {report ? (
        <div className="space-y-4">
          <div className="tone-mint flex items-center gap-3 rounded-2xl p-4">
            <CheckCircle2 className="size-6 shrink-0" />
            <p className="font-display text-lg font-bold">
              {report.added} {kind === "members" ? "member" : "location"}
              {report.added === 1 ? "" : "s"} added
            </p>
          </div>
          {report.skipped.length ? (
            <div>
              <p className="mb-2 text-sm font-semibold">{report.skipped.length} row(s) skipped</p>
              <ul className="max-h-64 space-y-1.5 overflow-y-auto rounded-2xl bg-warning-soft p-3 text-sm">
                {report.skipped.map((s) => (
                  <li key={`${s.row}-${s.reason}`} className="text-warning">
                    <span className="font-semibold">Row {s.row}:</span> {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <Button variant="ink" size="lg" className="w-full" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl bg-muted p-4">
            <p className="mb-2 text-sm font-semibold">Columns, in this order</p>
            <div className="flex flex-wrap gap-1.5">
              {cfg.columns.map((c, i) => (
                <span key={c} className="rounded-full bg-card px-3 py-1 text-xs font-semibold">
                  {i + 1}. {c}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{cfg.note} A header row is optional.</p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={downloadTemplate}>
              <Download /> Download template
            </Button>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="press flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-input bg-card px-4 py-8 text-center hover:border-ink"
          >
            {fileName ? <FileSpreadsheet className="size-7" /> : <Upload className="size-7" />}
            <span className="font-semibold">{fileName ?? "Choose .xlsx file"}</span>
            <span className="text-xs text-muted-foreground">
              {fileName ? `${rows.length} row${rows.length === 1 ? "" : "s"} found · tap to change` : "From your phone or computer"}
            </span>
          </button>

          {error ? (
            <p role="alert" className="rounded-xl bg-warning-soft px-4 py-3 text-sm font-medium text-warning">
              {error}
            </p>
          ) : null}

          <Button variant="ink" size="lg" className="w-full" disabled={!rows.length || busy} onClick={runImport}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            {busy ? "Importing…" : rows.length ? `Import ${rows.length} row${rows.length === 1 ? "" : "s"}` : "Import"}
          </Button>
        </div>
      )}
    </Modal>
  );
}
