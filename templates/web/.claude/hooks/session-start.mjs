#!/usr/bin/env node
// SessionStart hook: tells the session that Brigade manages the project, and which version.
// Prints the standard `hookSpecificOutput.additionalContext` JSON. It never fails the session: it exits 0 and prints
// nothing when the project has no readable manifest.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function message(root) {
    try {
        const { version } = JSON.parse(readFileSync(join(root, '.claude', 'brigade.json'), 'utf8'));

        return typeof version === 'string' && version ? `Brigade v${version} manages this project.` : null;
    } catch {
        return null;
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    try {
        let cwd;

        try {
            cwd = JSON.parse(readFileSync(0, 'utf8'))?.cwd;
        } catch {
            // No payload: the project dir is enough.
        }

        const text = message(process.env.CLAUDE_PROJECT_DIR || cwd || process.cwd());

        if (text) {
            process.stdout.write(JSON.stringify({
                hookSpecificOutput: {
                    hookEventName: 'SessionStart',
                    additionalContext: text 
                },
                systemMessage: text
            }));
        }
    } catch {
        // Nothing to say rather than a failed session.
    }
}
