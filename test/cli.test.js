import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
    existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { VERSION } from '../src/version.js';

const BIN = fileURLToPath(new URL('../bin/brigade.js', import.meta.url));

function brigade(args, cwd = mkdtempSync(join(tmpdir(), 'brigade-cli-'))) {
    const result = spawnSync(process.execPath, [
        BIN,
        ...args
    ], {
        cwd,
        encoding: 'utf8',
        stdin: 'ignore'
    });

    return {
        code: result.status,
        out: result.stdout,
        err: result.stderr,
        cwd
    };
}

test('--help and -h print the usage and exit 0, also after init', () => {
    for (const args of [
        [
            '--help'
        ],
        [
            '-h'
        ],
        [],
        [
            'init',
            '--help'
        ],
        [
            'init',
            '-h'
        ]
    ]) {
        const { code, out, cwd } = brigade(args);

        assert.equal(code, 0, args.join(' '));
        assert.match(out, /Usage: brigade init/);
        assert.ok(!existsSync(join(cwd, '.claude')));
    }
});

test('--version prints the package version', () => {
    const { code, out } = brigade([
        '--version'
    ]);

    assert.equal(code, 0);
    assert.equal(out.trim(), VERSION);
    assert.equal(brigade([
        '-v'
    ]).out.trim(), VERSION);
});

test('an unknown command is reported as such and exits 1', () => {
    const { code, err } = brigade([
        'frobnicate'
    ]);

    assert.equal(code, 1);
    assert.match(err, /Unknown command: frobnicate/);
});

test('--stack without a value gives a clear message', () => {
    for (const args of [
        [
            'init',
            '--stack'
        ],
        [
            'init',
            '--stack',
            '--yes'
        ]
    ]) {
        const { code, err, cwd } = brigade(args);

        assert.equal(code, 1);
        assert.match(err, /--stack needs a value/);
        assert.ok(!existsSync(join(cwd, '.claude')));
    }
});

test('an unknown stack and an unknown option are rejected', () => {
    assert.match(brigade([
        'init',
        '--stack',
        'nope'
    ]).err, /Unknown stack: nope/);

    assert.match(brigade([
        'init',
        '--stack=nope'
    ]).err, /Unknown stack: nope/);

    assert.match(brigade([
        'init',
        '--nope'
    ]).err, /Unknown option: --nope/);
});

test('init --yes installs the kit', () => {
    const { code, cwd } = brigade([
        'init',
        '--yes'
    ]);

    assert.equal(code, 0);
    assert.ok(existsSync(join(cwd, '.claude/brigade.json')));
    assert.ok(existsSync(join(cwd, '.claude/rules/brigade-options.md')));
});

test('a corrupted manifest stops init with a clear error and writes nothing', () => {
    const first = brigade([
        'init',
        '--yes'
    ]);

    writeFileSync(join(first.cwd, '.claude/brigade.json'), '{ broken');

    const again = brigade([
        'init',
        '--yes'
    ], first.cwd);

    assert.equal(again.code, 1);
    assert.match(again.err, /brigade\.json is corrupted/);
});

test('the plain summary lists the files, the recap and the next step', () => {
    const { code, out } = brigade([
        'init',
        '--yes'
    ]);

    assert.equal(code, 0);
    assert.match(out, /^Brigade installed \(stack: web\)\./);
    assert.match(out, /^added +\.claude\/rules\/brigade\.md$/m);
    assert.match(out, /^lines added +\.gitignore \(.*CLAUDE\.local\.md\)$/m);
    assert.match(out, new RegExp(`^Brigade {10}${VERSION}$`, 'm'));
    assert.match(out, /^Replies for you {2}project default$/m);
    assert.match(out, /Commit \.claude\/ including \.claude\/brigade\.json/);
    assert.doesNotMatch(out, /New options/);
});

test('the plain summary shows a kept file and its proposal', () => {
    const first = brigade([
        'init',
        '--yes'
    ]);

    writeFileSync(join(first.cwd, '.claude/rules/brigade.md'), 'mine\n');
    const file = join(first.cwd, '.claude/brigade.json');
    const manifest = JSON.parse(readFileSync(file, 'utf8'));

    manifest.files['.claude/rules/brigade.md'] = 'an older kit version';
    writeFileSync(file, JSON.stringify(manifest));

    const { code, out, cwd } = brigade([
        'init',
        '--yes'
    ], first.cwd);

    assert.equal(code, 0);
    assert.match(out, /^yours kept, proposal written +\.claude\/rules\/brigade\.md\.proposed$/m);
    assert.match(out, /^already up to date +\.claude\/settings\.json$/m);
    assert.equal(readFileSync(join(cwd, '.claude/rules/brigade.md'), 'utf8'), 'mine\n');
});

test('the plain summary names the options added by an update', () => {
    const first = brigade([
        'init',
        '--yes'
    ]);
    const file = join(first.cwd, '.claude/brigade.json');
    const manifest = JSON.parse(readFileSync(file, 'utf8'));

    manifest.version = '0.0.1';
    delete manifest.answers.docsLanguage;
    writeFileSync(file, JSON.stringify(manifest));

    const { code, out } = brigade([
        'init',
        '--yes'
    ], first.cwd);

    assert.equal(code, 0);
    assert.match(out, /^New options, default used: .*docsLanguage: English$/m);
});

test('--dry-run lists what would be written and writes nothing', () => {
    const { code, out, cwd } = brigade([
        'init',
        '--dry-run'
    ]);

    assert.equal(code, 0);
    assert.match(out, /^Brigade dry run \(stack: web\)\. Nothing was written\./);
    assert.match(out, /^would be added +\.claude\/rules\/brigade\.md$/m);
    assert.match(out, /Run without --dry-run to apply\./);
    assert.ok(!existsSync(join(cwd, '.claude')));
});

test('--help documents --dry-run and uninstall', () => {
    assert.match(brigade([
        '--help'
    ]).out, /--dry-run/);

    assert.match(brigade([
        '--help'
    ]).out, /brigade uninstall/);
});

test('uninstall --dry-run lists the plan and writes nothing', () => {
    const first = brigade([
        'init',
        '--yes'
    ]);

    writeFileSync(join(first.cwd, '.claude/rules/brigade.md'), 'mine\n');

    const { code, out, cwd } = brigade([
        'uninstall',
        '--dry-run'
    ], first.cwd);

    assert.equal(code, 0);
    assert.match(out, /^Brigade uninstall dry run\. Nothing was removed\./);
    assert.match(out, /^yours kept, delete it yourself +\.claude\/rules\/brigade\.md$/m);
    assert.match(out, /^would be removed +\.claude\/brigade\.json$/m);
    assert.match(out, /Left in place, .*\.gitignore/);
    assert.ok(existsSync(join(cwd, '.claude/brigade.json')));
});

test('uninstall without --yes and without a terminal exits 1 and writes nothing', () => {
    const first = brigade([
        'init',
        '--yes'
    ]);

    const { code, err, cwd } = brigade([
        'uninstall'
    ], first.cwd);

    assert.equal(code, 1);
    assert.match(err, /uninstall needs --yes without a terminal/);
    assert.ok(existsSync(join(cwd, '.claude/brigade.json')));
});

test('uninstall --yes removes the install, and fails where nothing is installed', () => {
    const first = brigade([
        'init',
        '--yes'
    ]);

    const { code, out, cwd } = brigade([
        'uninstall',
        '--yes'
    ], first.cwd);

    assert.equal(code, 0);
    assert.match(out, /^Brigade removed\./);
    assert.match(out, /still in your git history/);
    assert.ok(!existsSync(join(cwd, '.claude')));

    const again = brigade([
        'uninstall',
        '--yes'
    ], cwd);

    assert.equal(again.code, 1);
    assert.match(again.err, /Brigade is not installed here/);
});

test('the plain summary reports a file removed from the kit', () => {
    const first = brigade([
        'init',
        '--yes'
    ]);
    const file = join(first.cwd, '.claude/brigade.json');
    const manifest = JSON.parse(readFileSync(file, 'utf8'));

    writeFileSync(join(first.cwd, 'old.md'), 'old\n');
    manifest.files['old.md'] = createHash('sha256').update('old\n').digest('hex');
    writeFileSync(file, JSON.stringify(manifest));

    const { out } = brigade([
        'init',
        '--yes'
    ], first.cwd);

    assert.match(out, /^removed, no longer in the kit +old\.md$/m);
    assert.ok(!existsSync(join(first.cwd, 'old.md')));
});

test('the plain summary shows a proposal once, then keeps quiet', () => {
    const rule = '.claude/rules/brigade.md';

    const first = brigade([
        'init',
        '--yes'
    ]);
    const kit = readFileSync(join(first.cwd, rule), 'utf8');
    const manifestFile = join(first.cwd, '.claude/brigade.json');
    const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));

    manifest.files[rule] = 'an older kit version';
    writeFileSync(manifestFile, JSON.stringify(manifest));
    writeFileSync(join(first.cwd, rule), kit.replace('# Brigade', '# Brigade, mine'));

    const { code, out, cwd } = brigade([
        'init',
        '--yes'
    ], first.cwd);

    assert.equal(code, 0);
    assert.match(out, /^yours kept, proposal written +\.claude\/rules\/brigade\.md\.proposed$/m);
    assert.equal(readFileSync(join(cwd, `${rule}.proposed`), 'utf8'), kit);

    // Delivered once: the next run is quiet and the proposal stays as the reminder.
    const next = brigade([
        'init',
        '--yes'
    ], cwd);

    assert.match(next.out, /^yours kept +\.claude\/rules\/brigade\.md$/m);
    assert.ok(existsSync(join(cwd, `${rule}.proposed`)));
});

test('the dry run shows a proposal with the "would be" wording and writes nothing', () => {
    const rule = '.claude/rules/brigade.md';

    const first = brigade([
        'init',
        '--yes'
    ]);
    const kit = readFileSync(join(first.cwd, rule), 'utf8');
    const manifestFile = join(first.cwd, '.claude/brigade.json');
    const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));

    manifest.files[rule] = 'an older kit version';
    writeFileSync(manifestFile, JSON.stringify(manifest));
    writeFileSync(join(first.cwd, rule), kit.replace('# Brigade', '# Brigade, mine'));

    const { out, cwd } = brigade([
        'init',
        '--dry-run'
    ], first.cwd);

    assert.match(out, /^yours kept, proposal would be written +\.claude\/rules\/brigade\.md\.proposed$/m);
    assert.ok(!existsSync(join(cwd, `${rule}.proposed`)));
});

test('an update removes the old .claude/brigade-base/ folder, the dry run only lists it', () => {
    const first = brigade([
        'init',
        '--yes'
    ]);

    mkdirSync(join(first.cwd, '.claude/brigade-base/rules'), {
        recursive: true
    });

    writeFileSync(join(first.cwd, '.claude/brigade-base/rules/brigade.md'), 'old base\n');

    const preview = brigade([
        'init',
        '--dry-run'
    ], first.cwd);

    assert.match(preview.out, /^would be removed, no longer in the kit +\.claude\/brigade-base\/$/m);
    assert.ok(existsSync(join(first.cwd, '.claude/brigade-base')));

    const { out } = brigade([
        'init',
        '--yes'
    ], first.cwd);

    assert.match(out, /^removed, no longer in the kit +\.claude\/brigade-base\/$/m);
    assert.ok(!existsSync(join(first.cwd, '.claude/brigade-base')));
});
