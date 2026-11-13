import { app } from './app';
import { env } from './config/env';
import { pool } from './config/database';

const server = app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`LaundryManager API listening on port ${env.PORT}`);
});

async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
