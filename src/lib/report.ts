import {
  balanceFor,
  minimumFor,
  money,
  paidFor,
  statusFor,
  toMonth,
  type Expense,
  type TreasuryState,
} from "./domain";

export function monthStats(state: TreasuryState, month: string) {
  const eligible = state.members.filter(
    (m) =>
      (m.active || (m.archivedAt && month <= toMonth(new Date(m.archivedAt)))) &&
      m.joinedMonth <= month &&
      statusFor(state, m.id, month) !== "waived",
  );
  const contributors = eligible.filter(
    (m) => paidFor(state, m.id, month) > 0,
  ).length;
  const completed = eligible.filter(
    (m) => paidFor(state, m.id, month) >= minimumFor(state, month),
  ).length;
  const parts = state.payments
    .filter((p) => !p.reversedAt && toMonth(new Date(p.occurredAt)) === month)
    .flatMap((p) => p.allocations.map((a) => ({ ...a, source: p.source })));
  const cashBase = parts
    .filter((p) => p.source !== "offset")
    .reduce((s, p) => s + p.base, 0);
  const cashBonus = parts
    .filter((p) => p.source !== "offset")
    .reduce((s, p) => s + p.bonus, 0);
  const offset = parts
    .filter((p) => p.source === "offset")
    .reduce((s, p) => s + p.base + p.bonus, 0);
  const expenses = state.expenses
    .filter((e) => !e.reversedAt && toMonth(new Date(e.spentAt)) === month)
    .sort((a, b) => a.spentAt.localeCompare(b.spentAt));
  const directOut = expenses
    .filter((e) => e.source === "direct")
    .reduce((s, e) => s + e.amount, 0);
  return {
    eligible: eligible.length,
    contributors,
    completed,
    cashBase,
    cashBonus,
    offset,
    expenses,
    directOut,
  };
}
export function groupReport(state: TreasuryState, month: string) {
  const stats = monthStats(state, month);
  const vault = balanceFor(state);
  const percent = stats.eligible
    ? Math.round((stats.contributors / stats.eligible) * 100)
    : 0;
  const redact = (title: string) => {
    let cleaned = title;
    const names = state.members
      .flatMap((m) => [
        m.name,
        ...m.name.split(/\s+/).filter((part) => part.length >= 3),
      ])
      .sort((a, b) => b.length - a.length);
    for (const name of names) cleaned = cleaned.replaceAll(name, "عضو");
    return cleaned;
  };
  const expenses = stats.expenses.length
    ? stats.expenses
        .map(
          (e: Expense) =>
            `• ${redact(e.title)}: ${money(e.amount)}${e.source === "offset" ? " (مقاصة بلا حركة نقدية)" : ""}`,
        )
        .join("\n")
    : "• ما كاين حتى مصروف";
  return `تقرير صندوق المجموعة — ${month}\n\nالمشاركة: ${stats.contributors}/${stats.eligible} عضو ساهمو (${percent}%)\nالمداخيل النقدية الأساسية: ${money(stats.cashBase)}\nفوق الخير النقدي: ${money(stats.cashBonus)}\nمقاصات الأعضاء (بلا حركة نقدية): ${money(stats.offset)}\n\nالمصاريف:\n${expenses}\n\nالرصيد المتبقي فالصندوق: ${money(vault.total)}\nالكاش: ${money(vault.cash)} | البنكة: ${money(vault.bank)}`;
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}
function csv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return `\uFEFF${headers.map(csvCell).join(",")}\r\n${rows.map((row) => headers.map((h) => csvCell(row[h])).join(",")).join("\r\n")}`;
}
export function exportCsvTables(state: TreasuryState) {
  return {
    "members.csv": csv(state.members.map((m) => ({ ...m }))),
    "payments.csv": csv(
      state.payments.map(({ allocations, ...p }) => ({
        ...p,
        allocations: JSON.stringify(allocations),
      })),
    ),
    "expenses.csv": csv(state.expenses.map((e) => ({ ...e }))),
    "waivers.csv": csv(state.waivers.map((w) => ({ ...w }))),
    "audit.csv": csv(state.audit.map((a) => ({ ...a }))),
  };
}
export function validateImport(raw: unknown): TreasuryState {
  if (!raw || typeof raw !== "object") throw new Error("ملف JSON غير صالح");
  const value = raw as Partial<TreasuryState>;
  if (
    value.version !== 1 ||
    !value.group?.id ||
    !Array.isArray(value.members) ||
    !Array.isArray(value.admins) ||
    !Array.isArray(value.payments) ||
    !Array.isArray(value.expenses) ||
    !Array.isArray(value.waivers) ||
    !Array.isArray(value.minimums) ||
    !Array.isArray(value.audit)
  )
    throw new Error("نسخة الملف غير مدعومة أو ناقصة");
  const ids = new Set<string>();
  for (const item of [
    ...value.admins,
    ...value.members,
    ...value.payments,
    ...value.expenses,
    ...value.waivers,
  ]) {
    if (!item.id || ids.has(item.id)) throw new Error("معرّفات مكررة فالملف");
    ids.add(item.id);
  }
  const memberIds = new Set(value.members.map((m) => m.id));
  const adminIds = new Set(value.admins.map((a) => a.id));
  const isMonth = (month: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
  if (
    !value.members.every(
      (m) =>
        typeof m.name === "string" &&
        /^212[67]\d{8}$/.test(m.phone) &&
        isMonth(m.joinedMonth),
    ) ||
    !value.minimums.every(
      (m) => isMonth(m.month) && Number.isSafeInteger(m.amount) && m.amount > 0,
    ) ||
    !value.payments.every(
      (p) =>
        Number.isSafeInteger(p.amount) &&
        p.amount > 0 &&
        memberIds.has(p.memberId) &&
        adminIds.has(p.recordedByAdminId) &&
        ["cash", "bank", "offset"].includes(p.source) &&
        Array.isArray(p.allocations) &&
        p.allocations.every(
          (a) =>
            isMonth(a.month) &&
            Number.isSafeInteger(a.base) &&
            a.base >= 0 &&
            Number.isSafeInteger(a.bonus) &&
            a.bonus >= 0,
        ) &&
        p.allocations.reduce((s, a) => s + a.base + a.bonus, 0) === p.amount,
    ) ||
    !value.expenses.every(
      (e) =>
        Number.isSafeInteger(e.amount) &&
        e.amount > 0 &&
        adminIds.has(e.recordedByAdminId) &&
        ["direct", "offset"].includes(e.source) &&
        ["cash", "bank"].includes(e.channel) &&
        (e.source === "direct" ||
          Boolean(e.memberId && memberIds.has(e.memberId))),
    ) ||
    !value.waivers.every(
      (w) =>
        memberIds.has(w.memberId) &&
        adminIds.has(w.recordedByAdminId) &&
        isMonth(w.month),
    )
  )
    throw new Error("بيانات مالية غير صالحة");
  const state = {
    ...value,
    version: 1,
    appliedIds: value.appliedIds ?? [],
    revision: value.revision ?? 0,
  } as TreasuryState;
  const validOptionalDate = (value?: string) => value === undefined || (typeof value === "string" && Number.isFinite(Date.parse(value)));
  if (!state.members.every((member) => validOptionalDate(member.archivedAt)) ||
      !state.admins.every((admin) => validOptionalDate(admin.archivedAt)) ||
      !state.payments.every((payment) => validOptionalDate(payment.reversedAt) &&
        (payment.selectedMonth === undefined || isMonth(payment.selectedMonth)) &&
        (payment.mode === undefined || payment.mode === "bonus" || payment.mode === "prepay") &&
        (!payment.replacesId || state.payments.some((original) => original.id === payment.replacesId))) ||
      !state.expenses.every((expense) => validOptionalDate(expense.reversedAt) && (!expense.replacesId || state.expenses.some((original) => original.id === expense.replacesId))) ||
      !state.waivers.every((waiver) => validOptionalDate(waiver.reversedAt) && (!waiver.replacesId || state.waivers.some((original) => original.id === waiver.replacesId))))
    throw new Error("سجل التصحيحات في ملف JSON غير صالح");
  for (const expense of state.expenses.filter((e) => e.source === "offset")) {
    const linked = state.payments.find((p) => p.expenseId === expense.id);
    if (
      !linked ||
      linked.source !== "offset" ||
      linked.amount !== expense.amount ||
      Boolean(linked.reversedAt) !== Boolean(expense.reversedAt)
    )
      throw new Error("مقاصة غير متوازنة فالملف");
  }
  const vault = balanceFor(state);
  if (vault.cash < 0 || vault.bank < 0) throw new Error("الرصيد فالملف سالب");
  return state;
}
