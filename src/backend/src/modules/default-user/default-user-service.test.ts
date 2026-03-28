import test from 'node:test';
import assert from 'node:assert/strict';
import { DefaultUserService } from './default-user-service.js';

test('DefaultUserService preserves saved profile values for the local default user', async function () {
  const service = new DefaultUserService({
    tenant: {
      async upsert() {
        return {
          id: 'tenant-1'
        };
      }
    },
    appUser: {
      async findUnique(input) {
        if (input && 'where' in input && input.where && 'tenantId_email' in input.where) {
          return {
            id: 'user-1',
            tenantId: 'tenant-1',
            email: 'profile@example.com',
            displayName: 'Profile Name',
            phoneticName: 'Pro-file',
            timezone: 'America/New_York',
            locale: 'en-US',
            isAdmin: true,
            isActive: true
          };
        }

        return null;
      },
      async count() {
        return 1;
      },
      async update() {
        return {
          id: 'user-1',
          tenantId: 'tenant-1',
          email: 'profile@example.com',
          displayName: 'Profile Name',
          phoneticName: 'Pro-file',
          timezone: 'America/New_York',
          locale: 'en-US',
          isAdmin: true,
          isActive: true
        };
      },
      async create() {
        throw new Error('not expected');
      }
    }
  } as never);

  const user = await service.getDefaultUser();

  assert.deepEqual(user, {
    tenantId: 'tenant-1',
    userId: 'user-1',
    displayName: 'Profile Name',
    phoneticName: 'Pro-file',
    timezone: 'America/New_York',
    locale: 'en-US',
    email: 'profile@example.com',
    isAdmin: true
  });
});
