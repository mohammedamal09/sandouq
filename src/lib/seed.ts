import { addMonths, applyCommand, type TreasuryState, toMonth } from "./domain";

export function createSeed(): TreasuryState {
  const current = toMonth(new Date());
  const first = addMonths(current, -2);
  const middle = addMonths(current, -1);
  let state: TreasuryState = {
    version: 1,
    group: { id: "demo-group", name: "صندوق المجموعة" },
    admins: [
      { id: "admin-mohamed", name: "محمد", pin: "123456", active: true },
      { id: "admin-amine", name: "أمين", pin: "654321", active: true },
    ],
    members: [
      ["m1", "يوسف العلوي", "212612345678"], ["m2", "فاطمة الزهراء", "212698765432"],
      ["m3", "أمينة الإدريسي", "212712345678"], ["m4", "حمزة بنعلي", "212723456789"],
      ["m5", "سارة الفاسي", "212634567890"], ["m6", "رشيد التازي", "212745678901"],
      ["m7", "مريم الناصري", "212656789012"], ["m8", "أنس المريني", "212767890123"],
    ].map(([id, name, phone]) => ({ id, name, phone, joinedMonth: first, active: true, revision: 0 })),
    minimums: [{ month: first, amount: 10000 }], payments: [], expenses: [], waivers: [], audit: [], appliedIds: [], revision: 0,
  };
  const date = (month: string, day: number) => `${month}-${String(day).padStart(2, "0")}T12:00:00.000Z`;
  const pay = (id: string, memberId: string, month: string, amount: number, channel: "cash" | "bank", adminId = "admin-mohamed") => {
    state = applyCommand(state, { id, type: "payment", adminId, memberId, month, amount, channel, mode: "bonus", at: date(month, 8) });
  };
  pay("p01", "m1", first, 10000, "cash"); pay("p02", "m2", first, 10000, "bank");
  pay("p03", "m3", first, 5000, "cash"); pay("p04", "m3", first, 5000, "cash");
  pay("p05", "m4", first, 15000, "bank"); pay("p06", "m5", first, 10000, "cash");
  pay("p07", "m7", first, 10000, "bank"); pay("p08", "m8", first, 10000, "cash");
  pay("p09", "m1", middle, 10000, "bank"); pay("p10", "m2", middle, 10000, "cash");
  pay("p11", "m3", middle, 5000, "cash"); pay("p12", "m4", middle, 10000, "bank");
  pay("p13", "m5", middle, 10000, "cash"); pay("p14", "m7", middle, 12000, "bank");
  state = applyCommand(state, { id: "w01", type: "waiver", adminId: "admin-amine", memberId: "m8", month: middle, at: date(middle, 10) });
  pay("p15", "m1", current, 10000, "cash"); pay("p16", "m2", current, 4000, "bank", "admin-amine");
  pay("p17", "m2", current, 3000, "cash", "admin-amine"); pay("p18", "m4", current, 15000, "bank");
  pay("p19", "m7", current, 10000, "cash");
  state = applyCommand(state, { id: "w02", type: "waiver", adminId: "admin-amine", memberId: "m5", month: current, at: date(current, 11) });
  state = applyCommand(state, { id: "e01", type: "expense", adminId: "admin-mohamed", title: "لوازم اللقاء الشهري", amount: 12500, category: "logistics", source: "direct", channel: "cash", spentAt: date(first, 16), note: "فواتير اللوازم" });
  state = applyCommand(state, { id: "e02", type: "expense", adminId: "admin-amine", title: "مساعدة اجتماعية", amount: 20000, category: "aid", source: "direct", channel: "bank", spentAt: date(middle, 18) });
  state = applyCommand(state, { id: "e03", type: "expense", adminId: "admin-mohamed", title: "تنقل النشاط", amount: 7500, category: "activities", source: "offset", channel: "cash", memberId: "m6", mode: "bonus", spentAt: date(current, 15), note: "خلّصها رشيد من جيبو" });
  state = applyCommand(state, { id: "e04", type: "expense", adminId: "admin-amine", title: "مستلزمات التنظيم", amount: 6500, category: "logistics", source: "direct", channel: "cash", spentAt: date(current, 20) });
  return state;
}
