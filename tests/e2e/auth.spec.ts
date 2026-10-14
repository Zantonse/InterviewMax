import { expect, test } from "@playwright/test";

test("signed-out visitors are sent to sign in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Build stories that land." })).toBeVisible();
  await expect(page.getByLabel("Work or personal email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Email me a sign-in link" })).toBeVisible();
});

test("opening an email link doesn't sign in until Continue is clicked", async ({ page }) => {
  // Mail scanners open links with a GET; that must not use up the one-time token.
  await page.goto("/auth/confirm?token_hash=bad&type=email");
  await expect(page).toHaveURL(/\/auth\/continue\?token_hash=bad&type=email$/);
  await expect(page.getByRole("button", { name: "Continue to InterviewMax" })).toBeVisible();
});

test("an expired email link shows a clear message", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=bad&type=email");
  await page.getByRole("button", { name: "Continue to InterviewMax" }).click();
  await expect(page).toHaveURL(/\/login\?error=link$/);
  await expect(page.getByText("That sign-in link didn't work or has expired")).toBeVisible();
});

test("the story builder needs a signed-in user", async ({ page }) => {
  await page.goto("/stories/new");
  await expect(page).toHaveURL(/\/login$/);
});

test("Map my role needs a signed-in user", async ({ page }) => {
  await page.goto("/stories/00000000-0000-0000-0000-000000000000/map");
  await expect(page).toHaveURL(/\/login$/);
});

test("target jobs need a signed-in user", async ({ page }) => {
  await page.goto("/jobs");
  await expect(page).toHaveURL(/\/login$/);
});

test("adding a target job needs a signed-in user", async ({ page }) => {
  await page.goto("/jobs/new");
  await expect(page).toHaveURL(/\/login$/);
});
