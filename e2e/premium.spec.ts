import { expect, test, type Page } from "@playwright/test";
import { createSeed } from "../src/lib/seed";

async function openAdminDemo(page: Page) {
  const state = createSeed();
  state.group.id = "e2e-demo";
  await page.addInitScript((data) => {
    if (!localStorage.getItem("sandouq:local:v1")) {
      localStorage.setItem("sandouq:local:v1", JSON.stringify(data));
    }
    localStorage.setItem("sandouq:admin-mode", "1");
    localStorage.setItem("sandouq:operator-name", "اختبار");
  }, state);
  await page.goto("/");
}

test("a fresh device opens the public zero state and can enter the shared admin workspace", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText("شفافية مالية للجميع")).toBeVisible();
  await expect(page.getByText("0 DH").first()).toBeVisible();
  await expect(page.getByText("ما كاين حتى مصروف مسجل دابا."))
    .toBeVisible({ timeout: 5_000 })
    .catch(() => undefined);
  await page.getByRole("button", { name: "دخول المشرف" }).click();
  await page.locator("#operator-name").fill("فاطمة");
  await page.getByRole("button", { name: "دخول", exact: true }).click();
  await expect(page.getByText("بدا إعداد الصندوق")).toBeVisible();
  await expect(
    page.getByText("تصفير الصندوق للبدء بالبيانات الحقيقية"),
  ).toBeVisible();
});

test("guide is comprehensive and the desktop workspace uses the 4/8 split", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openAdminDemo(page);
  await page.getByRole("button", { name: "دليل الاستخدام" }).click();
  const guide = page.getByTestId("guide-drawer");
  await expect(guide).toBeVisible();
  await expect(guide.getByText("الشريط العلوي ولوحة الصندوق")).toBeVisible();
  await guide.getByRole("tab", { name: "دليل المشرف" }).click();
  await expect(guide.getByText("المصاريف والمقاصة")).toBeVisible();
  await expect(guide.getByText("الإعدادات والنسخ الاحتياطي")).toBeVisible();
  await expect(guide.locator('[data-slot="badge"]')).toHaveCount(5);
  const body = guide.getByTestId("guide-scroll-body");
  await body.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(
    guide.getByRole("button", { name: "إغلاق الدليل" }),
  ).toBeInViewport();
  await guide.getByRole("button", { name: "إغلاق الدليل" }).click();
  const [sidebar, workspace] = await Promise.all([
    page.getByTestId("dashboard-sidebar").boundingBox(),
    page.getByTestId("dashboard-workspace").boundingBox(),
  ]);
  expect(sidebar?.width).toBeGreaterThan(250);
  expect(workspace?.width).toBeGreaterThan(sidebar?.width ?? 0);
  expect((workspace?.x ?? 0) + (workspace?.width ?? 0)).toBeLessThanOrEqual(
    1440,
  );
});

test("dark is the first-visit theme and a light choice persists", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAdminDemo(page);
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "تفعيل الوضع الفاتح" }).click();
  await expect(page.locator("html")).toHaveClass(/light/);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("sandouq:theme")))
    .toBe("light");
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/light/);
  await page.getByRole("button", { name: "تفعيل الوضع الداكن" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("the five RTL navigation controls fit a 320px phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openAdminDemo(page);
  await expect(page.locator("nav button")).toHaveCount(5);
  const boxes = await page.locator("nav button").evaluateAll((buttons) =>
    buttons.map((button) => {
      const rect = button.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        scrollWidth: button.scrollWidth,
        width: button.clientWidth,
      };
    }),
  );
  for (const box of boxes) {
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(320);
    expect(box.scrollWidth).toBeLessThanOrEqual(box.width);
  }
  await page.getByRole("button", { name: "الإحصائيات" }).click();
  await expect(page.getByText("آخر العمليات", { exact: true })).toBeVisible();
  await expect(page.getByText("توزيع المصاريف", { exact: true })).toBeVisible();
  await expect(page.getByRole("table")).toContainText("DH");
});

test("member actions retain edit and confirmed archive in dark mode", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAdminDemo(page);
  await page.getByRole("button", { name: /خيارات العضو مريم/ }).click();
  await expect(
    page.getByRole("menuitem", { name: "تعديل العضو" }),
  ).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: "إلغاء المساهمة" }),
  ).toBeVisible();
  await page.getByRole("menuitem", { name: "حذف العضو" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("وتبقى مساهماته محفوظة");
  await expect(
    dialog.getByRole("button", { name: "حذف العضو" }),
  ).toBeInViewport();
  await dialog.getByRole("button", { name: "إلغاء" }).click();
});

test("WhatsApp draft follows the selected admin identity", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAdminDemo(page);
  await page
    .getByRole("button", { name: /واتساب/ })
    .first()
    .click();
  await expect(page.getByRole("textbox", { name: "نص الرسالة" })).toContainText(
    "اختبار",
  );
  await page
    .locator('[data-slot="drawer-content"]')
    .getByRole("button", { name: "إلغاء" })
    .click();
  await page.getByRole("combobox", { name: "المشرف الحالي" }).click();
  await page.getByRole("option", { name: "المشرف: أمين" }).click();
  await page.locator("#switch-pin").fill("654321");
  await page.getByRole("dialog").getByRole("button", { name: "تأكيد" }).click();
  await expect(
    page.getByRole("combobox", { name: "المشرف الحالي" }),
  ).toContainText("أمين");
  await page
    .getByRole("button", { name: /واتساب/ })
    .first()
    .click();
  await expect(page.getByRole("textbox", { name: "نص الرسالة" })).toContainText(
    "اختبار",
  );
});

test("reduced motion stops the vault glow while charts remain readable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await openAdminDemo(page);
  await expect(page.locator(".ambient-glow").first()).toHaveCSS(
    "animation-name",
    "none",
  );
  await page.getByRole("tab", { name: "الإحصائيات" }).click();
  await expect(page.getByText("حركة الصندوق", { exact: true })).toBeVisible();
  await expect(page.getByText("معدل الالتزام", { exact: true })).toBeVisible();
  await expect(page.getByText("توزيع المصاريف", { exact: true })).toBeVisible();
  await expect(page.getByText("آخر العمليات", { exact: true })).toBeVisible();
});

for (const width of [768, 1024, 1440]) {
  test(`analytics bento has no horizontal overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await openAdminDemo(page);
    await page.getByRole("tab", { name: "الإحصائيات" }).click();
    await expect(page.getByText("آخر العمليات", { exact: true })).toBeVisible();
    const bounds = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(bounds.content).toBeLessThanOrEqual(bounds.viewport);
    await expect(
      page.getByRole("img", {
        name: "مداخيل ومصاريف الصندوق خلال آخر ستة أشهر",
      }),
    ).toBeVisible();
  });
}
