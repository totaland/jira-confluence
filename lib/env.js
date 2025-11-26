const fs = require('fs');
const path = require('path');

function loadEnv(envFileName = '.env') {
  const envFilePath = path.resolve(process.cwd(), envFileName);
  if (!fs.existsSync(envFilePath)) {
    return;
  }

  try {
    // Lazy-load to avoid requiring dotenv unless a file exists.
    const dotenv = require('dotenv');
    dotenv.config({ path: envFilePath });
  } catch (error) {
    throw new Error(
      'dotenv module is required to load .env files. Install it with `npm install dotenv`.'
    );
  }
}

module.exports = {
  loadEnv,
};
