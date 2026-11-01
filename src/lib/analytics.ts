import {
  addMonths, minimumFor, paidFor, statusFor, toMonth,
  type Category, type TreasuryState,
} from "./domain";

export const categoryLabels: Record<Category, string> = {
  activities: "أنشطة",
  logistics: "لوجيستيك",
  aid: "مساعدات",
  emergency: "طوارئ",
  other: "أخرى",
};

export function analyticsFor(state: TreasuryState, currentMonth = toMonth(new Date())) {
  const flow = Array.from({ length: 6 }, (_, index) => {
    const month = addMonths(currentMonth, index - 5);
    return {
      month,
      label: new Intl.DateTimeFormat("ar-MA-u-nu-latn", { month: "short", timeZone: "UTC" })
        .format(new Date(`${month}-01T12:00:00Z`)),
      inflow: state.payments
        .filter((payment) => !payment.reversedAt && payment.source !== "offset" && toMonth(new Date(payment.occurredAt)) === month)
        .reduce((sum, payment) => sum + payment.amount, 0),
      outflow: state.expenses
        .filter((expense) => !expense.reversedAt && expense.source === "direct" && toMonth(new Date(expense.spentAt)) === month)
        .reduce((sum, expense) => sum + expense.amount, 0),
    };
  });
  const eligible = state.members.filter((member) =>
    member.active && member.joinedMonth <= currentMonth && statusFor(state, member.id, currentMonth) !== "waived",
  );
  const commitment = { paid: 0, partial: 0, unpaid: 0, collectedBase: 0, due: 0, percent: 0 };
  for (const member of eligible) {
    const status = statusFor(state, member.id, currentMonth);
    if (status === "bonus" || status === "paid") commitment.paid++;
    else if (status === "partial") commitment.partial++;
    else commitment.unpaid++;
    const minimum = minimumFor(state, currentMonth);
    commitment.due += minimum;
    commitment.collectedBase += Math.min(paidFor(state, member.id, currentMonth), minimum);
  }
  commitment.percent = commitment.due ? Math.min(100, Math.round(commitment.collectedBase / commitment.due * 100)) : 0;
  const categories = (Object.keys(categoryLabels) as Category[]).map((category) => ({
    category,
    label: categoryLabels[category],
    amount: state.expenses
      .filter((expense) => !expense.reversedAt && expense.category === category)
      .reduce((sum, expense) => sum + expense.amount, 0),
  }));
  return { flow, commitment, categories: categories.filter((item) => item.amount > 0) };
}
