export type Channel = "cash" | "bank";
export type AllocationMode = "bonus" | "prepay";
export type MemberStatus = "unpaid" | "partial" | "paid" | "bonus" | "waived";
export type Category =
  "activities" | "logistics" | "aid" | "emergency" | "other";

export interface Group {
  id: string;
  name: string;
  code?: string;
}
export interface Admin {
  id: string;
  name: string;
  pin?: string;
  active: boolean;
  archivedAt?: string;
}
export interface Member {
  id: string;
  name: string;
  phone: string;
  joinedMonth: string;
  active: boolean;
  revision: number;
  archivedAt?: string;
  /** Private code used by the member-only passbook lookup. */
  accessPin?: string;
}
export interface Minimum {
  month: string;
  amount: number;
}
export interface Allocation {
  month: string;
  base: number;
  bonus: number;
}
export interface Payment {
  id: string;
  memberId: string;
  amount: number;
  source: Channel | "offset";
  selectedMonth?: string;
  mode?: AllocationMode;
  allocations: Allocation[];
  expenseId?: string;
  recordedByAdminId: string;
  occurredAt: string;
  reversedAt?: string;
  replacesId?: string;
}
export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: Category;
  source: "direct" | "offset";
  channel: Channel;
  memberId?: string;
  note?: string;
  receiptId?: string;
  spentAt: string;
  recordedByAdminId: string;
  reversedAt?: string;
  replacesId?: string;
}
export interface Waiver {
  id: string;
  memberId: string;
  month: string;
  recordedByAdminId: string;
  at: string;
  reversedAt?: string;
  replacesId?: string;
}
export type ExpenseInput = Pick<
  Expense,
  "title" | "amount" | "category" | "source" | "channel" | "memberId" | "note" | "receiptId" | "spentAt"
> & { mode?: AllocationMode };
export type PaymentInput = {
  memberId: string;
  month: string;
  amount: number;
  channel: Channel;
  mode: AllocationMode;
  occurredAt: string;
};
export interface Audit {
  id: string;
  action: string;
  entityId: string;
  adminId: string;
  at: string;
  detail: string;
}
export interface TreasuryState {
  version: 1;
  group: Group;
  admins: Admin[];
  members: Member[];
  minimums: Minimum[];
  payments: Payment[];
  expenses: Expense[];
  waivers: Waiver[];
  audit: Audit[];
  appliedIds: string[];
  revision: number;
}

export type Command =
  | {
      id: string;
      type: "payment";
      adminId: string;
      memberId: string;
      month: string;
      amount: number;
      channel: Channel;
      mode: AllocationMode;
      at: string;
    }
  | {
      id: string;
      type: "expense";
      adminId: string;
      title: string;
      amount: number;
      category: Category;
      source: "direct" | "offset";
      channel: Channel;
      memberId?: string;
      mode?: AllocationMode;
      note?: string;
      receiptId?: string;
      spentAt: string;
    }
  | {
      id: string;
      type: "waiver";
      adminId: string;
      memberId: string;
      month: string;
      at: string;
    }
  | {
      id: string;
      type: "minimum";
      adminId: string;
      amount: number;
      effectiveMonth: string;
      expectedRevision: number;
      at: string;
    }
  | {
      id: string;
      type: "member";
      adminId: string;
      member: Member;
      expectedRevision?: number;
      at: string;
    }
  | {
      id: string;
      type: "delete_member";
      adminId: string;
      memberId: string;
      at: string;
    }
  | {
      id: string;
      type: "monthly_contribution";
      adminId: string;
      memberId: string;
      month: string;
      amount: number;
      channel: Channel;
      mode: AllocationMode;
      expectedRevision?: number;
      at: string;
    }
  | { id: string; type: "correct_expense"; adminId: string; targetId: string; expectedRevision: number; replacement?: ExpenseInput; at: string }
  | { id: string; type: "correct_payment"; adminId: string; targetId: string; expectedRevision: number; replacement?: PaymentInput; at: string }
  | { id: string; type: "correct_waiver"; adminId: string; targetId: string; expectedRevision: number; replacement?: { memberId: string; month: string }; at: string }
  | { id: string; type: "minimum_rule"; adminId: string; month: string; amount?: number; expectedRevision: number; at: string }
  | { id: string; type: "admin_edit"; adminId: string; targetId: string; name: string; pin?: string; expectedRevision: number; at: string }
  | { id: string; type: "admin_archive"; adminId: string; targetId: string; archived: boolean; expectedRevision: number; at: string }
  | { id: string; type: "admin"; adminId: string; admin: Admin; at: string }
  | {
      id: string;
      type: "admin_status";
      adminId: string;
      targetId: string;
      active: boolean;
      at: string;
    }
  | {
      id: string;
      type: "receipt";
      adminId: string;
      expenseId: string;
      receiptId: string;
      at: string;
    }
  | { id: string; type: "undo"; adminId: string; entityId: string; at: string };

export const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
export const toMonth = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Casablanca",
    year: "numeric",
    month: "2-digit",
  }).format(date);
export function addMonths(month: string, offset: number): string {
  const [year, part] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, part - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
export const money = (centimes: number) =>
  `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: centimes % 100 ? 2 : 0 }).format(centimes / 100)} DH`;
export const validAmount = (amount: number) =>
  Number.isSafeInteger(amount) && amount > 0;
const validMonth = (month: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
const validChannel = (channel: string) =>
  channel === "cash" || channel === "bank";

export function minimumFor(state: TreasuryState, month: string): number {
  return (
    [...state.minimums]
      .filter((x) => x.month <= month)
      .sort((a, b) => b.month.localeCompare(a.month))[0]?.amount ?? 10000
  );
}
export function paidFor(state: TreasuryState, memberId: string, month: string) {
  return state.payments
    .filter((p) => !p.reversedAt && p.memberId === memberId)
    .flatMap((p) => p.allocations)
    .filter((a) => a.month === month)
    .reduce((sum, a) => sum + a.base + a.bonus, 0);
}
export function waived(state: TreasuryState, memberId: string, month: string) {
  return state.waivers.some(
    (w) => !w.reversedAt && w.memberId === memberId && w.month === month,
  );
}
export function statusFor(
  state: TreasuryState,
  memberId: string,
  month: string,
): MemberStatus {
  if (waived(state, memberId, month)) return "waived";
  const paid = paidFor(state, memberId, month);
  const min = minimumFor(state, month);
  return paid === 0
    ? "unpaid"
    : paid < min
      ? "partial"
      : paid === min
        ? "paid"
        : "bonus";
}
export function arrearsFor(
  state: TreasuryState,
  member: Member,
  beforeMonth: string,
) {
  let count = 0,
    amount = 0;
  for (
    let month = member.joinedMonth, guard = 0;
    month < beforeMonth && guard < 240;
    month = addMonths(month, 1), guard++
  ) {
    if (waived(state, member.id, month)) continue;
    const remaining = Math.max(
      0,
      minimumFor(state, month) - paidFor(state, member.id, month),
    );
    if (remaining) {
      count++;
      amount += remaining;
    }
  }
  return { count, amount };
}
export function balanceFor(state: TreasuryState) {
  const result = { cash: 0, bank: 0 };
  for (const payment of state.payments)
    if (!payment.reversedAt && payment.source !== "offset")
      result[payment.source] += payment.amount;
  for (const expense of state.expenses)
    if (!expense.reversedAt && expense.source === "direct")
      result[expense.channel] -= expense.amount;
  return { ...result, total: result.cash + result.bank };
}
export function allocationPreview(
  state: TreasuryState,
  memberId: string,
  month: string,
  amount: number,
  mode: AllocationMode,
  allowInactive = false,
): Allocation[] {
  if (!validAmount(amount)) throw new Error("دخل مبلغ صحيح أكبر من الصفر");
  if (!validMonth(month) || (mode !== "bonus" && mode !== "prepay"))
    throw new Error("شهر أو طريقة التوزيع غير صالحة");
  const member = state.members.find((m) => m.id === memberId && (m.active || allowInactive));
  if (!member || month < member.joinedMonth || waived(state, memberId, month))
    throw new Error("هاد الشهر ما قابلش للأداء");
  const result: Allocation[] = [];
  let remaining = amount;
  for (let i = 0; remaining > 0 && i < 120; i++) {
    const target = addMonths(month, i);
    if (waived(state, memberId, target)) continue;
    const due = Math.max(
      0,
      minimumFor(state, target) - paidFor(state, memberId, target),
    );
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
  if (!state.admins.some((a) => a.id === id && a.active))
    throw new Error("المشرف غير صالح");
}
function audit(
  state: TreasuryState,
  command: Command,
  action: string,
  entityId: string,
  detail: string,
) {
  state.audit.unshift({
    id: newId(),
    action,
    entityId,
    adminId: command.adminId,
    at:
      "at" in command
        ? command.at
        : "spentAt" in command
          ? command.spentAt
          : new Date().toISOString(),
    detail,
  });
}
function assertRevision(state: TreasuryState, expected: number) {
  if (state.revision !== expected)
    throw new Error("تبدلات البيانات من جهاز آخر؛ راجع السجل قبل الحفظ");
}
function assertBalances(state: TreasuryState) {
  const balance = balanceFor(state);
  if (balance.cash < 0 || balance.bank < 0)
    throw new Error("هذا التعديل غادي يخلي رصيد الكاش أو البنكة سالب");
}
function postPayment(
  state: TreasuryState,
  id: string,
  adminId: string,
  input: PaymentInput,
  replacesId?: string,
) {
  if (!validChannel(input.channel) || !Number.isFinite(Date.parse(input.occurredAt)))
    throw new Error("طريقة الأداء أو التاريخ غير صالح");
  const allocations = allocationPreview(
    state, input.memberId, input.month, input.amount, input.mode, Boolean(replacesId),
  );
  state.payments.push({
    id, memberId: input.memberId, amount: input.amount, source: input.channel,
    selectedMonth: input.month, mode: input.mode,
    allocations, recordedByAdminId: adminId, occurredAt: input.occurredAt, replacesId,
  });
}
function postExpense(
  state: TreasuryState,
  id: string,
  adminId: string,
  input: ExpenseInput,
  replacesId?: string,
) {
  if (!validAmount(input.amount) || !input.title.trim() ||
      !validChannel(input.channel) ||
      !["direct", "offset"].includes(input.source) ||
      !["activities", "logistics", "aid", "emergency", "other"].includes(input.category) ||
      !Number.isFinite(Date.parse(input.spentAt)))
    throw new Error("بيانات المصروف غير صالحة");
  if (input.source === "direct" && balanceFor(state)[input.channel] < input.amount)
    throw new Error("الرصيد ديال هاد الحساب ما كافيش");
  if (input.source === "offset") {
    if (!input.memberId) throw new Error("اختار العضو اللي خلّص");
    const allocations = allocationPreview(
      state, input.memberId, toMonth(new Date(input.spentAt)), input.amount,
      input.mode ?? "bonus", Boolean(replacesId),
    );
    state.payments.push({
      id: `${id}-offset`, memberId: input.memberId, amount: input.amount,
      source: "offset", selectedMonth: toMonth(new Date(input.spentAt)), mode: input.mode ?? "bonus", allocations, expenseId: id, recordedByAdminId: adminId,
      occurredAt: input.spentAt, replacesId: replacesId ? `${replacesId}-offset` : undefined,
    });
  }
  state.expenses.push({
    id, title: input.title.trim(), amount: input.amount, category: input.category,
    source: input.source, channel: input.channel,
    memberId: input.source === "offset" ? input.memberId : undefined,
    note: input.note, receiptId: input.receiptId, spentAt: input.spentAt,
    recordedByAdminId: adminId, replacesId,
  });
}
export function minimumRuleEditable(state: TreasuryState, month: string) {
  if (month <= toMonth(new Date())) return false;
  const nextRule = state.minimums.map((rule) => rule.month).filter((item) => item > month).sort()[0];
  const affects = (target: string) => target >= month && (!nextRule || target < nextRule);
  return !state.payments.some((payment) => !payment.reversedAt && payment.allocations.some((allocation) => affects(allocation.month))) &&
    !state.waivers.some((waiver) => !waiver.reversedAt && affects(waiver.month));
}
export function applyCommand(
  previous: TreasuryState,
  command: Command,
): TreasuryState {
  if (previous.appliedIds.includes(command.id)) return previous;
  const state: TreasuryState = structuredClone(previous);
  assertAdmin(state, command.adminId);
  switch (command.type) {
    case "payment": {
      postPayment(state, command.id, command.adminId, { ...command, occurredAt: command.at });
      audit(
        state,
        command,
        "payment",
        command.id,
        `أداء ${money(command.amount)}`,
      );
      break;
    }
    case "expense": {
      postExpense(state, command.id, command.adminId, command);
      audit(
        state,
        command,
        "expense",
        command.id,
        `مصروف ${money(command.amount)}: ${command.title.trim()}`,
      );
      break;
    }
    case "waiver": {
      if (
        !validMonth(command.month) ||
        !state.members.some(
          (m) => m.id === command.memberId && m.joinedMonth <= command.month,
        )
      )
        throw new Error("شهر الإعفاء أو العضو غير صالح");
      if (
        paidFor(state, command.memberId, command.month) > 0 ||
        waived(state, command.memberId, command.month)
      )
        throw new Error("ما يمكنش الإعفاء من بعد الأداء");
      state.waivers.push({
        id: command.id,
        memberId: command.memberId,
        month: command.month,
        recordedByAdminId: command.adminId,
        at: command.at,
      });
      audit(state, command, "waiver", command.id, `إعفاء ${command.month}`);
      break;
    }
    case "minimum": {
      if (
        !validAmount(command.amount) ||
        !validMonth(command.effectiveMonth) ||
        command.expectedRevision !== state.revision ||
        command.effectiveMonth <= toMonth(new Date(command.at)) ||
        (state.minimums.some((rule) => rule.month === command.effectiveMonth) && !minimumRuleEditable(state, command.effectiveMonth))
      )
        throw new Error("تغيير الحد الأدنى خاصو يبدأ الشهر الجاي");
      state.minimums = [
        ...state.minimums.filter((x) => x.month !== command.effectiveMonth),
        { month: command.effectiveMonth, amount: command.amount },
      ];
      audit(
        state,
        command,
        "minimum",
        command.id,
        `الحد الأدنى ${money(command.amount)} ابتداء من ${command.effectiveMonth}`,
      );
      break;
    }
    case "member": {
      const index = state.members.findIndex((m) => m.id === command.member.id);
      if (
        !command.member.name.trim() ||
        !/^212[67]\d{8}$/.test(command.member.phone) ||
        !validMonth(command.member.joinedMonth)
      )
        throw new Error("اسم أو رقم الهاتف غير صالح");
      if (index >= 0) {
        if (command.expectedRevision !== state.members[index].revision)
          throw new Error("تبدلات معلومات العضو من جهاز آخر");
        if (command.member.joinedMonth !== state.members[index].joinedMonth && (
          state.payments.some((payment) => payment.memberId === command.member.id) ||
          state.waivers.some((waiver) => waiver.memberId === command.member.id) ||
          state.expenses.some((expense) => expense.memberId === command.member.id)
        )) throw new Error("شهر انضمام العضو مقفل لأنه عندو سجل مالي");
        state.members[index] = {
          ...command.member,
          revision: state.members[index].revision + 1,
        };
      } else state.members.push({ ...command.member, revision: 0 });
      audit(
        state,
        command,
        "member",
        command.member.id,
        index >= 0 ? "تعديل عضو" : "عضو جديد",
      );
      break;
    }
    case "delete_member": {
      const member = state.members.find((item) => item.id === command.memberId);
      if (!member) throw new Error("العضو غير موجود");
      const hasHistory = state.payments.some((payment) => payment.memberId === member.id) ||
        state.waivers.some((waiver) => waiver.memberId === member.id) ||
        state.expenses.some((expense) => expense.memberId === member.id);
      if (hasHistory) {
        member.active = false;
        member.archivedAt = command.at;
        member.revision++;
      } else state.members = state.members.filter((item) => item.id !== member.id);
      audit(state, command, "delete_member", member.id, hasHistory ? `أرشفة العضو ${member.name}` : `حذف العضو ${member.name}`);
      break;
    }
    case "monthly_contribution": {
      if (command.expectedRevision !== undefined) assertRevision(state, command.expectedRevision);
      if (!validMonth(command.month) || command.amount < 0 || !Number.isSafeInteger(command.amount))
        throw new Error("المبلغ أو الشهر غير صالح");
      if (command.amount > 0 && !validChannel(command.channel))
        throw new Error("طريقة الأداء غير صالحة");
      const member = state.members.find((item) => item.id === command.memberId);
      if (!member || command.month < member.joinedMonth)
        throw new Error("العضو أو الشهر غير صالح");

      // Retain other prepayment months in replacement records. Linked offsets
      // must be corrected through their expense so the item remains balanced.
      let replacedPaymentId: string | undefined;
      for (const payment of state.payments) {
        if (payment.reversedAt || payment.memberId !== command.memberId) continue;
        const removed = payment.allocations
          .filter((allocation) => allocation.month === command.month)
          .reduce((sum, allocation) => sum + allocation.base + allocation.bonus, 0);
        if (!removed) continue;
        if (payment.expenseId) throw new Error("صحح المصروف المرتبط بالمقاصة أولا");
        replacedPaymentId ??= payment.id;
        payment.reversedAt = command.at;
        const retained = payment.allocations.filter((allocation) => allocation.month !== command.month);
        if (retained.length) state.payments.push({
          ...payment,
          id: `${command.id}-retained-${payment.id}`,
          amount: retained.reduce((sum, allocation) => sum + allocation.base + allocation.bonus, 0),
          selectedMonth: retained[0].month,
          mode: "prepay",
          allocations: retained,
          reversedAt: undefined,
          replacesId: payment.id,
          recordedByAdminId: command.adminId,
        });
      }
      for (const waiver of state.waivers)
        if (!waiver.reversedAt && waiver.memberId === command.memberId && waiver.month === command.month)
          waiver.reversedAt = command.at;
      if (command.amount > 0) {
        postPayment(state, `${command.id}-payment`, command.adminId, {
          memberId: command.memberId, month: command.month, amount: command.amount,
          channel: command.channel, mode: command.mode, occurredAt: command.at,
        }, replacedPaymentId);
      }
      assertBalances(state);
      audit(
        state,
        command,
        "monthly_contribution",
        command.memberId,
        command.amount ? `تعديل مساهمة ${command.month} إلى ${money(command.amount)}` : `إلغاء مساهمة ${command.month}`,
      );
      break;
    }
    case "correct_expense": {
      assertRevision(state, command.expectedRevision);
      const target = state.expenses.find((expense) => expense.id === command.targetId && !expense.reversedAt);
      if (!target) throw new Error("المصروف تبدل أو تحذف؛ راجع السجل");
      target.reversedAt = command.at;
      const linked = state.payments.find((payment) => payment.expenseId === target.id && !payment.reversedAt);
      if (linked) linked.reversedAt = command.at;
      if (command.replacement) postExpense(state, command.id, command.adminId, command.replacement, target.id);
      assertBalances(state);
      audit(state, command, "correct_expense", target.id, command.replacement ? "تعديل مصروف" : "حذف مصروف");
      break;
    }
    case "correct_payment": {
      assertRevision(state, command.expectedRevision);
      const target = state.payments.find((payment) => payment.id === command.targetId && !payment.reversedAt);
      if (!target) throw new Error("المساهمة تبدلات أو تحذفات؛ راجع السجل");
      if (target.expenseId) throw new Error("صحح المصروف المرتبط بالمقاصة أولا");
      target.reversedAt = command.at;
      if (command.replacement) postPayment(state, command.id, command.adminId, command.replacement, target.id);
      assertBalances(state);
      audit(state, command, "correct_payment", target.id, command.replacement ? "تعديل مساهمة" : "حذف مساهمة");
      break;
    }
    case "correct_waiver": {
      assertRevision(state, command.expectedRevision);
      const target = state.waivers.find((waiver) => waiver.id === command.targetId && !waiver.reversedAt);
      if (!target) throw new Error("الإعفاء تبدل أو تحذف؛ راجع السجل");
      target.reversedAt = command.at;
      if (command.replacement) {
        const { memberId, month } = command.replacement;
        const member = state.members.find((item) => item.id === memberId);
        if (!member || !validMonth(month) || month < member.joinedMonth ||
            waived(state, memberId, month) || paidFor(state, memberId, month) > 0)
          throw new Error("شهر الإعفاء أو العضو غير صالح");
        state.waivers.push({ id: command.id, memberId, month, recordedByAdminId: command.adminId, at: command.at, replacesId: target.id });
      }
      audit(state, command, "correct_waiver", target.id, command.replacement ? "تعديل إعفاء" : "حذف إعفاء");
      break;
    }
    case "minimum_rule": {
      assertRevision(state, command.expectedRevision);
      if (!state.minimums.some((rule) => rule.month === command.month) ||
          !minimumRuleEditable(state, command.month) ||
          (command.amount !== undefined && !validAmount(command.amount)))
        throw new Error("هذا الحد الأدنى مستعمل أو الشهر مغلق");
      state.minimums = state.minimums.filter((rule) => rule.month !== command.month);
      if (command.amount !== undefined) state.minimums.push({ month: command.month, amount: command.amount });
      audit(state, command, "minimum_rule", command.month, command.amount === undefined ? "حذف قاعدة الحد الأدنى" : "تعديل قاعدة الحد الأدنى");
      break;
    }
    case "admin": {
      if (
        !command.admin.name.trim() ||
        state.admins.some((a) => a.id === command.admin.id)
      )
        throw new Error("بيانات المشرف غير صالحة");
      state.admins.push(command.admin);
      audit(state, command, "admin", command.admin.id, "مشرف جديد");
      break;
    }
    case "admin_status": {
      const target = state.admins.find((a) => a.id === command.targetId);
      if (
        !target ||
        Boolean(target.archivedAt) ||
        target.id === command.adminId ||
        (state.admins.filter((a) => a.active).length <= 1 && !command.active)
      )
        throw new Error("ما يمكنش تغيير هاد المشرف");
      target.active = command.active;
      audit(
        state,
        command,
        "admin_status",
        target.id,
        command.active ? "تفعيل مشرف" : "إيقاف مشرف",
      );
      break;
    }
    case "admin_edit": {
      assertRevision(state, command.expectedRevision);
      const target = state.admins.find((item) => item.id === command.targetId);
      if (!target || target.archivedAt || !command.name.trim() ||
          (command.pin !== undefined && !/^\d{6}$/.test(command.pin)))
        throw new Error("بيانات المشرف غير صالحة");
      target.name = command.name.trim();
      if (command.pin !== undefined) target.pin = command.pin;
      audit(state, command, "admin_edit", target.id, "تعديل المشرف");
      break;
    }
    case "admin_archive": {
      assertRevision(state, command.expectedRevision);
      const target = state.admins.find((item) => item.id === command.targetId);
      if (!target || target.id === command.adminId ||
          (command.archived && state.admins.filter((item) => item.active).length <= 1))
        throw new Error("ما يمكنش أرشفة هذا المشرف");
      target.archivedAt = command.archived ? command.at : undefined;
      target.active = !command.archived;
      audit(state, command, "admin_archive", target.id, command.archived ? "أرشفة مشرف" : "استرجاع مشرف");
      break;
    }
    case "receipt": {
      const expense = state.expenses.find((e) => e.id === command.expenseId);
      if (!expense || !command.receiptId.startsWith("receipt:"))
        throw new Error("الوصل غير صالح");
      expense.receiptId = command.receiptId;
      audit(state, command, "receipt", expense.id, "إضافة وصل للمصروف");
      break;
    }
    case "undo": {
      const payment = state.payments.find((p) => p.id === command.entityId);
      const expense = state.expenses.find((e) => e.id === command.entityId);
      const waiver = state.waivers.find((w) => w.id === command.entityId);
      if (
        (!payment || payment.reversedAt) &&
        (!expense || expense.reversedAt) &&
        (!waiver || waiver.reversedAt)
      )
        throw new Error("هاد العملية ما قابلاش للتراجع");
      if (payment?.expenseId)
        throw new Error("رجع المصروف المرتبط بالمقاصة كامل");
      if (payment) payment.reversedAt = command.at;
      if (expense) {
        expense.reversedAt = command.at;
        const offset = state.payments.find((p) => p.expenseId === expense.id);
        if (offset) offset.reversedAt = command.at;
      }
      if (waiver) waiver.reversedAt = command.at;
      if (balanceFor(state).cash < 0 || balanceFor(state).bank < 0)
        throw new Error("ما يمكنش التراجع حيث الرصيد غادي يولي سالب");
      audit(state, command, "undo", command.entityId, "تراجع عن العملية");
      break;
    }
    default:
      throw new Error("نوع العملية غير معروف");
  }
  state.appliedIds.push(command.id);
  state.revision++;
  return state;
}
