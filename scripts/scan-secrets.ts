import * as fs from 'fs';
import * as path from 'path';

interface SecretPattern {
  id: string;
  description: string;
  regex: RegExp;
  exceptions?: RegExp[];
}

const SECRET_PATTERNS: SecretPattern[] = [
  {
    id: 'firebase_live_key',
    description: 'Active Firebase / Google API key',
    regex: /AIza[0-9A-Za-z\-_]{35}/,
    exceptions: [/AIzaSyDummyDevKeyForTestingOnly00000/],
  },
  {
    id: 'raw_twilio_auth_token',
    description: 'Raw Twilio Auth Token',
    regex: /(?:TWILIO_AUTH_TOKEN|twilio_token)\s*=\s*['"][a-f0-9]{32}['"]/i,
  },
  {
    id: 'unencrypted_private_key',
    description: 'Private Key header',
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
  },
];

const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.expo',
  'dist',
  'build',
  '.system_generated',
  'tests',
  '__tests__',
]);

const IGNORE_FILES = new Set([
  'package-lock.json',
  '.env.example',
]);

export function scanFileForSecrets(filePath: string, content: string): Array<{ id: string; description: string; line: number }> {
  const issues: Array<{ id: string; description: string; line: number }> = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.regex.test(line)) {
        const isExcepted = pattern.exceptions?.some((exc) => exc.test(line));
        if (!isExcepted) {
          issues.push({
            id: pattern.id,
            description: pattern.description,
            line: i + 1,
          });
        }
      }
    }
  }

  return issues;
}

export function scanRepository(rootDir: string): Array<{ file: string; issues: Array<{ id: string; description: string; line: number }> }> {
  const results: Array<{ file: string; issues: Array<{ id: string; description: string; line: number }> }> = [];

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.has(entry.name)) {
          walk(path.join(currentDir, entry.name));
        }
      } else if (entry.isFile()) {
        if (!IGNORE_FILES.has(entry.name)) {
          const fullPath = path.join(currentDir, entry.name);
          const relPath = path.relative(rootDir, fullPath);
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const issues = scanFileForSecrets(relPath, content);
            if (issues.length > 0) {
              results.push({ file: relPath, issues });
            }
          } catch {
            // Binary or unreadable file
          }
        }
      }
    }
  }

  walk(rootDir);
  return results;
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const leaks = scanRepository(root);
  if (leaks.length > 0) {
    console.error('SECRET SCAN FAILURE: Leaks detected in repository:');
    console.error(JSON.stringify(leaks, null, 2));
    process.exit(1);
  } else {
    console.log('Secret scan passed: Zero secrets found in repository.');
  }
}
