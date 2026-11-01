import { expect, test } from "@playwright/test";

test("dark is the first-visit theme and a light choice persists", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "تفعيل الوضع الفاتح" }).click();
  await expect(page.locator("html")).toHaveClass(/light/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("sandouq:theme"))).toBe("light");
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/light/);
  await page.getByRole("button", { name: "تفعيل الوضع الداكن" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("the five RTL navigation controls fit a 320px phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  await expect(page.locator("nav button")).toHaveCount(5);
  const boxes = await page.locator("nav button").evaluateAll((buttons) => buttons.map((button) => {
    const rect = button.getBoundingClientRect();
    return { left: rect.left, right: rect.right, scrollWidth: button.scrollWidth, width: button.clientWidth };
  }));
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

test("member actions retain edit and confirmed archive in dark mode", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /خيارات العضو مريم/ }).click();
  await expect(page.getByRole("menuitem", { name: "تعديل العضو" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "إلغاء المساهمة" })).toBeVisible();
  await page.getByRole("menuitem", { name: "حذف العضو" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("وتبقى مساهماته محفوظة");
  await expect(dialog.getByRole("button", { name: "حذف العضو" })).toBeInViewport();
  await dialog.getByRole("button", { name: "إلغاء" }).click();
});

test("WhatsApp draft follows the selected admin identity", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /واتساب/ }).first().click();
  await expect(page.getByRole("textbox", { name: "نص الرسالة" })).toContainText("محمد");
  await page.locator('[data-slot="drawer-content"]').getByRole("button", { name: "إلغاء" }).click();
  await page.getByRole("combobox", { name: "المشرف الحالي" }).click();
  await page.getByRole("option", { name: "المشرف: أمين" }).click();
  await page.locator("#switch-pin").fill("654321");
  await page.getByRole("dialog").getByRole("button", { name: "تأكيد" }).click();
  await expect(page.getByRole("combobox", { name: "المشرف الحالي" })).toContainText("أمين");
  await page.getByRole("button", { name: /واتساب/ }).first().click();
  await expect(page.getByRole("textbox", { name: "نص الرسالة" })).toContainText("أمين");
});

test("reduced motion stops the vault glow while charts remain readable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator(".ambient-glow").first()).toHaveCSS("animation-name", "none");
  await page.getByRole("tab", { name: "الإحصائيات" }).click();
  await expect(page.getByText("حركة الصندوق", { exact: true })).toBeVisible();
  await expect(page.getByText("معدل الالتزام", { exact: true })).toBeVisible();
  await expect(page.getByText("توزيع المصاريف", { exact: true })).toBeVisible();
  await expect(page.getByText("آخر العمليات", { exact: true })).toBeVisible();
});

for (const width of [768, 1024, 1440]) {
  test(`analytics bento has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.getByRole("tab", { name: "الإحصائيات" }).click();
    await expect(page.getByText("آخر العمليات", { exact: true })).toBeVisible();
    const bounds = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
    expect(bounds.content).toBeLessThanOrEqual(bounds.viewport);
    await expect(page.getByRole("img", { name: "مداخيل ومصاريف الصندوق خلال آخر ستة أشهر" })).toBeVisible();
  });
}
