"use client";

import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { money, type Command, type Payment, type TreasuryState, type Waiver } from "@/lib/domain";
import { RecordActions } from "./record-actions";

type Entry = { id: string; kind: "in" | "out" | "waiver"; amount: number; title: string; private: boolean; channel: string; date: string; adminId: string; reversed: boolean; replacesId?: string; payment?: Payment; waiver?: Waiver };

type Filter = "all" | "in" | "out" | "offset";
const dateTime = (iso: string) =>
  new Intl.DateTimeFormat("ar-MA-u-nu-latn", {
    timeZone: "Africa/Casablanca",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
export function LedgerPanel({
  state,
  privacy,
  adminId,
  dispatch,
}: {
  state: TreasuryState;
  privacy: boolean;
  adminId: string;
  dispatch: (command: Command) => boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const entries = useMemo(
    (): Entry[] =>
      [
        ...state.payments.map((payment) => ({
          id: payment.id,
          kind: "in" as const,
          amount: payment.amount,
          title: `مساهمة ${state.members.find((m) => m.id === payment.memberId)?.name ?? "عضو"}`,
          private: true,
          channel: payment.source,
          date: payment.occurredAt,
          adminId: payment.recordedByAdminId,
          reversed: Boolean(payment.reversedAt),
          replacesId: payment.replacesId,
          payment,
        })),
        ...state.expenses.map((expense) => ({
          id: expense.id,
          kind: "out" as const,
          amount: expense.amount,
          title: expense.title,
          private: true,
          channel:
            expense.source === "offset" ? ("offset" as const) : expense.channel,
          date: expense.spentAt,
          adminId: expense.recordedByAdminId,
          reversed: Boolean(expense.reversedAt),
          replacesId: expense.replacesId,
        })),
        ...state.waivers.map((waiver) => ({
          id: waiver.id, kind: "waiver" as const, amount: 0,
          title: `إعفاء ${state.members.find((member) => member.id === waiver.memberId)?.name ?? "عضو"} · ${waiver.month}`,
          private: true, channel: "waiver", date: waiver.at,
          adminId: waiver.recordedByAdminId, reversed: Boolean(waiver.reversedAt),
          replacesId: waiver.replacesId, waiver,
        })),
      ].sort((a, b) => b.date.localeCompare(a.date)),
    [state],
  );
  const shown = entries.filter(
    (entry) =>
      filter === "all" ||
      (filter === "offset"
        ? entry.channel === "offset"
        : entry.kind === filter),
  );
  return (
    <>
      <div className="mb-3">
        <h2 className="text-base font-bold">السجل المالي</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          كل مداخيل ومصاريف الصندوق بالتاريخ والمشرف
        </p>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {(
          [
            ["all", "الكل"],
            ["in", "مداخيل"],
            ["out", "مصاريف"],
            ["offset", "مقاصات"],
          ] as [Filter, string][]
        ).map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={filter === key ? "default" : "outline"}
            onClick={() => setFilter(key)}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="surface divide-y divide-zinc-100 dark:divide-white/10">
        {shown.map((entry) => (
          <div key={entry.id} className="flex items-center gap-3 p-3 sm:p-4">
            <div
              className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${entry.kind === "in" ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300"}`}
            >
              {entry.kind === "in" ? (
                <ArrowDownLeft className="size-4" />
              ) : (
                <ArrowUpRight className="size-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={`truncate text-sm font-semibold ${entry.private && privacy ? "private-blur" : ""}`}
              >
                {entry.title}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                <span className="numeric">{dateTime(entry.date)}</span>
                <Badge
                  variant="outline"
                  className="rounded px-1.5 py-0 text-[10px]"
                >
                  {entry.channel === "waiver" ? "إعفاء" : entry.channel === "cash"
                    ? "كاش"
                    : entry.channel === "bank"
                      ? "بنكة"
                      : "مقاصة"}
                </Badge>
                <span>
                  ·{" "}
                  {state.admins.find((a) => a.id === entry.adminId)?.name ??
                    "—"}
                </span>
                {entry.reversed && (
                  <Badge
                    variant="outline"
                    className="rounded px-1.5 py-0 text-[10px]"
                  >
                    ملغاة
                  </Badge>
                )}
                {entry.replacesId && <Badge variant="outline" className="rounded px-1.5 py-0 text-[10px]">بديل</Badge>}
              </div>
            </div>
            {entry.kind !== "waiver" && <span
              className={`numeric text-xs font-semibold ${entry.kind === "in" ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"} ${entry.private && privacy ? "private-blur" : ""}`}
            >
              {entry.kind === "in" ? "+" : "−"}
              {money(entry.amount)}
            </span>}
            {!entry.reversed && (entry.payment || entry.waiver) && <RecordActions state={state} payment={entry.payment} waiver={entry.waiver} adminId={adminId} privacy={privacy} dispatch={dispatch} />}
          </div>
        ))}
        {!shown.length && (
          <p className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            ما كاين حتى عملية
          </p>
        )}
      </div>
      <details className="mt-4 surface p-4">
        <summary className="cursor-pointer text-sm font-semibold">
          سجل التغييرات الإدارية
        </summary>
        <div className="mt-3 divide-y divide-zinc-100 dark:divide-white/10">
          {state.audit.map((entry) => (
            <div key={entry.id} className="flex gap-2 py-2 text-xs">
              <History className="mt-0.5 size-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" />
              <span
                className={
                  privacy && entry.action === "payment" ? "private-blur" : ""
                }
              >
                {entry.detail}
              </span>
              <span className="numeric ms-auto text-zinc-500 dark:text-zinc-400">
                {dateTime(entry.at)}
              </span>
            </div>
          ))}
        </div>
      </details>
    </>
  );
}
