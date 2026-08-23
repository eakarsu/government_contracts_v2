'use strict';

function assertIsolatedTestDatabase(environment = process.env) {
  if (environment.RUN_DATABASE_TESTS !== '1') return;
  let name = '';
  try { name = new URL(environment.TEST_DATABASE_URL || environment.DATABASE_URL || '').pathname.replace(/^\//, ''); } catch {}
  if (!/(?:^|[_-])test(?:$|[_-])/i.test(name)) {
    throw new Error('RUN_DATABASE_TESTS=1 requires TEST_DATABASE_URL or DATABASE_URL whose database name explicitly contains "test"');
  }
  if (environment.NODE_ENV === 'production') throw new Error('Database integration fixtures are forbidden in production');
}

module.exports = { assertIsolatedTestDatabase };
