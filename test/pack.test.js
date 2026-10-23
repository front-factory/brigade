import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function listFiles(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name)],
    );
}

function packedFiles() {
    // On Windows npm is a .cmd shim, which needs a shell to be spawned.
    const out = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
        cwd: ROOT,
        encoding: 'utf8',
        shell: process.platform === 'win32',
        stdio: ['ignore', 'pipe', 'ignore'],
    });
    return new Set(JSON.parse(out)[0].files.map((file) => file.path));
}

test('the package ships bin, src and every template file, dotfiles included', () => {
    const packed = packedFiles();
    const templates = listFiles(join(ROOT, 'templates', 'web')).map((file) => relative(ROOT, file).split(sep).join('/'));
    assert.ok(templates.some((file) => file.startsWith('templates/web/.claude/')));
    for (const file of templates) assert.ok(packed.has(file), `missing from the package: ${file}`);
    assert.ok(packed.has('bin/brigade.js'));
    assert.ok([...packed].some((file) => file.startsWith('src/')));
    for (const file of readdirSync(join(ROOT, 'src'))) assert.ok(packed.has(`src/${file}`), `missing from the package: src/${file}`);
});
