export type Channel = "cash" | "bank";
export type AllocationMode = "bonus" | "prepay";
export type MemberStatus = "unpaid" | "partial" | "paid" | "bonus" | "waived";
export type Category = "activities" | "logistics" | "aid" | "emergency" | "other";

export interface Group { id: string; name: string; code?: string }
export interface Admin { id: string; name: string; pin?: string; active: boolean }
export interface Member { id: string; name: string; phone: string; joinedMonth: string; active: boolean; revision: number }
export interface Minimum { month: string; amount: number }
export interface Allocation { month: string; base: number; bonus: number }
export interface Payment {
  id: string; memberId: string; amount: number; source: Channel | "offset";
  allocations: Allocation[]; expenseId?: string; recordedByAdminId: string;
  occurredAt: string; reversedAt?: string;
}
export interface Expense {
  id: string; title: string; amount: number; category: Category; source: "direct" | "offset";
  channel: Channel; memberId?: string; note?: string; receiptId?: string;
  spentAt: string; recordedByAdminId: string; reversedAt?: string;
}
export interface Waiver { id: string; memberId: string; month: string; recordedByAdminId: string; at: string; reversedAt?: string }
export interface Audit { id: string; action: string; entityId: string; adminId: string; at: string; detail: string }
export interface TreasuryState {
  version: 1; group: Group; admins: Admin[]; members: Member[]; minimums: Minimum[];
  payments: Payment[]; expenses: Expense[]; waivers: Waiver[]; audit: Audit[];
  appliedIds: string[]; revision: number;
}

export type Command =
  | { id: string; type: "payment"; adminId: string; memberId: string; month: string; amount: number; channel: Channel; mode: AllocationMode; at: string }
  | { id: string; type: "expense"; adminId: string; title: string; amount: number; category: Category; source: "direct" | "offset"; channel: Channel; memberId?: string; mode?: AllocationMode; note?: string; receiptId?: string; spentAt: string }
  | { id: string; type: "waiver"; adminId: string; memberId: string; month: string; at: string }
  | { id: string; type: "minimum"; adminId: string; amount: number; effectiveMonth: string; expectedRevision: number; at: string }
  | { id: string; type: "member"; adminId: string; member: Member; expectedRevision?: number; at: string }
  | { id: string; type: "admin"; adminId: string; admin: Admin; at: string }
  | { id: string; type: "undo"; adminId: string; entityId: string; at: string };

export const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
export const toMonth = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca", year: "numeric", month: "2-digit" }).format(date);
export function addMonths(month: string, offset: number): string {
  const [year, part] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, part - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
export const money = (centimes: number) => `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: centimes % 100 ? 2 : 0 }).format(centimes / 100)} DH`;
export const validAmount = (amount: number) => Number.isSafeInteger(amount) && amount > 0;

export function minimumFor(state: TreasuryState, month: string): number {
  return [...state.minimums].filter((x) => x.month <= month).sort((a, b) => b.month.localeCompare(a.month))[0]?.amount ?? 10000;
}
export function paidFor(state: TreasuryState, memberId: string, month: string) {
  return state.payments.filter((p) => !p.reversedAt && p.memberId === memberId)
    .flatMap((p) => p.allocations).filter((a) => a.month === month)
    .reduce((sum, a) => sum + a.base + a.bonus, 0);
}
export function waived(state: TreasuryState, memberId: string, month: string) {
  return state.waivers.some((w) => !w.reversedAt && w.memberId === memberId && w.month === month);
}
export function statusFor(state: TreasuryState, memberId: string, month: string): MemberStatus {
  if (waived(state, memberId, month)) return "waived";
  const paid = paidFor(state, memberId, month);
  const min = minimumFor(state, month);
  return paid === 0 ? "unpaid" : paid < min ? "partial" : paid === min ? "paid" : "bonus";
}
export function arrearsFor(state: TreasuryState, member: Member, beforeMonth: string) {
  let count = 0, amount = 0;
  for (let month = member.joinedMonth, guard = 0; month < beforeMonth && guard < 240; month = addMonths(month, 1), guard++) {
    if (waived(state, member.id, month)) continue;
    const remaining = Math.max(0, minimumFor(state, month) - paidFor(state, member.id, month));
    if (remaining) { count++; amount += remaining; }
  }
  return { count, amount };
}
export function balanceFor(state: TreasuryState) {
  const result = { cash: 0, bank: 0 };
  for (const payment of state.payments) if (!payment.reversedAt && payment.source !== "offset") result[payment.source] += payment.amount;
  for (const expense of state.expenses) if (!expense.reversedAt && expense.source === "direct") result[expense.channel] -= expense.amount;
  return { ...result, total: result.cash + result.bank };
}
export function allocationPreview(state: TreasuryState, memberId: string, month: string, amount: number, mode: AllocationMode): Allocation[] {
  if (!validAmount(amount)) throw new Error("دخل مبلغ صحيح أكبر من الصفر");
  const member = state.members.find((m) => m.id === memberId && m.active);
  if (!member || month < member.joinedMonth || waived(state, memberId, month)) throw new Error("هاد الشهر ما قابلش للأداء");
  const result: Allocation[] = [];
  let remaining = amount;
  for (let i = 0; remaining > 0 && i < 120; i++) {
    const target = addMonths(month, i);
    if (waived(state, memberId, target)) continue;
    const due = Math.max(0, minimumFor(state, target) - paidFor(state, memberId, target));
    const base = Math.min(remaining, due);
    remaining -= base;
    const bonus = mode === "bonus" && i === 0 ? remaining : 0;
    remaining -= bonus;
    if (base || bonus) result.push({ month: target, base, bonus });
    if (mode === "bonus") break;
  }
  if (remaining) throw new Error("المبلغ كيغطي أكثر من 10 سنين؛ نقصو");
  return result;
}
function assertAdmin(state: TreasuryState, id: string) {
  if (!state.admins.some((a) => a.id === id && a.active)) throw new Error("المشرف غير صالح");
}
function audit(state: TreasuryState, command: Command, action: string, entityId: string, detail: string) {
  state.audit.unshift({ id: newId(), action, entityId, adminId: command.adminId, at: "at" in command ? command.at : "spentAt" in command ? command.spentAt : new Date().toISOString(), detail });
}
export function applyCommand(previous: TreasuryState, command: Command): TreasuryState {
  if (previous.appliedIds.includes(command.id)) return previous;
  const state: TreasuryState = structuredClone(previous);
  assertAdmin(state, command.adminId);
  switch (command.type) {
    case "payment": {
      const allocations = allocationPreview(state, command.memberId, command.month, command.amount, command.mode);
      state.payments.push({ id: command.id, memberId: command.memberId, amount: command.amount, source: command.channel, allocations, recordedByAdminId: command.adminId, occurredAt: command.at });
      audit(state, command, "payment", command.id, `أداء ${money(command.amount)}`);
      break;
    }
    case "expense": {
      if (!validAmount(command.amount) || !command.title.trim()) throw new Error("دخل السبب والمبلغ الصحيح");
      if (command.source === "direct" && balanceFor(state)[command.channel] < command.amount) throw new Error("الرصيد ديال هاد الحساب ما كافيش");
      const expense: Expense = { id: command.id, title: command.title.trim(), amount: command.amount, category: command.category, source: command.source, channel: command.channel, memberId: command.memberId, note: command.note, receiptId: command.receiptId, spentAt: command.spentAt, recordedByAdminId: command.adminId };
      if (command.source === "offset") {
        if (!command.memberId) throw new Error("اختار العضو اللي خلّص");
        const month = toMonth(new Date(command.spentAt));
        const allocations = allocationPreview(state, command.memberId, month, command.amount, command.mode ?? "bonus");
        state.payments.push({ id: `${command.id}-offset`, memberId: command.memberId, amount: command.amount, source: "offset", allocations, expenseId: command.id, recordedByAdminId: command.adminId, occurredAt: command.spentAt });
      }
      state.expenses.push(expense);
      audit(state, command, "expense", command.id, `مصروف ${money(command.amount)}: ${expense.title}`);
      break;
    }
    case "waiver": {
      if (paidFor(state, command.memberId, command.month) > 0 || waived(state, command.memberId, command.month)) throw new Error("ما يمكنش الإعفاء من بعد الأداء");
      state.waivers.push({ id: command.id, memberId: command.memberId, month: command.month, recordedByAdminId: command.adminId, at: command.at });
      audit(state, command, "waiver", command.id, `إعفاء ${command.month}`);
      break;
    }
    case "minimum": {
      if (!validAmount(command.amount) || command.expectedRevision !== state.revision || command.effectiveMonth <= toMonth(new Date(command.at))) throw new Error("تغيير الحد الأدنى خاصو يبدأ الشهر الجاي");
      state.minimums = [...state.minimums.filter((x) => x.month !== command.effectiveMonth), { month: command.effectiveMonth, amount: command.amount }];
      audit(state, command, "minimum", command.id, `الحد الأدنى ${money(command.amount)} ابتداء من ${command.effectiveMonth}`);
      break;
    }
    case "member": {
      const index = state.members.findIndex((m) => m.id === command.member.id);
      if (!command.member.name.trim() || !/^212[67]\d{8}$/.test(command.member.phone)) throw new Error("اسم أو رقم الهاتف غير صالح");
      if (index >= 0) {
        if (command.expectedRevision !== state.members[index].revision) throw new Error("تبدلات معلومات العضو من جهاز آخر");
        state.members[index] = { ...command.member, revision: state.members[index].revision + 1 };
      } else state.members.push({ ...command.member, revision: 0 });
      audit(state, command, "member", command.member.id, index >= 0 ? "تعديل عضو" : "عضو جديد");
      break;
    }
    case "admin": {
      if (!command.admin.name.trim() || state.admins.some((a) => a.id === command.admin.id)) throw new Error("بيانات المشرف غير صالحة");
      state.admins.push(command.admin);
      audit(state, command, "admin", command.admin.id, "مشرف جديد");
      break;
    }
    case "undo": {
      const payment = state.payments.find((p) => p.id === command.entityId);
      const expense = state.expenses.find((e) => e.id === command.entityId);
      const waiver = state.waivers.find((w) => w.id === command.entityId);
      if ((!payment || payment.reversedAt) && (!expense || expense.reversedAt) && (!waiver || waiver.reversedAt)) throw new Error("هاد العملية ما قابلاش للتراجع");
      if (payment) payment.reversedAt = command.at;
      if (expense) { expense.reversedAt = command.at; const offset = state.payments.find((p) => p.expenseId === expense.id); if (offset) offset.reversedAt = command.at; }
      if (waiver) waiver.reversedAt = command.at;
      audit(state, command, "undo", command.entityId, "تراجع عن العملية");
      break;
    }
  }
  state.appliedIds.push(command.id);
  state.revision++;
  return state;
}
