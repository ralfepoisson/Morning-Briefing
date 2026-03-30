const { test, expect } = require('@playwright/test');

test.describe('Public pages', () => {
  test('home, terms, privacy, and contact pages are accessible without authentication', async ({ page }) => {
    let contactPayload;

    await page.route('**/api/v1/public/contact', async function (route) {
      contactPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Your message has been sent.'
        })
      });
    });

    await page.goto('/#/');

    await expect(page.getByRole('heading', { name: 'Daily Briefing for calmer mornings' })).toBeVisible();
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Terms' })).toBeVisible();
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Privacy', exact: true })).toBeVisible();
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Contact' })).toBeVisible();
    await expect(page.getByRole('main').getByRole('button', { name: 'Sign in' })).toBeVisible();

    await page.getByRole('navigation').getByRole('link', { name: 'Terms' }).click();
    await page.waitForURL('**/#/terms');
    await expect(page.getByRole('heading', { name: 'Terms of Service' })).toBeVisible();
    await expect(page.getByText('Last updated: March 30, 2026')).toBeVisible();
    await expect(page.getByText('You may not misuse the service')).toBeVisible();

    await page.getByRole('navigation').getByRole('link', { name: 'Privacy', exact: true }).click();
    await page.waitForURL('**/#/privacy');
    await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();
    await expect(page.getByText('Daily Briefing acts as the data controller')).toBeVisible();
    await expect(page.getByText('access, rectification, erasure')).toBeVisible();

    await page.getByRole('navigation').getByRole('link', { name: 'Contact' }).click();
    await page.waitForURL('**/#/contact');
    await expect(page.getByRole('heading', { name: 'Contact Us' })).toBeVisible();
    await page.getByLabel('Name').fill('Jane Doe');
    await page.getByLabel('Email').fill('jane@example.com');
    await page.getByLabel('Subject').fill('Interested in Daily Briefing');
    await page.getByLabel('Message').fill('I would like to learn more about the Daily Briefing product and roadmap.');
    await page.getByRole('button', { name: 'Send message' }).click();

    expect(contactPayload).toEqual({
      name: 'Jane Doe',
      email: 'jane@example.com',
      subject: 'Interested in Daily Briefing',
      message: 'I would like to learn more about the Daily Briefing product and roadmap.'
    });
    await expect(page.getByText('Thanks, your message has been sent.')).toBeVisible();
  });
});
