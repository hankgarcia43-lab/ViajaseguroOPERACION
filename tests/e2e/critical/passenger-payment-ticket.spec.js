const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/session');

test.describe('Flujo critico de pasajero y pago manual', () => {
  test('PSG-CRIT-001 pasajero ve solicitudes y pases', async ({ page }) => {
    const email = process.env.E2E_PASSENGER_EMAIL;
    const password = process.env.E2E_PASSENGER_PASSWORD;

    test.skip(!email || !password, 'Configura E2E_PASSENGER_EMAIL y E2E_PASSENGER_PASSWORD');

    await login(page, email, password);
    await page.goto('/dashboard/my-reservations');
    await expect(page.getByText(/solicitudes|pases|ticket|codigo/i).first()).toBeVisible();
  });

  test('PSG-CRIT-002 ticket muestra estado coherente del codigo de abordaje', async ({ page }) => {
    const email = process.env.E2E_PASSENGER_EMAIL;
    const password = process.env.E2E_PASSENGER_PASSWORD;
    const ticketId = process.env.E2E_PENDING_TICKET_ID;

    test.skip(!email || !password || !ticketId, 'Configura credenciales y E2E_PENDING_TICKET_ID');

    await login(page, email, password);
    await page.goto(`/dashboard/my-reservations/${ticketId}/ticket`);

    const blockedMessage = page.getByText(/tu pago aun no ha sido validado|codigo de abordaje bloqueado|qr de abordaje se habilitara/i).first();
    const activeCode = page.getByText(/codigo principal de abordaje|codigo de abordaje/i).first();

    if ((await blockedMessage.count()) > 0) {
      await expect(blockedMessage).toBeVisible();
      await expect(page.getByText(/tu pago aun no ha sido validado|se habilitara/i).first()).toBeVisible();
    } else {
      await expect(activeCode).toBeVisible();
      await expect(page.getByText(/[0-9]{6}/).first()).toBeVisible();
    }
  });
});
