import test from "node:test";
import assert from "node:assert/strict";
import {
  addMonths,
  allocationPreview,
  applyCommand,
  arrearsFor,
  balanceFor,
  minimumFor,
  paidFor,
  statusFor,
  toMonth,
  type TreasuryState,
} from "../src/lib/domain";
import { createEmptyState, createSeed } from "../src/lib/seed";
import { groupReport, monthStats, validateImport } from "../src/lib/report";
import { parseBackup } from "../src/lib/backup";
import { normalizeMoroccanPhone, privateMessage, whatsappUrl } from "../src/lib/whatsapp";
import { analyticsFor } from "../src/lib/analytics";

function base() {
  const state = createEmptyState("g", "Group", "a", "Admin");
  state.members.push({
    id: "m",
    name: "عضو تجريبي",
    phone: "212612345678",
    joinedMonth: "2026-01",
    active: true,
    revision: 0,
  });
  state.minimums = [{ month: "2026-01", amount: 10000 }];
  return state;
}
const pay = (
  state: TreasuryState,
  id: string,
  month: string,
  amount: number,
  mode: "bonus" | "prepay" = "bonus",
) =>
  applyCommand(state, {
    id,
    type: "payment",
    adminId: "a",
    memberId: "m",
    month,
    amount,
    channel: "cash",
    mode,
    at: `${month}-10T12:00:00Z`,
  });

test("seed has all requested states and cash reconciliation", () => {
  const state = createSeed();
  const current = toMonth(new Date());
  assert.equal(state.members.length, 8);
  assert.equal(state.admins.length, 2);
  assert.equal(statusFor(state, "m2", current), "partial");
  assert.equal(statusFor(state, "m4", current), "bonus");
  assert.equal(statusFor(state, "m5", current), "waived");
  assert.equal(statusFor(state, "m6", current), "partial");
  const vault = balanceFor(state);
  const inflow = state.payments
    .filter((p) => p.source !== "offset")
    .reduce((sum, p) => sum + p.amount, 0);
  const outflow = state.expenses
    .filter((e) => e.source === "direct")
    .reduce((sum, e) => sum + e.amount, 0);
  assert.equal(vault.total, inflow - outflow);
});

test("multiple partial payments, bonus, and prepay allocate exactly", () => {
  let state = base();
  state = pay(state, "p1", "2026-01", 4000);
  assert.equal(statusFor(state, "m", "2026-01"), "partial");
  state = pay(state, "p2", "2026-01", 6000);
  assert.equal(statusFor(state, "m", "2026-01"), "paid");
  state = pay(state, "p3", "2026-01", 2500);
  assert.equal(statusFor(state, "m", "2026-01"), "bonus");
  const preview = allocationPreview(state, "m", "2026-02", 25000, "prepay");
  assert.deepEqual(
    preview.map((a) => [a.month, a.base]),
    [
      ["2026-02", 10000],
      ["2026-03", 10000],
      ["2026-04", 5000],
    ],
  );
  state = pay(state, "p4", "2026-02", 25000, "prepay");
  assert.equal(state.payments.find((payment) => payment.id === "p4")?.selectedMonth, "2026-02");
  assert.equal(state.payments.find((payment) => payment.id === "p4")?.mode, "prepay");
  assert.equal(paidFor(state, "m", "2026-04"), 5000);
  assert.equal(statusFor(state, "m", "2026-04"), "partial");
});

test("waiver removes debt, offset leaves vault unchanged, undo reverses both", () => {
  let state = base();
  state = applyCommand(state, {
    id: "w",
    type: "waiver",
    adminId: "a",
    memberId: "m",
    month: "2026-01",
    at: "2026-01-02T12:00:00Z",
  });
  assert.equal(arrearsFor(state, state.members[0], "2026-03").count, 1);
  const before = balanceFor(state);
  state = applyCommand(state, {
    id: "e",
    type: "expense",
    adminId: "a",
    title: "Activity",
    amount: 5000,
    category: "activities",
    source: "offset",
    channel: "cash",
    memberId: "m",
    spentAt: "2026-02-08T12:00:00Z",
  });
  assert.deepEqual(balanceFor(state), before);
  assert.equal(paidFor(state, "m", "2026-02"), 5000);
  assert.throws(() =>
    applyCommand(state, {
      id: "bad",
      type: "undo",
      adminId: "a",
      entityId: "e-offset",
      at: "2026-02-09T12:00:00Z",
    }),
  );
  state = applyCommand(state, {
    id: "undo",
    type: "undo",
    adminId: "a",
    entityId: "e",
    at: "2026-02-09T12:00:00Z",
  });
  assert.equal(paidFor(state, "m", "2026-02"), 0);
  assert.deepEqual(balanceFor(state), before);
});

test("direct expense rejects insufficient funds and duplicate command is idempotent", () => {
  let state = base();
  state = pay(state, "p1", "2026-01", 10000);
  const command = {
    id: "e1",
    type: "expense" as const,
    adminId: "a",
    title: "Supplies",
    amount: 11000,
    category: "logistics" as const,
    source: "direct" as const,
    channel: "cash" as const,
    spentAt: "2026-01-11T12:00:00Z",
  };
  assert.throws(() => applyCommand(state, command), /الرصيد/);
  state = applyCommand(state, { ...command, amount: 5000 });
  assert.strictEqual(applyCommand(state, { ...command, amount: 5000 }), state);
  assert.equal(balanceFor(state).cash, 5000);
  assert.throws(
    () =>
      applyCommand(state, {
        id: "u",
        type: "undo",
        adminId: "a",
        entityId: "p1",
        at: "2026-01-12T12:00:00Z",
      }),
    /سالب/,
  );
});

test("minimum changes only future dues and anonymous report has all expenses", () => {
  let state = base();
  const current = toMonth(new Date());
  const next = addMonths(current, 1);
  state = applyCommand(state, {
    id: "min",
    type: "minimum",
    adminId: "a",
    amount: 15000,
    effectiveMonth: next,
    expectedRevision: state.revision,
    at: new Date().toISOString(),
  });
  assert.equal(minimumFor(state, current), 10000);
  assert.equal(minimumFor(state, next), 15000);
  state = applyCommand(state, {
    id: "ex1",
    type: "expense",
    adminId: "a",
    title: "Travel عضو تجريبي",
    amount: 3000,
    category: "activities",
    source: "offset",
    channel: "cash",
    memberId: "m",
    spentAt: `${current}-10T12:00:00Z`,
  });
  state = applyCommand(state, {
    id: "ex2",
    type: "expense",
    adminId: "a",
    title: "Food",
    amount: 2000,
    category: "aid",
    source: "offset",
    channel: "cash",
    memberId: "m",
    spentAt: `${current}-11T12:00:00Z`,
  });
  const report = groupReport(state, current);
  assert.match(report, /Travel/);
  assert.match(report, /Food/);
  assert.doesNotMatch(report, /عضو تجريبي/);
});

test("WhatsApp formatter accepts Moroccan mobile forms", () => {
  assert.equal(normalizeMoroccanPhone("0612345678"), "212612345678");
  assert.equal(normalizeMoroccanPhone("+212712345678"), "212712345678");
  assert.equal(normalizeMoroccanPhone("00212612345678"), "212612345678");
  assert.equal(normalizeMoroccanPhone("0512345678"), null);
  assert.match(
    whatsappUrl("0612345678", "سلام عليكم")!,
    /^https:\/\/wa\.me\/212612345678\?text=/,
  );
});

test("member WhatsApp messages include the private access PIN when available", () => {
  const state = base();
  state.members[0].accessPin = "4921";
  assert.match(privateMessage(state, state.members[0], "2026-01", "محمد", "friendly"), /4921/);
});

test("admin status keeps the acting admin active and imports reject broken offsets", () => {
  let state = base();
  state.admins.push({ id: "b", name: "Second", active: true });
  state = applyCommand(state, {
    id: "off",
    type: "admin_status",
    adminId: "a",
    targetId: "b",
    active: false,
    at: new Date().toISOString(),
  });
  assert.equal(state.admins.find((admin) => admin.id === "b")?.active, false);
  assert.throws(() =>
    applyCommand(state, {
      id: "self",
      type: "admin_status",
      adminId: "a",
      targetId: "a",
      active: false,
      at: new Date().toISOString(),
    }),
  );
  assert.deepEqual(validateImport(state), state);
  const broken = structuredClone(state);
  broken.expenses.push({
    id: "offset",
    title: "Expense",
    amount: 5000,
    category: "other",
    source: "offset",
    channel: "cash",
    memberId: "m",
    spentAt: "2026-01-10T12:00:00Z",
    recordedByAdminId: "a",
  });
  assert.throws(() => validateImport(broken), /مقاصة/);
});

test("prepayment income stays in the payment month and backup format validates receipts", () => {
  let state = base();
  state = pay(state, "advance", "2026-01", 25000, "prepay");
  assert.equal(monthStats(state, "2026-01").cashBase, 25000);
  assert.equal(monthStats(state, "2026-02").cashBase, 0);
  assert.equal(statusFor(state, "m", "2026-02"), "paid");
  const backup = parseBackup({
    format: "sandouq-backup",
    version: 1,
    state,
    receipts: {},
  });
  assert.equal(backup.state.payments.length, 1);
  assert.throws(() =>
    parseBackup({
      ...backup,
      receipts: { bogus: "data:image/png;base64,AA==" },
    }),
  );
});

test("monthly contribution can be edited or reset without disturbing other prepaid months", () => {
  let state = base();
  state = pay(state, "advance", "2026-01", 25000, "prepay");
  state = applyCommand(state, {
    id: "edit-january",
    type: "monthly_contribution",
    adminId: "a",
    memberId: "m",
    month: "2026-01",
    amount: 5000,
    channel: "cash",
    mode: "bonus",
    at: "2026-01-15T12:00:00Z",
  });
  assert.equal(paidFor(state, "m", "2026-01"), 5000);
  assert.equal(paidFor(state, "m", "2026-02"), 10000);
  assert.equal(paidFor(state, "m", "2026-03"), 5000);
  state = applyCommand(state, {
    id: "reset-january",
    type: "monthly_contribution",
    adminId: "a",
    memberId: "m",
    month: "2026-01",
    amount: 0,
    channel: "cash",
    mode: "bonus",
    at: "2026-01-16T12:00:00Z",
  });
  assert.equal(statusFor(state, "m", "2026-01"), "unpaid");
  assert.equal(paidFor(state, "m", "2026-02"), 10000);
});

test("deleting a member with history archives them and preserves financial records", () => {
  let state = base();
  state = pay(state, "payment", "2026-01", 10000);
  state = applyCommand(state, {
    id: "offset", type: "expense", adminId: "a", title: "Supplies", amount: 5000,
    category: "other", source: "offset", channel: "cash", memberId: "m",
    spentAt: "2026-01-12T12:00:00Z",
  });
  state = applyCommand(state, {
    id: "delete", type: "delete_member", adminId: "a", memberId: "m", at: "2026-01-13T12:00:00Z",
  });
  assert.equal(state.members.length, 1);
  assert.equal(state.members[0].active, false);
  assert.ok(state.members[0].archivedAt);
  assert.equal(state.payments.length, 2);
  assert.equal(state.waivers.length, 0);
  assert.equal(state.expenses.length, 1);
  assert.equal(balanceFor(state).cash, 10000);
});

test("expense corrections preserve history and restore direct balances", () => {
  let state = pay(base(), "cash", "2026-01", 20000);
  state = applyCommand(state, { id: "spent", type: "expense", adminId: "a", title: "Supplies", amount: 5000,
    category: "other", source: "direct", channel: "cash", spentAt: "2026-01-12T12:00:00Z" });
  const revision = state.revision;
  const edited = { id: "correct", type: "correct_expense" as const, adminId: "a", targetId: "spent", expectedRevision: revision,
    replacement: { title: "Supplies revised", amount: 8000, category: "logistics" as const, source: "direct" as const, channel: "cash" as const, spentAt: "2026-01-12T12:00:00Z" }, at: "2026-01-13T12:00:00Z" };
  state = applyCommand(state, edited);
  assert.equal(balanceFor(state).cash, 12000);
  assert.ok(state.expenses.find((expense) => expense.id === "spent")?.reversedAt);
  assert.equal(state.expenses.find((expense) => expense.id === "correct")?.replacesId, "spent");
  assert.equal(applyCommand(state, edited), state);
  assert.throws(() => applyCommand(state, { ...edited, id: "stale" }));
  state = applyCommand(state, { id: "remove", type: "correct_expense", adminId: "a", targetId: "correct", expectedRevision: state.revision, at: "2026-01-14T12:00:00Z" });
  assert.equal(balanceFor(state).cash, 20000);
  assert.equal(monthStats(state, "2026-01").expenses.length, 0);
});

test("offset corrections keep expense and contribution equal without changing cash", () => {
  let state = base();
  state = applyCommand(state, { id: "offset", type: "expense", adminId: "a", title: "Aid", amount: 5000,
    category: "aid", source: "offset", channel: "cash", memberId: "m", spentAt: "2026-01-12T12:00:00Z" });
  const before = balanceFor(state);
  state = applyCommand(state, { id: "offset-edit", type: "correct_expense", adminId: "a", targetId: "offset", expectedRevision: state.revision,
    replacement: { title: "Aid updated", amount: 7000, category: "aid", source: "offset", channel: "cash", memberId: "m", spentAt: "2026-01-12T12:00:00Z" }, at: "2026-01-13T12:00:00Z" });
  assert.deepEqual(balanceFor(state), before);
  assert.equal(paidFor(state, "m", "2026-01"), 7000);
  assert.deepEqual(validateImport(state), state);
  state = applyCommand(state, { id: "offset-delete", type: "correct_expense", adminId: "a", targetId: "offset-edit", expectedRevision: state.revision, at: "2026-01-14T12:00:00Z" });
  assert.equal(paidFor(state, "m", "2026-01"), 0);
  assert.deepEqual(balanceFor(state), before);
});

test("payment corrections preserve prepayments and reject a negative balance", () => {
  let state = pay(base(), "advance", "2026-01", 25000, "prepay");
  state = applyCommand(state, { id: "adjust", type: "correct_payment", adminId: "a", targetId: "advance", expectedRevision: state.revision,
    replacement: { memberId: "m", month: "2026-01", amount: 15000, channel: "cash", mode: "prepay", occurredAt: "2026-01-10T12:00:00Z" }, at: "2026-01-11T12:00:00Z" });
  assert.equal(paidFor(state, "m", "2026-01"), 10000);
  assert.equal(paidFor(state, "m", "2026-02"), 5000);
  assert.equal(balanceFor(state).cash, 15000);
  state = applyCommand(state, { id: "spent-after", type: "expense", adminId: "a", title: "Equipment", amount: 14000, category: "other", source: "direct", channel: "cash", spentAt: "2026-01-12T12:00:00Z" });
  assert.throws(() => applyCommand(state, { id: "too-low", type: "correct_payment", adminId: "a", targetId: "adjust", expectedRevision: state.revision,
    replacement: { memberId: "m", month: "2026-01", amount: 1000, channel: "cash", mode: "bonus", occurredAt: "2026-01-10T12:00:00Z" }, at: "2026-01-13T12:00:00Z" }));
});

test("waiver, admin archive, and future minimum rules respect their guards", () => {
  let state = base();
  state = applyCommand(state, { id: "waive", type: "waiver", adminId: "a", memberId: "m", month: "2026-01", at: "2026-01-02T12:00:00Z" });
  state = applyCommand(state, { id: "unwaive", type: "correct_waiver", adminId: "a", targetId: "waive", expectedRevision: state.revision, at: "2026-01-03T12:00:00Z" });
  assert.equal(statusFor(state, "m", "2026-01"), "unpaid");
  state.admins.push({ id: "b", name: "Second", active: true });
  assert.throws(() => applyCommand(state, { id: "self-archive", type: "admin_archive", adminId: "a", targetId: "a", archived: true, expectedRevision: state.revision, at: "2026-01-04T12:00:00Z" }));
  state = applyCommand(state, { id: "archive", type: "admin_archive", adminId: "a", targetId: "b", archived: true, expectedRevision: state.revision, at: "2026-01-04T12:00:00Z" });
  assert.equal(state.admins.find((admin) => admin.id === "b")?.active, false);
  assert.throws(() => applyCommand(state, { id: "forged", type: "waiver", adminId: "b", memberId: "m", month: "2026-02", at: "2026-02-01T12:00:00Z" }));
  const future = addMonths(toMonth(new Date()), 2);
  state.minimums.push({ month: future, amount: 12000 });
  state = applyCommand(state, { id: "minimum-edit", type: "minimum_rule", adminId: "a", month: future, amount: 13000, expectedRevision: state.revision, at: new Date().toISOString() });
  assert.equal(minimumFor(state, future), 13000);
  assert.throws(() => applyCommand(state, { id: "minimum-old", type: "minimum_rule", adminId: "a", month: "2026-01", amount: 20000, expectedRevision: state.revision, at: new Date().toISOString() }));
});

test("analytics excludes reversals and offsets from cashflow while counting all active expense categories", () => {
  const state = createSeed();
  const result = analyticsFor(state);
  assert.equal(result.flow.length, 6);
  assert.equal(result.flow[5].month, toMonth(new Date()));
  const inflow = state.payments.filter((payment) => !payment.reversedAt && payment.source !== "offset" && toMonth(new Date(payment.occurredAt)) === result.flow[5].month).reduce((sum, payment) => sum + payment.amount, 0);
  assert.equal(result.flow[5].inflow, inflow);
  assert.ok(result.commitment.percent >= 0 && result.commitment.percent <= 100);
  assert.equal(result.categories.reduce((sum, category) => sum + category.amount, 0), state.expenses.filter((expense) => !expense.reversedAt).reduce((sum, expense) => sum + expense.amount, 0));
});

test("member join month is editable before financial history and locked after activity", () => {
  let state = base();
  state = applyCommand(state, { id: "move-join", type: "member", adminId: "a", member: { ...state.members[0], joinedMonth: "2026-02" }, expectedRevision: 0, at: "2026-02-01T12:00:00Z" });
  assert.equal(state.members[0].joinedMonth, "2026-02");
  state = pay(state, "first", "2026-02", 10000);
  assert.throws(() => applyCommand(state, { id: "move-history", type: "member", adminId: "a", member: { ...state.members[0], joinedMonth: "2026-03" }, expectedRevision: state.members[0].revision, at: "2026-03-01T12:00:00Z" }));
});
