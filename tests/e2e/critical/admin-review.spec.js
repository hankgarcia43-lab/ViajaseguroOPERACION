const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/session');

test.describe('Flujo critico admin', () => {
  test('ADM-CRIT-001 admin ve panel operativo', async ({ page }) => {
    const email = process.env.E2E_ADMIN_EMAIL;
    const password = process.env.E2E_ADMIN_PASSWORD;

    test.skip(!email || !password, 'Configura E2E_ADMIN_EMAIL y E2E_ADMIN_PASSWORD');

    await login(page, email, password);
    await page.goto('/dashboard/admin');
    await expect(page.getByRole('link', { name: /verificaciones/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /vehiculos|vehículos/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /planes pagados|planes|pagos/i })).toBeVisible();
  });

  test('ADM-CRIT-002 admin revisa pagos pendientes', async ({ page }) => {
    const email = process.env.E2E_ADMIN_EMAIL;
    const password = process.env.E2E_ADMIN_PASSWORD;

    test.skip(!email || !password, 'Configura E2E_ADMIN_EMAIL y E2E_ADMIN_PASSWORD');

    await login(page, email, password);
    await page.goto('/dashboard/admin/payments');
    await expect(page.getByText(/pagos|pendientes|estado/i).first()).toBeVisible();
  });
});