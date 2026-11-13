import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

const envFile = process.env.LAUNDRY_ENV_FILE ??
  (process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'LaundryManager', 'backend.env')
    : path.resolve(process.cwd(), '.env'));
dotenv.config({ path: envFile });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false')
});

export const env = schema.parse(process.env);
