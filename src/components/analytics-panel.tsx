"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Activity, ArrowDownLeft, ArrowUpRight, CircleCheck, History } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { analyticsFor } from "@/lib/analytics";
import { money, type TreasuryState } from "@/lib/domain";

const colors = { inflow: "#34d399", outflow: "#fb7185", paid: "#34d399", partial: "#fbbf24", unpaid: "#fb7185" };
const categoryColors = ["var(--chart-category-1)", "var(--chart-category-2)", "var(--chart-category-3)", "var(--chart-category-4)", "var(--chart-category-5)"];
const tooltipStyle = {
  background: "var(--popover)", color: "var(--popover-foreground)",
  border: "1px solid var(--border)", borderRadius: 10, boxShadow: "none", direction: "rtl" as const,
};
const actionLabel: Record<string, string> = {
  payment: "مساهمة", expense: "مصروف", waiver: "إعفاء", correct_payment: "تصحيح مساهمة",
  correct_expense: "تصحيح مصروف", correct_waiver: "تصحيح إعفاء", monthly_contribution: "تعديل مساهمة",
  member: "تدبير عضو", delete_member: "أرشفة عضو", minimum: "تغيير الحد الأدنى",
  minimum_rule: "تعديل الحد الأدنى", undo: "تراجع", admin: "مشرف جديد",
  admin_status: "حالة مشرف", admin_edit: "تعديل مشرف", admin_archive: "أرشفة مشرف", receipt: "وصل",
};
const dateTime = (iso: string) => new Intl.DateTimeFormat("ar-MA-u-nu-latn", {
  timeZone: "Africa/Casablanca", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
}).format(new Date(iso));

export default function AnalyticsPanel({ state, privacy }: { state: TreasuryState; privacy: boolean }) {
  const reduceMotion = useReducedMotion();
  const data = useMemo(() => analyticsFor(state), [state]);
  const recent = useMemo(() => [...state.audit].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5), [state.audit]);
  const latestId = recent[0]?.id;
  const previousLatest = useRef(latestId);
  const [freshId, setFreshId] = useState<string | null>(null);
  useEffect(() => {
    if (!latestId || latestId === previousLatest.current) return;
    const hadPrevious = Boolean(previousLatest.current);
    previousLatest.current = latestId;
    if (!hadPrevious) return;
    setFreshId(latestId);
    const timeout = window.setTimeout(() => setFreshId(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [latestId]);
  const commitment = [
    { name: "خالصين", value: data.commitment.paid, color: colors.paid },
    { name: "جزئي", value: data.commitment.partial, color: colors.partial },
    { name: "مازال", value: data.commitment.unpaid, color: colors.unpaid },
  ].filter((item) => item.value > 0);
  const totalExpenses = data.categories.reduce((sum, item) => sum + item.amount, 0);
  const reveal = (index: number) => ({
    initial: reduceMotion ? false as const : { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, delay: reduceMotion ? 0 : index * 0.06, ease: "easeOut" as const },
  });
  return (
    <section dir="rtl" className="space-y-4">
      <div>
        <p className="text-xs font-semibold tracking-widest text-emerald-700 dark:text-emerald-300">SANDOUQ / INSIGHTS</p>
        <h2 className="mt-1 text-xl font-bold tracking-tight">الإحصائيات</h2>
        <p className="mt-1 text-xs text-muted-foreground">حركة الصندوق، التزام الأعضاء، وآخر العمليات</p>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <motion.div {...reveal(0)} className="min-w-0 lg:col-span-8">
          <Card className="glass-card relative h-full overflow-hidden shadow-none">
            <span aria-hidden="true" className="ambient-glow" />
            <CardHeader className="relative z-10"><CardTitle className="font-semibold">حركة الصندوق</CardTitle><p className="text-xs text-muted-foreground">المدخول والمصروف النقدي خلال 6 أشهر</p></CardHeader>
            <CardContent className="relative z-10">
              <div className="h-[260px] w-full min-w-0" role="img" aria-label="مداخيل ومصاريف الصندوق خلال آخر ستة أشهر">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.flow} accessibilityLayer margin={{ top: 8, right: 4, left: 4, bottom: 4 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickFormatter={(value: number) => new Intl.NumberFormat("en-US").format(Math.round(value / 100))} width={46} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(161,161,170,.08)" }} formatter={(value, name) => [money(Number(value)), name === "inflow" ? "المداخيل" : "المصاريف"]} />
                    <Bar dataKey="inflow" name="inflow" fill={colors.inflow} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="outflow" name="outflow" fill={colors.outflow} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex gap-4 text-xs text-muted-foreground"><span><i className="me-1 inline-block size-2 rounded-sm bg-emerald-400" />المداخيل</span><span><i className="me-1 inline-block size-2 rounded-sm bg-rose-400" />المصاريف</span></div>
              <table className="sr-only"><caption>حركة الصندوق آخر ستة أشهر بالدرهم</caption><thead><tr><th>الشهر</th><th>المداخيل</th><th>المصاريف</th></tr></thead><tbody>{data.flow.map((item) => <tr key={item.month}><td>{item.month}</td><td>{money(item.inflow)}</td><td>{money(item.outflow)}</td></tr>)}</tbody></table>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div {...reveal(1)} className="min-w-0 lg:col-span-4">
          <Card className="glass-card relative h-full overflow-hidden shadow-none">
            <span aria-hidden="true" className="ambient-glow" />
            <CardHeader className="relative z-10"><CardTitle className="font-semibold">معدل الالتزام</CardTitle><p className="text-xs text-muted-foreground">الشهر الحالي · الحد الأدنى</p></CardHeader>
            <CardContent className="relative z-10">
              {commitment.length ? <div className="relative h-[210px] w-full" role="img" aria-label={`تحصيل ${data.commitment.percent}% من الحد الأدنى الشهري`}>
                <ResponsiveContainer width="100%" height="100%"><PieChart accessibilityLayer><Pie data={commitment} dataKey="value" nameKey="name" innerRadius={62} outerRadius={82} stroke="none" isAnimationActive={false}>{commitment.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip contentStyle={tooltipStyle} /></PieChart></ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><strong className="numeric text-3xl tracking-tighter">{data.commitment.percent}%</strong><span className="text-[11px] text-muted-foreground">من الحد الأدنى</span></div>
              </div> : <p className="py-16 text-center text-sm text-muted-foreground">ما كاينينش أعضاء مؤهلين هاد الشهر</p>}
              <div className="mt-2 flex flex-wrap gap-3 text-xs"><span className="text-emerald-700 dark:text-emerald-300">خالصين: <b className="numeric">{data.commitment.paid}</b></span><span className="text-amber-700 dark:text-amber-300">جزئي: <b className="numeric">{data.commitment.partial}</b></span><span className="text-rose-700 dark:text-rose-300">مازال: <b className="numeric">{data.commitment.unpaid}</b></span></div>
              <p className="numeric mt-3 text-xs text-muted-foreground">{money(data.commitment.collectedBase)} / {money(data.commitment.due)}</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div {...reveal(2)} className="min-w-0 lg:col-span-7">
          <Card className="glass-card relative h-full overflow-hidden shadow-none">
            <span aria-hidden="true" className="ambient-glow" />
            <CardHeader className="relative z-10"><CardTitle className="font-semibold">توزيع المصاريف</CardTitle><p className="text-xs text-muted-foreground">جميع المصاريف النشطة حسب الصنف</p></CardHeader>
            <CardContent className="relative z-10">
              {data.categories.length ? <div className="h-[210px] w-full" role="img" aria-label="توزيع جميع المصاريف حسب الصنف"><ResponsiveContainer width="100%" height="100%"><PieChart accessibilityLayer><Pie data={data.categories} dataKey="amount" nameKey="label" outerRadius={82} stroke="var(--card)" strokeWidth={2} isAnimationActive={false}>{data.categories.map((item, index) => <Cell key={item.category} fill={categoryColors[index]} />)}</Pie><Tooltip contentStyle={tooltipStyle} formatter={(value) => money(Number(value))} /></PieChart></ResponsiveContainer></div> : <p className="py-16 text-center text-sm text-muted-foreground">ما كاين حتى مصروف مسجل</p>}
              <div className="space-y-2 text-xs">{data.categories.map((item, index) => <div key={item.category} className="flex items-center justify-between gap-2"><span><i className="me-2 inline-block size-2 rounded-sm" style={{ background: categoryColors[index] }} />{item.label}</span><span className="numeric">{money(item.amount)}</span></div>)}</div>
              <p className="numeric mt-3 border-t border-border pt-3 text-sm font-semibold">المجموع: {money(totalExpenses)}</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div {...reveal(3)} className="min-w-0 lg:col-span-5">
          <Card className="glass-card h-full shadow-none">
            <CardHeader><CardTitle className="flex items-center gap-2 font-semibold"><Activity className="size-4 text-emerald-700 dark:text-emerald-300" /> آخر العمليات</CardTitle><p className="text-xs text-muted-foreground">آخر خمسة تغييرات فالصندوق</p></CardHeader>
            <CardContent>
              {recent.length ? <ol className="divide-y divide-border">{recent.map((event) => <li key={event.id} className="flex items-start gap-3 py-3 first:pt-0">
                <span className="relative mt-1.5 flex size-2 shrink-0"><motion.span className="absolute inline-flex size-2 rounded-full bg-emerald-400" animate={event.id === freshId && !reduceMotion ? { scale: [1, 1.5, 1], opacity: [0.7, 1, 0.7] } : undefined} transition={{ duration: 1.6 }} /></span>
                <span className="min-w-0 flex-1"><span className="flex items-center gap-1.5 text-xs font-semibold">{event.action === "payment" ? <ArrowDownLeft className="size-3.5" /> : event.action === "expense" ? <ArrowUpRight className="size-3.5" /> : event.action.startsWith("correct") ? <History className="size-3.5" /> : <CircleCheck className="size-3.5" />}{actionLabel[event.action] ?? "تغيير"}</span><span className={`mt-0.5 block truncate text-xs text-muted-foreground ${privacy ? "private-blur" : ""}`}>{event.detail}</span></span>
                <time className="numeric shrink-0 text-[10px] text-muted-foreground" dateTime={event.at}>{dateTime(event.at)}</time>
              </li>)}</ol> : <p className="py-16 text-center text-sm text-muted-foreground">ما كاين حتى نشاط مسجل</p>}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
