import { Badge } from "@/components/ui/badge";
import { money, type MemberStatus } from "@/lib/domain";

const labels: Record<MemberStatus, string> = {
  unpaid: "مازال",
  partial: "ناقص",
  paid: "خالص",
  bonus: "فوق الخير",
  waived: "معفي",
};
const colors: Record<MemberStatus, string> = {
  unpaid: "border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300",
  partial: "border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300",
  paid: "border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  bonus: "border-emerald-300 dark:border-emerald-400/30 bg-emerald-100 dark:bg-emerald-500/15 text-emerald-900 dark:text-emerald-200",
  waived: "border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300",
};

export function Private({
  children,
  hidden,
  className = "",
}: {
  children: React.ReactNode;
  hidden: boolean;
  className?: string;
}) {
  return (
    <span className={`${className} ${hidden ? "private-blur" : ""}`}>
      {children}
    </span>
  );
}
export function Amount({
  value,
  hidden = false,
  className = "",
}: {
  value: number;
  hidden?: boolean;
  className?: string;
}) {
  return (
    <Private hidden={hidden} className={`numeric ${className}`}>
      {money(value)}
    </Private>
  );
}
export function StatusBadge({ status }: { status: MemberStatus }) {
  return (
    <Badge
      variant="outline"
      className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${colors[status]}`}
    >
      {labels[status]}
    </Badge>
  );
}
