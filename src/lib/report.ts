import { balanceFor, minimumFor, money, paidFor, statusFor, type Expense, type TreasuryState } from "./domain";

export function monthStats(state: TreasuryState, month: string) {
  const eligible = state.members.filter((m) => m.active && m.joinedMonth <= month && statusFor(state, m.id, month) !== "waived");
  const contributors = eligible.filter((m) => paidFor(state, m.id, month) > 0).length;
  const completed = eligible.filter((m) => paidFor(state, m.id, month) >= minimumFor(state, month)).length;
  const parts = state.payments.filter((p) => !p.reversedAt).flatMap((p) => p.allocations.filter((a) => a.month === month).map((a) => ({ ...a, source: p.source })));
  const cashBase = parts.filter((p) => p.source !== "offset").reduce((s, p) => s + p.base, 0);
  const cashBonus = parts.filter((p) => p.source !== "offset").reduce((s, p) => s + p.bonus, 0);
  const offset = parts.filter((p) => p.source === "offset").reduce((s, p) => s + p.base + p.bonus, 0);
  const expenses = state.expenses.filter((e) => !e.reversedAt && e.spentAt.slice(0, 7) === month).sort((a, b) => a.spentAt.localeCompare(b.spentAt));
  const directOut = expenses.filter((e) => e.source === "direct").reduce((s, e) => s + e.amount, 0);
  return { eligible: eligible.length, contributors, completed, cashBase, cashBonus, offset, expenses, directOut };
}
export function groupReport(state: TreasuryState, month: string) {
  const stats = monthStats(state, month);
  const vault = balanceFor(state);
  const percent = stats.eligible ? Math.round(stats.contributors / stats.eligible * 100) : 0;
  const expenses = stats.expenses.length ? stats.expenses.map((e: Expense) => `• ${e.title}: ${money(e.amount)}${e.source === "offset" ? " (مقاصة بلا حركة نقدية)" : ""}`).join("\n") : "• ما كاين حتى مصروف";
  return `تقرير صندوق المجموعة — ${month}\n\nالمشاركة: ${stats.contributors}/${stats.eligible} عضو ساهمو (${percent}%)\nالمداخيل النقدية الأساسية: ${money(stats.cashBase)}\nفوق الخير النقدي: ${money(stats.cashBonus)}\nمقاصات الأعضاء (بلا حركة نقدية): ${money(stats.offset)}\n\nالمصاريف:\n${expenses}\n\nالرصيد المتبقي فالصندوق: ${money(vault.total)}\nالكاش: ${money(vault.cash)} | البنكة: ${money(vault.bank)}`;
}

function csvCell(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
function csv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return `\uFEFF${headers.map(csvCell).join(",")}\r\n${rows.map((row) => headers.map((h) => csvCell(row[h])).join(",")).join("\r\n")}`;
}
export function exportCsvTables(state: TreasuryState) {
  return {
    "members.csv": csv(state.members.map((m) => ({ ...m }))),
    "payments.csv": csv(state.payments.map(({ allocations, ...p }) => ({ ...p, allocations: JSON.stringify(allocations) }))),
    "expenses.csv": csv(state.expenses.map((e) => ({ ...e }))),
    "waivers.csv": csv(state.waivers.map((w) => ({ ...w }))),
    "audit.csv": csv(state.audit.map((a) => ({ ...a }))),
  };
}
export function validateImport(raw: unknown): TreasuryState {
  if (!raw || typeof raw !== "object") throw new Error("ملف JSON غير صالح");
  const value = raw as Partial<TreasuryState>;
  if (value.version !== 1 || !value.group?.id || !Array.isArray(value.members) || !Array.isArray(value.admins) || !Array.isArray(value.payments) || !Array.isArray(value.expenses) || !Array.isArray(value.waivers) || !Array.isArray(value.minimums) || !Array.isArray(value.audit)) throw new Error("نسخة الملف غير مدعومة أو ناقصة");
  const ids = new Set<string>();
  for (const item of [...value.members, ...value.payments, ...value.expenses, ...value.waivers]) {
    if (!item.id || ids.has(item.id)) throw new Error("معرّفات مكررة فالملف");
    ids.add(item.id);
  }
  if (!value.members.every((m) => typeof m.name === "string" && typeof m.phone === "string") || !value.payments.every((p) => Number.isSafeInteger(p.amount) && Array.isArray(p.allocations)) || !value.expenses.every((e) => Number.isSafeInteger(e.amount))) throw new Error("بيانات مالية غير صالحة");
  return { ...value, version: 1, appliedIds: value.appliedIds ?? [], revision: value.revision ?? 0 } as TreasuryState;
}
