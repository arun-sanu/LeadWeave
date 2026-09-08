import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saasStore } from './saasStore.ts';

test('SaaS Store: Multi-Tenant Companies, Plans, and User Management', async t => {
  await t.test('retrieves default subscription plans', () => {
    const plans = saasStore.getPlans();
    assert.equal(plans.length, 4);
    assert.equal(plans[0].name, 'Starter');
    assert.equal(plans[1].name, 'Growth');
    assert.equal(plans[2].name, 'Pro Team');
    assert.equal(plans[3].name, 'Enterprise');
  });

  await t.test('creates a new company and its initial admin user', async () => {
    const initialCompanyCount = saasStore.getCompanies().length;
    const initialUserCount = saasStore.getUsers().length;

    const newCompany = await saasStore.addCompany({
      name: 'Skyline Enterprises',
      slug: 'skyline',
      plan: 'Growth',
      maxUsers: 5,
      maxSessions: 2,
      maxAdmins: 1,
      maxHr: 0,
      monthlyPrice: 99,
      loginId: 'skyline',
      address: '123 test',
      phone: '123',
      altPhone: '123',
      adminEmail: 'boss@skyline.com',
      adminUsername: 'skyline_boss',
    });

    assert.ok(newCompany.id);
    assert.equal(newCompany.slug, 'skyline');
    assert.equal(newCompany.status, 'active');
    assert.equal(saasStore.getCompanies().length, initialCompanyCount + 1);
    assert.equal(saasStore.getUsers().length, initialUserCount + 1);
  });

  await t.test('toggles company status between active and suspended', () => {
    const companies = saasStore.getCompanies();
    const target = companies[0];
    const initialStatus = target.status;

    saasStore.toggleCompanyStatus(target.id);
    const updated = saasStore.getCompanies().find(c => c.id === target.id);
    assert.notEqual(updated?.status, initialStatus);
  });

  await t.test('adds an agent user to a specific company', async () => {
    const company = saasStore.getCompanies()[0];
    const initialUsersCount = company.activeUsersCount;

    const newUser = await saasStore.addUser({
      companyId: company.id,
      name: 'Agent Cooper',
      username: 'cooper_agent',
      email: 'cooper@fbi.gov',
      role: 'user',
    });

    assert.ok(newUser?.id);
    assert.equal(newUser?.companyId, company.id);

    const updatedCompany = saasStore.getCompanies().find(c => c.id === company.id);
    assert.equal(updatedCompany?.activeUsersCount, initialUsersCount + 1);
  });
});
