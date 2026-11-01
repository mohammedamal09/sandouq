"use client";

import type { ReactNode } from "react";
import {
  Banknote,
  BookOpenText,
  CalendarDays,
  CircleHelp,
  Eye,
  LockKeyhole,
  MessageCircle,
  Moon,
  ReceiptText,
  Settings2,
  UserRoundSearch,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { StatusBadge } from "./display";

function ManualSection({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="surface space-y-2.5 p-4">
      <h3 className="flex items-center gap-2 text-sm font-bold">
        <span className="flex size-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
          {icon}
        </span>
        {title}
      </h3>
      <div className="space-y-2 text-xs leading-6 text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function StatusLegend() {
  return (
    <ManualSection
      icon={<CircleHelp className="size-4" />}
      title="معاني الحالات والألوان"
    >
      <p>الحالة كتتبدل تلقائياً حسب الحد الأدنى، المبلغ المسجل، والإعفاء.</p>
      <div className="flex flex-wrap gap-2 pt-1">
        <StatusBadge status="paid" />
        <StatusBadge status="bonus" />
        <StatusBadge status="partial" />
        <StatusBadge status="unpaid" />
        <StatusBadge status="waived" />
      </div>
      <p>
        <b className="text-foreground">خالص:</b> وصل للحد الأدنى.{" "}
        <b className="text-foreground">فوق الخير:</b> زاد عليه.{" "}
        <b className="text-foreground">ناقص:</b> خلّص جزء وباقي عليه.{" "}
        <b className="text-foreground">مازال:</b> ما تسجل حتى مبلغ.{" "}
        <b className="text-foreground">معفي:</b> ما عليهش واجب هاد الشهر.
      </p>
    </ManualSection>
  );
}

export function GuideDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Drawer
      open={open}
      onOpenChange={(value) => !value && onClose()}
      direction="bottom"
    >
      <DrawerContent
        dir="rtl"
        className="mx-auto max-w-2xl"
        data-testid="guide-drawer"
      >
        <DrawerHeader className="border-b border-border">
          <DrawerTitle className="flex items-center gap-2">
            <BookOpenText className="size-5 text-emerald-600 dark:text-emerald-300" />{" "}
            دليل الاستخدام
          </DrawerTitle>
          <p className="text-xs text-muted-foreground">
            كل ما تحتاجه من أول زيارة حتى تدبير الصندوق.
          </p>
        </DrawerHeader>
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4"
          data-testid="guide-scroll-body"
        >
          <Tabs defaultValue="members">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="members">دليل الأعضاء</TabsTrigger>
              <TabsTrigger value="admins">دليل المشرف</TabsTrigger>
            </TabsList>
            <TabsContent value="members" className="mt-4 space-y-3">
              <ManualSection
                icon={<WalletCards className="size-4" />}
                title="الشريط العلوي ولوحة الصندوق"
              >
                <p>
                  بطاقة الرصيد كتبرز شحال كاين فالصندوق كامل، مع التفصيل بين{" "}
                  <b className="text-foreground">الكاش</b> و
                  <b className="text-foreground">البنكة</b>. الأرقام دائماً
                  كتظهر بالدرهم.
                </p>
                <p>
                  <Moon className="me-1 inline size-3.5" /> زر القمر أو الشمس
                  كيقلب بين الوضع الداكن والفاتح، وكيحتافظ باختيارك فهاد الجهاز.
                  زر <Eye className="me-1 inline size-3.5" /> الخصوصية كيغطي
                  الأسماء والمبالغ الفردية ففضاء المشرف.
                </p>
              </ManualSection>
              <ManualSection
                icon={<CalendarDays className="size-4" />}
                title="التقدم والمصاريف العمومية"
              >
                <p>
                  تقدم الشهر كيبين عدد الأعضاء اللي ساهمو، نسبة المشاركة، شحال
                  تجمع، وشحال تصرف. لائحة{" "}
                  <b className="text-foreground">المصاريف</b> والإحصائيات متاحة
                  للكل باش تبقى مالية الكروب واضحة.
                </p>
                <p>
                  تقرير الكروب كيعطي ملخص بلا أسامي: المساهمات، المصاريف، والكاش
                  والبنكة.
                </p>
              </ManualSection>
              <ManualSection
                icon={<UserRoundSearch className="size-4" />}
                title="فحص وضعيتي الفردية"
              >
                <p>
                  دخل رقم هاتفك المغربي بصيغة{" "}
                  <span className="numeric">06…</span> أو{" "}
                  <span className="numeric">2126…</span>، ومن بعد دخل الرمز
                  السري ديالك من 4 أرقام اللي توصّلتي به فالواتساب.
                </p>
                <p>
                  غادي تشوف غير دفتر 12 شهر ديالك: الأشهر الخالصة، الناقصة،
                  المعفاة، والمبلغ المسجل. ما كيبان حتى عضو آخر.
                </p>
              </ManualSection>
              <StatusLegend />
            </TabsContent>
            <TabsContent value="admins" className="mt-4 space-y-3">
              <ManualSection
                icon={<LockKeyhole className="size-4" />}
                title="الدخول والشريط العلوي"
              >
                <p>
                  اضغط <b className="text-foreground">دخول المشرف</b> وسجل
                  بالبريد <span className="numeric">admin@admin.ma</span> وكلمة
                  السر <span className="numeric">admin1234</span>، ثم اختَر
                  الاسم اللي غادي يبان فالميساجات وسجل العمليات.
                </p>
                <p>
                  من الشريط العلوي تقدر تبدل الوضع الداكن، تفعل الخصوصية، تبدل
                  المشرف النشط، أو تخرج من فضاء المشرف.
                </p>
              </ManualSection>
              <ManualSection
                icon={<WalletCards className="size-4" />}
                title="لوحة الصندوق والشهر"
              >
                <p>
                  الرصيد الصافي = الكاش + البنكة. أزرار الشهر{" "}
                  <span className="numeric">&lt; &gt;</span> كتنقلك بين الشهور
                  باش تراجع المساهمات القديمة.
                </p>
                <p>
                  بطاقة الشهر كتفصل مداخيل الشهر ومصاريف الصندوق. من نفس الجانب
                  تقدر تفتح{" "}
                  <b className="text-foreground">تقرير الكروب بلا سميات</b> أو
                  تزيد مصروف جديد.
                </p>
              </ManualSection>
              <ManualSection
                icon={<Banknote className="size-4" />}
                title="تدبير المساهمات"
              >
                <p>
                  أضف الأعضاء والحد الأدنى من الإعدادات. زر{" "}
                  <b className="text-foreground">خلّص +</b> كيفتح تسجيل سريع:
                  المبلغ، الكاش أو البنكة، وملاحظات العملية.
                </p>
                <p>
                  المبلغ الجزئي كيخلي الحالة ناقص. ملي كيكون المبلغ زايد كتختار
                  واش هو <b className="text-foreground">فوق الخير</b> لهاد الشهر
                  أو <b className="text-foreground">تسبيق</b> للشهور الجاية. زر
                  واتساب كيفتح مسودة تذكير من الهاتف ديالك.
                </p>
                <p>
                  من قائمة الثلاث نقط حد كل عضو: عدل الاسم أو الهاتف، عدل مساهمة
                  الشهر، حوّلها لمعفي أو رجعها مازال ماخلصش. دفتر العضو فيه
                  تفاصيل كل عملية.
                </p>
              </ManualSection>
              <StatusLegend />
              <ManualSection
                icon={<ReceiptText className="size-4" />}
                title="المصاريف والمقاصة"
              >
                <p>
                  المصروف المباشر كينقص من الكاش أو البنكة، لذلك النظام كيرفض
                  مبلغ أكبر من الرصيد المختار.
                </p>
                <p>
                  <b className="text-foreground">عضو خلّص من جيبو — مقاصة</b>{" "}
                  كتسجل المصروف وكتعطيه رصيد مساهمة بنفس المبلغ، بلا ما يتبدل
                  رصيد الكاش أو البنكة. من الثلاث نقط عدل المصروف أو حذفه؛ الحذف
                  كيرجع أثره المحاسبي.
                </p>
              </ManualSection>
              <ManualSection
                icon={<Settings2 className="size-4" />}
                title="الإعدادات والنسخ الاحتياطي"
              >
                <p>
                  الحد الأدنى الجديد كيبدا من الشهر الجاي. من الإعدادات تقدر
                  تدبر الأعضاء، رموزهم السرية، والمشرفين.
                </p>
                <p>
                  صدر نسخة <span className="numeric">JSON</span> كاملة أو ملف{" "}
                  <span className="numeric">CSV</span> قبل أي تغيير كبير. زر
                  تحميل بيانات تجريبية غير للمعاينة فهاد الجهاز؛{" "}
                  <b className="text-foreground">
                    تصفير الصندوق للبدء بالبيانات الحقيقية
                  </b>{" "}
                  كيرجع مساحة فارغة فيها 0 أعضاء و0 عمليات.
                </p>
              </ManualSection>
              <ManualSection
                icon={<MessageCircle className="size-4" />}
                title="واتساب والتقارير"
              >
                <p>
                  واتساب كيعمر غير مسودة موجهة للعضو أو للكروب؛ راجع النص واضغط
                  الإرسال من الحساب المتاح فهاتفك. التوقيع كيتبدل حسب اسم المشرف
                  النشط.
                </p>
              </ManualSection>
            </TabsContent>
          </Tabs>
        </div>
        <DrawerFooter>
          <Button variant="outline" onClick={onClose}>
            إغلاق الدليل
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
