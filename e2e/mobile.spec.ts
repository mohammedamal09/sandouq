import { expect, test } from "@playwright/test";

for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
  test(`passbook and expense drawers keep actions visible at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByText("مساهمات الأعضاء")).toBeVisible();
    await page.locator("button.min-w-0.flex-1.text-start").first().click();
    const passbook = page.locator('[data-slot="drawer-content"]:visible');
    await expect(passbook).toBeVisible();
    const scrollBody = passbook.locator(".overflow-y-auto").first();
    await expect(scrollBody).toBeVisible();
    const dimensions = await scrollBody.evaluate((element) => ({ client: element.clientHeight, full: element.scrollHeight }));
    expect(dimensions.full).toBeGreaterThan(dimensions.client);
    await scrollBody.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await expect(passbook.getByRole("button", { name: "إغلاق" })).toBeInViewport();
    await passbook.getByRole("button", { name: "إغلاق" }).click();
    await page.getByRole("button", { name: "قيد مصروف" }).click();
    const expense = page.locator('[data-slot="drawer-content"]:visible');
    await expect(expense.getByRole("button", { name: "تسجيل المصروف" })).toBeInViewport();
    await expect(expense.locator(".overflow-y-auto").first()).toBeVisible();
  });
}

test("mobile navigation exposes analytics and privacy blur", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("nav button")).toHaveCount(5);
  await page.getByRole("button", { name: "إخفاء الأسماء" }).click();
  await expect(page.locator(".private-blur").first()).toBeVisible();
  await page.locator("nav button").nth(3).click();
  await expect(page.getByText("حركة الصندوق", { exact: true })).toBeVisible();
  await expect(page.getByText("معدل الالتزام", { exact: true })).toBeVisible();
  await expect(page.getByText("توزيع المصاريف", { exact: true })).toBeVisible();
});

test("expense edit and delete keep an audited ledger entry", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator("nav button").nth(1).click();
  await page.getByRole("button", { name: /خيارات المصروف/ }).first().click();
  await page.getByRole("menuitem", { name: "تعديل" }).click();
  const drawer = page.locator('[data-slot="drawer-content"]:visible');
  await expect(drawer.getByText("تعديل المصروف")).toBeVisible();
  await expect(drawer.locator("#expense-title")).not.toHaveValue("");
  await drawer.locator("#expense-title").fill("مصروف مصحح");
  await drawer.getByRole("button", { name: "حفظ التعديل" }).click();
  await expect(page.getByText("مصروف مصحح")).toBeVisible();
  await page.getByRole("button", { name: "خيارات المصروف مصروف مصحح" }).click();
  await page.getByRole("menuitem", { name: "حذف" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("هل أنت متأكد من حذف هذا المصروف؟");
  await page.getByRole("alertdialog").getByRole("button", { name: "حذف المصروف" }).click();
  await expect(page.getByText("مصروف مصحح")).toHaveCount(0);
  await page.locator("nav button").filter({ hasText: "السجل" }).click();
  await expect(page.getByText("مصروف مصحح")).toBeVisible();
});

test("settings admin dialog validates PIN and keeps its actions reachable", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  await page.locator("nav button").nth(4).click();
  await page.getByRole("button", { name: "إضافة مشرف جديد" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("#admin-name").fill("مشرف تجريبي");
  await dialog.locator("#admin-pin").fill("123");
  await dialog.getByRole("button", { name: "حفظ" }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "حفظ" })).toBeInViewport();
  await dialog.locator("#admin-pin").fill("123456");
  await dialog.getByRole("button", { name: "حفظ" }).click();
  await expect(page.getByText("مشرف تجريبي")).toBeVisible();
});

test("analytics explains empty commitment and expense data", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText("مساهمات الأعضاء")).toBeVisible();
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("sandouq:local:v1")!);
    state.members = []; state.payments = []; state.waivers = []; state.expenses = [];
    localStorage.setItem("sandouq:local:v1", JSON.stringify(state));
  });
  await page.reload();
  await page.locator("nav button").nth(3).click();
  await expect(page.getByText("ما كاينينش أعضاء مؤهلين هاد الشهر")).toBeVisible();
  await expect(page.getByText("ما كاين حتى مصروف مسجل")).toBeVisible();
  await expect(page.getByRole("table")).toContainText("0 DH");
});
