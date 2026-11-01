"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "motion/react";
import {
  Banknote,
  BookOpenText,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  Landmark,
  MessageCircle,
  MoreHorizontal,
  Plus,
  ReceiptText,
  Settings2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  addMonths,
  applyCommand,
  arrearsFor,
  balanceFor,
  minimumFor,
  money,
  newId,
  paidFor,
  statusFor,
  toMonth,
  type Command,
  type Expense,
  type Member,
  type MemberStatus,
} from "@/lib/domain";
import { useTreasury } from "@/lib/use-treasury";
import { monthStats } from "@/lib/report";
import {
  PaymentDrawer,
  EditContributionDialog,
  ExpenseDrawer,
  PassbookDrawer,
  WhatsAppDrawer,
  ReportDialog,
} from "./workspace-panels";
import { SettingsPanel } from "./settings-panel";
import { CloudSetup } from "./cloud-setup";
import { ReceiptButton } from "./receipt-button";
import { LedgerPanel } from "./ledger-panel";
import { AdminSwitchDialog } from "./admin-switch-dialog";
import { Amount, Private, StatusBadge } from "./display";
import { ThemeToggle } from "./theme-toggle";
import { normalizeMoroccanPhone } from "@/lib/whatsapp";
const AnalyticsPanel = dynamic(() => import("./analytics-panel"), { loading: () => <p className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">جاري تحميل الإحصائيات…</p> });

const monthLabel = (month: string) =>
  new Intl.DateTimeFormat("ar-MA-u-nu-latn", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T12:00:00Z`));

type Tab = "contributions" | "expenses" | "ledger" | "analytics" | "settings";
export function SandouqApp() {
  const repo = useTreasury();
  const reduceMotion = useReducedMotion();
  const { state, adminId } = repo;
  const [month, setMonth] = useState(toMonth(new Date()));
  const [tab, setTab] = useState<Tab>("contributions");
  const [filter, setFilter] = useState<"all" | "due" | "paid">("all");
  const [privacy, setPrivacy] = useState(false);
  const [paymentMember, setPaymentMember] = useState<Member | null>(null);
  const [editingContributionMember, setEditingContributionMember] = useState<Member | null>(null);
  const [deletingContributionMember, setDeletingContributionMember] = useState<Member | null>(null);
  const [passbookMember, setPassbookMember] = useState<Member | null>(null);
  const [whatsappMember, setWhatsappMember] = useState<Member | null>(null);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [deletingMember, setDeletingMember] = useState<Member | null>(null);
  const [pendingReviewOpen, setPendingReviewOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [createdCode, setCreatedCode] = useState("");
  const [switchTarget, setSwitchTarget] = useState("");
  const stats = useMemo(
    () => (state ? monthStats(state, month) : null),
    [state, month],
  );
  const vault = useMemo(() => (state ? balanceFor(state) : null), [state]);
  const admin = state?.admins.find((a) => a.id === adminId) ?? state?.admins[0];
  const members = useMemo(() => {
    if (!state) return [];
    return state.members
      .filter((m) => m.active && m.joinedMonth <= month)
      .filter((m) => {
        const status = statusFor(state, m.id, month);
        return (
          filter === "all" ||
          (filter === "due"
            ? status === "unpaid" || status === "partial"
            : status === "paid" || status === "bonus")
        );
      })
      .sort((a, b) => {
        const rank = (s: MemberStatus) =>
          ({ unpaid: 0, partial: 1, paid: 2, bonus: 3, waived: 4 })[s];
        return (
          rank(statusFor(state, a.id, month)) -
            rank(statusFor(state, b.id, month)) ||
          a.name.localeCompare(b.name, "ar")
        );
      });
  }, [state, month, filter]);
  function dispatch(command: Command, receipt?: File) {
    try {
      if (!state) return false;
      applyCommand(state, command);
    } catch (error) {
      toast.error((error as Error).message);
      return false;
    }
    const ok = repo.dispatch(command, receipt);
    if (!ok) {
      toast.error("تعذر تسجيل العملية؛ راجع البيانات");
      return false;
    }
    if (
      command.type === "payment" ||
      command.type === "expense" ||
      command.type === "waiver"
    )
      toast.success(
        repo.cloudEnabled ? "تسجلات العملية، المزامنة جارية" : "تسجلات العملية",
        {
          action: {
            label: "تراجع",
            onClick: () => {
              if (
                repo.dispatch({
                  id: newId(),
                  type: "undo",
                  adminId,
                  entityId: command.id,
                  at: new Date().toISOString(),
                })
              )
                toast.success("ترجعات العملية");
              else toast.error("تعذر التراجع");
            },
          },
        },
      );
    else
      toast.success(
        repo.cloudEnabled ? "التغيير قيد المزامنة" : "تحفظات التغييرات",
      );
    return true;
  }
  function switchAdmin(id: string) {
    if (!state) return;
    const target = state.admins.find((a) => a.id === id);
    if (!target) return;
    if (target.id !== adminId) setSwitchTarget(id);
  }
  if (repo.loading)
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
        جاري تحميل الصندوق…
      </main>
    );
  if (!state && repo.cloudEnabled)
    return (
      <CloudSetup
        createGroup={async (...args) => {
          const code = await repo.createGroup(...args);
          setCreatedCode(code);
          return code;
        }}
        lookupGroup={repo.lookupGroup}
        joinGroup={repo.joinGroup}
        error={repo.error}
      />
    );
  if (!state || !stats || !vault || !admin)
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
        تعذر تحميل الصندوق
      </main>
    );
  return (
    <div className="app-shell min-h-screen pb-24 md:pb-10">
      <Toaster position="top-center" dir="rtl" />
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-xl md:px-7">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Wallet className="size-5" />
            </div>
            <div>
              <h1 className="text-lg leading-5 font-bold tracking-tight">
                صندوق المجموعة
              </h1>
              <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                تدبير جماعي واضح وبسيط
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label={privacy ? "إظهار الأسماء" : "إخفاء الأسماء"}
                    onClick={() => setPrivacy(!privacy)}
                  >
                    {privacy ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent dir="rtl">
                  {privacy ? "إظهار الأسماء" : "إخفاء الأسماء"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Select value={adminId} onValueChange={switchAdmin}>
              <SelectTrigger
                className="w-[105px] bg-card sm:w-[145px]"
                aria-label="المشرف الحالي"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                {state.admins
                  .filter((a) => a.active)
                  .map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      المشرف: {a.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>
      <main className="px-4 pt-5 md:px-7">
        {repo.cloudEnabled && (repo.pending > 0 || repo.error) && (
          <div
            className={`mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-xs ${repo.error ? "border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-200" : "border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/70 text-zinc-600 dark:text-zinc-300"}`}
          >
            <span>{repo.error || <><span className="numeric">{repo.pending}</span> عملية قيد المزامنة</>}</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void repo.retrySync()}
              >
                إعادة المحاولة
              </Button>
              {repo.pending > 0 && (
                <Button size="sm" variant="outline" onClick={() => setPendingReviewOpen(true)}>مراجعة العمليات</Button>
              )}
              {repo.pending > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (
                      window.confirm(
                        "غادي تتحيد العمليات المعلقة من هاد الجهاز وترجع آخر نسخة سحابية. واش متأكد؟",
                      )
                    )
                      void repo
                        .discardPending()
                        .catch((error) => toast.error(error.message));
                  }}
                >
                  إلغاء العمليات المعلقة
                </Button>
              )}
            </div>
          </div>
        )}
        {createdCode && (
          <div className="mb-4 rounded-lg border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 p-4 text-sm">
            <p className="font-semibold">
              رمز المجموعة الجديدة — شاركو غير مع المشرفين
            </p>
            <p className="numeric mt-2 select-all break-all text-lg font-bold">
              {createdCode}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => {
                navigator.clipboard.writeText(createdCode);
                toast.success("تنسخ الرمز");
              }}
            >
              نسخ الرمز
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="mt-3"
              onClick={() => setCreatedCode("")}
            >
              إخفاء
            </Button>
          </div>
        )}
        <div className="grid gap-5 md:grid-cols-[minmax(300px,330px)_minmax(0,1fr)] lg:gap-6">
          <div className="space-y-4">
            <Card className="relative isolate overflow-hidden border border-emerald-500/15 bg-card shadow-none backdrop-blur-xl">
              <span aria-hidden="true" className="ambient-glow" />
              <CardContent className="relative z-10 p-5 sm:p-6">
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  الرصيد الصافي فالصندوق
                </p>
                <div className="mt-2 text-[clamp(1.9rem,5vw,2.8rem)] leading-none font-semibold tracking-tighter text-zinc-950 dark:text-zinc-50">
                  <span className="numeric">{money(vault.total)}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/50 px-2.5 py-1.5 text-xs">
                    <Banknote className="size-3.5 text-zinc-600 dark:text-zinc-300" /> الكاش{" "}
                    <span className="numeric font-medium">
                      {money(vault.cash)}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/50 px-2.5 py-1.5 text-xs">
                    <Landmark className="size-3.5 text-zinc-600 dark:text-zinc-300" /> البنكة{" "}
                    <span className="numeric font-medium">
                      {money(vault.bank)}
                    </span>
                  </span>
                </div>
              </CardContent>
            </Card>
            <div className="surface p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">شهر المساهمات</p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="الشهر السابق"
                    onClick={() => setMonth(addMonths(month, -1))}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                  <span className="min-w-26 text-center text-sm font-semibold">
                    {monthLabel(month)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="الشهر التالي"
                    onClick={() => setMonth(addMonths(month, 1))}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-500/10 p-3">
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-200">مداخيل الشهر</p>
                  <p className="numeric mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    +{money(stats.cashBase + stats.cashBonus)}
                  </p>
                </div>
                <div className="rounded-lg bg-rose-50 dark:bg-rose-500/10 p-3">
                  <p className="text-[11px] text-rose-800 dark:text-rose-200">مصاريف الصندوق</p>
                  <p className="numeric mt-1 text-sm font-semibold text-rose-700 dark:text-rose-300">
                    -{money(stats.directOut)}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex justify-between text-xs text-zinc-600 dark:text-zinc-300">
                <span>الأعضاء اللي كملو الحد الأدنى</span>
                <span className="numeric">
                  {stats.completed}/{stats.eligible}
                </span>
              </div>
              <Progress
                className="mt-2 h-1.5"
                value={
                  stats.eligible ? (stats.completed / stats.eligible) * 100 : 0
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="justify-center"
                onClick={() => setReportOpen(true)}
              >
                <FileText className="size-4" /> تقرير الكروب
              </Button>
              <Button
                variant="outline"
                className="justify-center"
                onClick={() => setExpenseOpen(true)}
              >
                <Plus className="size-4" /> قيد مصروف
              </Button>
            </div>
          </div>
          <section className="min-w-0">
            <Tabs
              value={tab}
              onValueChange={(value) => setTab(value as Tab)}
              className="mb-4 hidden border-b border-zinc-200 dark:border-white/10 pb-3 md:flex"
            >
              <TabsList variant="line">
                {(
                  ["contributions", "expenses", "ledger", "analytics", "settings"] as Tab[]
                ).map((item) => (
                  <TabsTrigger key={item} value={item}>
                    {
                      {
                        contributions: "المساهمات",
                        expenses: "المصاريف",
                        ledger: "السجل",
                        analytics: "الإحصائيات",
                        settings: "الإعدادات",
                      }[item]
                    }
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <motion.div key={tab} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.26, ease: "easeOut" }}>
            {tab === "contributions" && (
              <>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold">مساهمات الأعضاء</h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="numeric">{stats.contributors}</span> من <span className="numeric">{stats.eligible}</span> ساهمو هاد الشهر
                    </p>
                  </div>
                  <Badge variant="outline" className="numeric rounded-md">
                    {members.length} عضو
                  </Badge>
                </div>
                <div className="mb-3 flex gap-2">
                  {[
                    ["all", "الكل"],
                    ["due", "مازال ماخلصوش"],
                    ["paid", "خالصين"],
                  ].map(([key, label]) => (
                    <Button
                      key={key}
                      size="sm"
                      variant={filter === key ? "default" : "outline"}
                      className="min-h-9"
                      onClick={() => setFilter(key as typeof filter)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <div className="surface divide-y divide-zinc-100 dark:divide-white/10 overflow-hidden">
                  {members.map((member, index) => {
                    const status = statusFor(state, member.id, month);
                    const paid = paidFor(state, member.id, month);
                    const due = minimumFor(state, month);
                    const arrears = arrearsFor(state, member, month);
                    return (
                      <motion.div
                        key={member.id}
                        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.22, delay: Math.min(index, 10) * 0.025 }}
                        className="interactive-row flex items-center gap-2 px-3 py-3 sm:px-4"
                      >
                        <Avatar size="sm" className="size-8 bg-zinc-100 dark:bg-zinc-800">
                          <AvatarFallback>
                            <Private hidden={privacy}>
                              {member.name.slice(0, 1)}
                            </Private>
                          </AvatarFallback>
                        </Avatar>
                        <button
                          className="min-w-0 flex-1 text-start"
                          onClick={() => setPassbookMember(member)}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Private
                              hidden={privacy}
                              className="truncate text-sm font-semibold"
                            >
                              {member.name}
                            </Private>
                            <Private hidden={privacy}>
                              <StatusBadge status={status} />
                            </Private>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                            <Amount value={paid} hidden={privacy} />
                            {status === "partial" && (
                              <>
                                {" "}
                                / <span className="numeric">{money(due)}</span>
                                <span className="text-amber-700 dark:text-amber-300">
                                  باقي{" "}
                                  <Amount value={due - paid} hidden={privacy} />
                                </span>
                              </>
                            )}
                            {arrears.count > 0 && (
                              <Private
                                hidden={privacy}
                                className="rounded border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 px-1.5 text-[11px] text-rose-700 dark:text-rose-300"
                              >
                                متأخر بـ <span className="numeric">{arrears.count}</span> شهر
                              </Private>
                            )}
                          </div>
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`واتساب ${member.name}`}
                          onClick={() => setWhatsappMember(member)}
                        >
                          <MessageCircle className="size-4 text-zinc-600 dark:text-zinc-300" />
                        </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`خيارات العضو ${member.name}`}
                              >
                                <MoreHorizontal className="size-4 text-zinc-600 dark:text-zinc-300" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => setEditingMember(member)}>تعديل العضو</DropdownMenuItem>
                              <DropdownMenuItem className="text-rose-700 dark:text-rose-300" onSelect={() => setDeletingMember(member)}>حذف العضو</DropdownMenuItem>
                              {status !== "unpaid" && <DropdownMenuItem onSelect={() => setEditingContributionMember(member)}>
                                تعديل المساهمة
                              </DropdownMenuItem>}
                              {status !== "unpaid" && <DropdownMenuItem
                                className="text-rose-700 dark:text-rose-300 data-[highlighted]:bg-rose-50 data-[highlighted]:text-rose-700 dark:data-[highlighted]:bg-rose-500/10 dark:data-[highlighted]:text-rose-200"
                                onSelect={() => setDeletingContributionMember(member)}
                              >
                                إلغاء المساهمة
                              </DropdownMenuItem>}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPaymentMember(member)}
                          disabled={status === "waived"}
                        >
                          خلّص <Plus className="size-3.5" />
                        </Button>
                      </motion.div>
                    );
                  })}
                  {members.length === 0 && (
                    <p className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      ما كاين حتى عضو فهاد التصفية
                    </p>
                  )}
                </div>
              </>
            )}
            {tab === "expenses" && (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold">المصاريف</h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      كل مصاريف {monthLabel(month)}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => setExpenseOpen(true)}>
                    <Plus className="size-4" /> مصروف
                  </Button>
                </div>
                <div className="surface divide-y divide-zinc-100 dark:divide-white/10">
                  {[...stats.expenses].reverse().map((e, index) => (
                    <motion.div
                      key={e.id}
                      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, delay: Math.min(index, 10) * 0.025 }}
                      className="interactive-row flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold">
                          <Private hidden={privacy}>{e.title}</Private>
                        </p>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          <span className="numeric">
                            {e.spentAt.slice(0, 10)}
                          </span>{" "}
                          ·{" "}
                          {e.source === "offset"
                            ? "مقاصة عضو"
                            : e.channel === "cash"
                              ? "كاش"
                              : "بنكة"}{" "}
                          ·{" "}
                          {
                            state.admins.find(
                              (a) => a.id === e.recordedByAdminId,
                            )?.name
                          }
                        </p>
                        {e.receiptId && (
                          <ReceiptButton
                            receiptId={e.receiptId}
                            privacy={privacy}
                          />
                        )}
                      </div>
                      <Amount
                        value={-e.amount}
                        hidden={privacy}
                        className="text-sm font-semibold text-rose-700 dark:text-rose-300"
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={`خيارات المصروف ${e.title}`}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => { setEditingExpense(e); setExpenseOpen(true); }}>تعديل</DropdownMenuItem>
                          <DropdownMenuItem className="text-rose-700 dark:text-rose-300" onSelect={() => setDeletingExpense(e)}>حذف</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </motion.div>
                  ))}
                  {!stats.expenses.length && (
                    <p className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      ما كاين حتى مصروف هاد الشهر
                    </p>
                  )}
                </div>
              </>
            )}
            {tab === "ledger" && (
              <LedgerPanel state={state} privacy={privacy} adminId={adminId} dispatch={dispatch} />
            )}
            {tab === "analytics" && <AnalyticsPanel state={state} privacy={privacy} />}
            {tab === "settings" && (
              <SettingsPanel
                state={state}
                adminId={adminId}
                privacy={privacy}
                dispatch={dispatch}
                importLocal={repo.importLocal}
                cloudEnabled={repo.cloudEnabled}
                createGroup={repo.createGroup}
              />
            )}
            </motion.div>
          </section>
        </div>
      </main>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 px-1 pt-2">
          {(
            [
              ["contributions", Wallet, "مساهمات"],
              ["expenses", ReceiptText, "مصاريف"],
              ["ledger", BookOpenText, "السجل"],
              ["analytics", ChartNoAxesCombined, "إحصاء"],
              ["settings", Settings2, "إعدادات"],
            ] as const
          ).map(([key, Icon, label]) => (
            <button
              key={key}
              aria-label={{ contributions: "المساهمات", expenses: "المصاريف", ledger: "السجل", analytics: "الإحصائيات", settings: "الإعدادات" }[key]}
              className={`flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-lg py-1 text-[10px] leading-tight ${tab === key ? "bg-emerald-50 dark:bg-emerald-500/10 font-semibold text-emerald-700 dark:text-emerald-300" : "text-zinc-500 dark:text-zinc-400"}`}
              onClick={() => setTab(key)}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>
      </nav>
      <PaymentDrawer
        key={`payment-${paymentMember?.id ?? "none"}-${month}`}
        state={state}
        member={paymentMember}
        month={month}
        adminId={adminId}
        privacy={privacy}
        onClose={() => setPaymentMember(null)}
        dispatch={dispatch}
      />
      <EditContributionDialog
        key={`edit-contribution-${editingContributionMember?.id ?? "none"}-${month}`}
        state={state}
        member={editingContributionMember}
        month={month}
        adminId={adminId}
        privacy={privacy}
        onClose={() => setEditingContributionMember(null)}
        dispatch={dispatch}
      />
      <ExpenseDrawer
        key={`expense-${editingExpense?.id ?? "new"}-${expenseOpen}`}
        state={state}
        open={expenseOpen}
        editingExpense={editingExpense}
        adminId={adminId}
        privacy={privacy}
        onClose={() => { setExpenseOpen(false); setEditingExpense(null); }}
        dispatch={dispatch}
      />
      <Dialog open={Boolean(editingMember)} onOpenChange={(open) => !open && setEditingMember(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader className="text-start"><DialogTitle>تعديل العضو</DialogTitle><DialogDescription>الاسم والرقم وشهر الانضمام. السجل المالي يبقى محفوظ.</DialogDescription></DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain">
            <div><Label htmlFor="member-edit-name">الاسم</Label><Input id="member-edit-name" className={`mt-2 ${privacy ? "private-blur" : ""}`} value={editingMember?.name ?? ""} onChange={(event) => setEditingMember((member) => member ? { ...member, name: event.target.value } : null)} /></div>
            <div><Label htmlFor="member-edit-phone">الهاتف</Label><Input id="member-edit-phone" className={`numeric mt-2 ${privacy ? "private-blur" : ""}`} dir="ltr" value={editingMember?.phone ?? ""} onChange={(event) => setEditingMember((member) => member ? { ...member, phone: event.target.value } : null)} /></div>
            <div><Label htmlFor="member-edit-month">شهر الانضمام</Label><Input id="member-edit-month" className="numeric mt-2" type="month" dir="ltr" value={editingMember?.joinedMonth ?? ""} onChange={(event) => setEditingMember((member) => member ? { ...member, joinedMonth: event.target.value } : null)} /></div>
          </div>
          <DialogFooter><Button onClick={() => { if (!editingMember) return; const phone = normalizeMoroccanPhone(editingMember.phone); if (!phone) return toast.error("رقم مغربي غير صالح"); if (dispatch({ id: newId(), type: "member", adminId, member: { ...editingMember, phone, name: editingMember.name.trim() }, expectedRevision: editingMember.revision, at: new Date().toISOString() })) setEditingMember(null); }}>حفظ التعديل</Button><Button variant="outline" onClick={() => setEditingMember(null)}>إلغاء</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={Boolean(deletingMember)} onOpenChange={(open) => !open && setDeletingMember(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>حذف العضو</AlertDialogTitle><AlertDialogDescription>هل أنت متأكد؟ العضو اللي عنده سجل مالي غادي يتأرشف وتبقى مساهماته محفوظة. العضو بلا سجل مالي غادي يتحيد نهائياً.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel asChild><Button variant="outline">إلغاء</Button></AlertDialogCancel><AlertDialogAction asChild><Button variant="destructive" onClick={(event) => { if (!deletingMember || !dispatch({ id: newId(), type: "delete_member", adminId, memberId: deletingMember.id, at: new Date().toISOString() })) event.preventDefault(); else setDeletingMember(null); }}>حذف العضو</Button></AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={Boolean(deletingContributionMember)} onOpenChange={(open) => !open && setDeletingContributionMember(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>إلغاء المساهمة</AlertDialogTitle><AlertDialogDescription>غادي يتصححو أداءات هذا العضو لهاد الشهر، ويبقى السجل الأصلي ظاهر فالتاريخ. واش متأكد؟</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel asChild><Button variant="outline">إلغاء</Button></AlertDialogCancel><AlertDialogAction asChild><Button variant="destructive" onClick={(event) => { if (!deletingContributionMember || !dispatch({ id: newId(), type: "monthly_contribution", adminId, memberId: deletingContributionMember.id, month, amount: 0, channel: "cash", mode: "bonus", expectedRevision: state.revision, at: new Date().toISOString() })) event.preventDefault(); else setDeletingContributionMember(null); }}>إلغاء المساهمة</Button></AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={Boolean(deletingExpense)} onOpenChange={(open) => !open && setDeletingExpense(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>حذف المصروف</AlertDialogTitle><AlertDialogDescription>هل أنت متأكد من حذف هذا المصروف؟ {deletingExpense?.source === "direct" ? `غادي يرجع ${deletingExpense ? money(deletingExpense.amount) : ""} لرصيد ${deletingExpense?.channel === "cash" ? "الكاش" : "البنكة"}.` : "غادي يتحيد المصروف والمساهمة المرتبطة به بلا تغيير رصيد الصندوق."}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel asChild><Button variant="outline">إلغاء</Button></AlertDialogCancel><AlertDialogAction asChild><Button variant="destructive" onClick={(event) => { if (!deletingExpense || !dispatch({ id: newId(), type: "correct_expense", adminId, targetId: deletingExpense.id, expectedRevision: state.revision, at: new Date().toISOString() })) event.preventDefault(); else setDeletingExpense(null); }}>حذف المصروف</Button></AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={pendingReviewOpen} onOpenChange={setPendingReviewOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader className="text-start"><DialogTitle>العمليات المعلقة</DialogTitle><DialogDescription>راجع العمليات اللي ما تزَامنتش. تقدر تعاود المحاولة أو تحيد عملية من هذا الجهاز.</DialogDescription></DialogHeader>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain">
            {repo.pendingItems.map((item) => <div key={item.id} className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 dark:border-white/10 p-3 text-xs"><div className="min-w-0"><p className="font-medium">{{ payment: "مساهمة", expense: "مصروف", waiver: "إعفاء", correct_payment: "تصحيح مساهمة", correct_expense: "تصحيح مصروف", correct_waiver: "تصحيح إعفاء", monthly_contribution: "تعديل مساهمة", member: "عضو", delete_member: "حذف عضو", minimum: "حد أدنى", minimum_rule: "قاعدة الحد الأدنى", receipt: "وصل", undo: "تراجع", admin: "مشرف", admin_status: "حالة مشرف", admin_edit: "تعديل مشرف", admin_archive: "أرشفة مشرف" }[item.type]}</p><p className="numeric truncate text-zinc-500 dark:text-zinc-400">{item.id}</p></div><Button size="sm" variant="ghost" className="text-rose-700 dark:text-rose-300" onClick={() => void repo.discardOne(item.id).catch((error) => toast.error(error.message))}>إلغاء</Button></div>)}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => void repo.retrySync()}>إعادة المحاولة</Button><Button onClick={() => setPendingReviewOpen(false)}>إغلاق</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <PassbookDrawer
        state={state}
        member={passbookMember}
        month={month}
        privacy={privacy}
        adminId={adminId}
        dispatch={dispatch}
        onClose={() => setPassbookMember(null)}
      />
      <WhatsAppDrawer
        key={`whatsapp-${whatsappMember?.id ?? "none"}-${month}`}
        state={state}
        member={whatsappMember}
        month={month}
        adminName={admin.name}
        privacy={privacy}
        onClose={() => setWhatsappMember(null)}
      />
      <ReportDialog
        state={state}
        month={month}
        open={reportOpen}
        onClose={() => setReportOpen(false)}
      />
      <AdminSwitchDialog
        key={switchTarget || "none"}
        name={state.admins.find((a) => a.id === switchTarget)?.name ?? ""}
        open={Boolean(switchTarget)}
        onClose={() => setSwitchTarget("")}
        onVerify={(pin) => repo.switchAdmin(switchTarget, pin)}
      />
    </div>
  );
}
