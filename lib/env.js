import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

export function loadEnv(envFileName = '.env') {
  const envFilePath = path.resolve(process.cwd(), envFileName);
  if (!fs.existsSync(envFilePath)) {
    return;
  }

  try {
    dotenv.config({ path: envFilePath });
  } catch (error) {
    throw new Error(
      'dotenv module is required to load .env files. Install it with `npm install dotenv`.'
    );
  }
}
