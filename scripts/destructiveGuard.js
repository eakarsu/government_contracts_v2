const CONFIRMATION = 'DELETE_LOCAL_GOVERNANCE_DATA';

function assertDestructiveResetAllowed(environment = process.env) {
  if (environment.NODE_ENV === 'production') {
    throw new Error('Destructive resets are forbidden in production');
  }
  if (environment.ALLOW_DESTRUCTIVE_RESET !== CONFIRMATION) {
    throw new Error(`Set ALLOW_DESTRUCTIVE_RESET=${CONFIRMATION} for this one local reset`);
  }
  const databaseUrl = environment.DATABASE_URL || '';
  let host;
  try {
    host = new URL(databaseUrl).hostname;
  } catch (error) {
    throw new Error('A valid DATABASE_URL is required for reset confirmation');
  }
  if (!['127.0.0.1', 'localhost', 'postgres'].includes(host)) {
    throw new Error(`Refusing destructive reset for non-local database host: ${host}`);
  }
}

module.exports = { CONFIRMATION, assertDestructiveResetAllowed };
