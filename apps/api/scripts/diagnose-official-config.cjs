const { config: loadEnv } = require('dotenv');
const { resolve } = require('node:path');

const envCandidates = [
  resolve(__dirname, '../../.env'),
  resolve(__dirname, '../.env')
];

envCandidates.forEach((candidate) => {
  loadEnv({ path: candidate, override: false });
});

const raw = process.env.OFFICIAL_CONFIG_JSON;

console.log('OFFICIAL_CONFIG_JSON (raw):', raw ?? '(undefined)');

if (raw === undefined) {
  console.error('The OFFICIAL_CONFIG_JSON variable is not defined in the current environment.');
  process.exit(1);
}

const trimmed = raw.trim();
console.log(`Trimmed value (${trimmed.length} characters):`, trimmed || '(empty)');

try {
  const parsed = JSON.parse(trimmed);
  if (!Array.isArray(parsed)) {
    console.error('Parsed value is not an array.');
    process.exit(1);
  }

  console.log(`Parsed ${parsed.length} configuration entr${parsed.length === 1 ? 'y' : 'ies'} successfully.`);
  parsed.forEach((entry, index) => {
    console.log(`Entry #${index}:`, JSON.stringify(entry, null, 2));
  });
  process.exit(0);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Failed to parse OFFICIAL_CONFIG_JSON:', message);

  if (/Expected property name or '\}' in JSON/.test(message)) {
    const looksUnquotedKey = /[{,]\s*[-A-Za-z0-9_]+\s*:/.test(trimmed);
    if (looksUnquotedKey) {
      console.error('Hint: Make sure every key is wrapped in double quotes, e.g. {"guildId": "123"}.');
    }
  }

  if (/Unexpected token '\\'/.test(message)) {
    console.error(
      'Hint: Extra backslashes detected. When you store the value in a .env file, remove the escaping and keep plain JSON.'
    );
  }

  process.exit(1);
}
