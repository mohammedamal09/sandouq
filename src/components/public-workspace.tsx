"use client";

import { useMemo, useState } from "react";
import { CircleHelp, LockKeyhole, Search, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import AnalyticsPanel from "./analytics-panel";
import {
  balanceFor,
  money,
  paidFor,
  statusFor,
  toMonth,
  addMonths,
  type Member,
  type TreasuryState,
} from "@/lib/domain";
import { monthStats } from "@/lib/report";
import { normalizeMoroccanPhone } from "@/lib/whatsapp";
import { StatusBadge } from "./display";
import { ThemeToggle } from "./theme-toggle";

type Props = {
  state: TreasuryState;
  onAdminLogin: () => void;
  onHelp: () => void;
};
type Tab = "overview" | "expenses" | "analytics";

export function PublicWorkspace({ state, onAdminLogin, onHelp }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [member, setMember] = useState<Member | null>(null);
  const [error, setError] = useState("");
  const month = toMonth(new Date());
  const stats = monthStats(state, month);
  const vault = balanceFor(state);
  const percent = stats.eligible
    ? Math.round((stats.contributors / stats.eligible) * 100)
    : 0;
  const activeExpenses = useMemo(
    () =>
      state.expenses
        .filter((e) => !e.reversedAt)
        .sort((a, b) => b.spentAt.localeCompare(a.spentAt)),
    [state.expenses],
  );
  const lookup = () => {
    const normalized = normalizeMoroccanPhone(phone);
    const match =
      normalized &&
      state.members.find(
        (item) =>
          item.phone === normalized &&
          item.accessPin === pin &&
          !item.archivedAt,
      );
    if (!match) {
      setMember(null);
      setError("المعطيات غير صحيحة. تأكد من رقم الهاتف والرمز السري.");
      return;
    }
    setError("");
    setMember(match);
  };
  return (
    <div className="app-shell min-h-screen pb-12" dir="rtl">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <WalletCards className="size-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-bold tracking-tight">
                صندوق المجموعة
              </h1>
              <p className="truncate text-[11px] text-muted-foreground">
                شفافية مالية للجميع
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <ThemeToggle />
            <Button
              size="icon"
              variant="ghost"
              aria-label="دليل الاستخدام"
              title="دليل الاستخدام"
              onClick={onHelp}
            >
              <CircleHelp className="size-4" />
              <span className="sr-only">دليل الاستخدام</span>
            </Button>
            <Button size="sm" onClick={onAdminLogin}>
              <LockKeyhole className="size-4" /> دخول المشرف
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5">
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as Tab)}
          className="mb-5"
        >
          <TabsList>
            <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
            <TabsTrigger value="expenses">المصاريف</TabsTrigger>
            <TabsTrigger value="analytics">الإحصائيات</TabsTrigger>
          </TabsList>
        </Tabs>
        {tab === "overview" && (
          <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
            <div className="space-y-4">
              <Card className="glass-card relative overflow-hidden shadow-none">
                <span className="ambient-glow" aria-hidden="true" />
                <CardContent className="relative p-6">
                  <p className="text-xs font-semibold text-muted-foreground">
                    الرصيد الصافي فالصندوق
                  </p>
                  <p className="numeric mt-2 text-4xl font-semibold tracking-tighter">
                    {money(vault.total)}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-md border border-border bg-muted/40 px-2.5 py-1.5">
                      الكاش <b className="numeric">{money(vault.cash)}</b>
                    </span>
                    <span className="rounded-md border border-border bg-muted/40 px-2.5 py-1.5">
                      البنكة <b className="numeric">{money(vault.bank)}</b>
                    </span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">تقدم الشهر</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between gap-2">
                    <p className="text-sm">
                      <b className="numeric">
                        {stats.contributors} / {stats.eligible}
                      </b>{" "}
                      أعضاء ساهمو
                    </p>
                    <b className="numeric text-emerald-700 dark:text-emerald-300">
                      {percent}%
                    </b>
                  </div>
                  <Progress className="mt-3" value={percent} />
                  <div className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                    <div className="rounded-lg bg-emerald-500/10 p-3">
                      تم التحصيل{" "}
                      <b className="numeric block mt-1">
                        {money(stats.cashBase + stats.cashBonus)}
                      </b>
                    </div>
                    <div className="rounded-lg bg-rose-500/10 p-3">
                      تصرف{" "}
                      <b className="numeric block mt-1">
                        {money(stats.directOut)}
                      </b>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="text-base">فحص وضعيتي الفردية</CardTitle>
                <p className="text-xs text-muted-foreground">
                  دخل رقمك المغربي والرمز السري اللي جاك فواتساب.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label htmlFor="lookup-phone">رقم الهاتف</Label>
                  <Input
                    id="lookup-phone"
                    dir="ltr"
                    className="numeric mt-1"
                    placeholder="06... أو 2126..."
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="lookup-pin">الرمز السري من 4 أرقام</Label>
                  <Input
                    id="lookup-pin"
                    dir="ltr"
                    className="numeric mt-1"
                    inputMode="numeric"
                    maxLength={4}
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
                {error && <p className="text-xs text-rose-600">{error}</p>}
                <Button className="w-full" onClick={lookup}>
                  <Search className="size-4" /> عرض وضعيتي
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
        {tab === "expenses" && (
          <Card>
            <CardHeader>
              <CardTitle>مصاريف المجموعة</CardTitle>
              <p className="text-xs text-muted-foreground">
                لائحة شفافة للمصاريف المسجلة.
              </p>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              {activeExpenses.length ? (
                activeExpenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <div>
                      <p className="font-medium">{expense.title}</p>
                      <p className="numeric mt-1 text-xs text-muted-foreground">
                        {expense.spentAt.slice(0, 10)} ·{" "}
                        {expense.source === "offset"
                          ? "مقاصة عضو"
                          : expense.channel === "cash"
                            ? "كاش"
                            : "بنكة"}
                      </p>
                    </div>
                    <b className="numeric text-rose-600">
                      -{money(expense.amount)}
                    </b>
                  </div>
                ))
              ) : (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  ما كاين حتى مصروف مسجل دابا.
                </p>
              )}
            </CardContent>
          </Card>
        )}
        {tab === "analytics" && <AnalyticsPanel state={state} privacy />}
      </main>
      <Drawer
        open={Boolean(member)}
        onOpenChange={(open) => !open && setMember(null)}
        direction="bottom"
      >
        <DrawerContent className="mx-auto max-w-lg" dir="rtl">
          <DrawerHeader>
            <DrawerTitle>وضعيتي الشخصية · 12 شهر</DrawerTitle>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {member &&
              Array.from({ length: 12 }, (_, index) => {
                const itemMonth = addMonths(month, -index);
                const status = statusFor(state, member.id, itemMonth);
                return (
                  <div
                    className="flex items-center justify-between border-b border-border py-3"
                    key={itemMonth}
                  >
                    <span>
                      {new Intl.DateTimeFormat("ar-MA-u-nu-latn", {
                        month: "long",
                        year: "numeric",
                        timeZone: "UTC",
                      }).format(new Date(`${itemMonth}-01T12:00:00Z`))}
                    </span>
                    <span className="flex items-center gap-3">
                      <b className="numeric">
                        {money(paidFor(state, member.id, itemMonth))}
                      </b>
                      <StatusBadge status={status} />
                    </span>
                  </div>
                );
              })}
          </div>
          <DrawerFooter>
            <Button variant="outline" onClick={() => setMember(null)}>
              إغلاق
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
