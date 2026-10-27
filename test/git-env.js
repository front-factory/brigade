import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Imported for its side effect: real `git` ignores the user and system config, so the tests do not depend on the machine.
// An empty temp file is used because git cannot open the Windows null device as a config file.
const dir = mkdtempSync(join(tmpdir(), 'brigade-git-'));
const file = join(dir, 'gitconfig');

writeFileSync(file, '');
process.env.GIT_CONFIG_GLOBAL = file;
process.env.GIT_CONFIG_NOSYSTEM = '1';
