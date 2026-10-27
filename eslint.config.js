import { defineConfig, globalIgnores } from 'eslint/config';
import config from '@front-factory/eslint-config';

export default defineConfig([
    globalIgnores([
        'node_modules/**',
        'coverage/**'
    ]),
    config,
    {
        name: 'brigade/rules',
        rules: {
            // The CLI rethrows caught errors with its own user-facing message.
            'preserve-caught-error': 'off',
            '@stylistic/no-trailing-spaces': 'error',
            // Re-declares every entry: a later config replaces the rule options instead of merging them.
            '@stylistic/padding-line-between-statements': [
                'error',
                {
                    blankLine: 'always',
                    prev: '*',
                    next: 'return'
                },
                {
                    blankLine: 'always',
                    prev: [
                        'const',
                        'let',
                        'var'
                    ],
                    next: '*'
                },
                {
                    blankLine: 'any',
                    prev: [
                        'const',
                        'let',
                        'var'
                    ],
                    next: [
                        'const',
                        'let',
                        'var'
                    ]
                },
                {
                    blankLine: 'always',
                    prev: '*',
                    next: [
                        'if',
                        'for',
                        'while',
                        'switch',
                        'try'
                    ]
                },
                {
                    blankLine: 'always',
                    prev: [
                        'if',
                        'for',
                        'while',
                        'switch',
                        'try'
                    ],
                    next: '*'
                },
                {
                    blankLine: 'always',
                    prev: 'block-like',
                    next: '*'
                },
                {
                    blankLine: 'always',
                    prev: 'multiline-expression',
                    next: '*'
                },
                {
                    blankLine: 'always',
                    prev: '*',
                    next: 'function'
                },
                {
                    blankLine: 'always',
                    prev: 'function',
                    next: '*'
                },
                {
                    blankLine: 'always',
                    prev: 'directive',
                    next: '*'
                },
                {
                    blankLine: 'always',
                    prev: 'import',
                    next: '*'
                },
                {
                    blankLine: 'any',
                    prev: 'import',
                    next: 'import'
                },
                {
                    blankLine: 'always',
                    prev: '*',
                    next: 'export'
                },
                {
                    blankLine: 'any',
                    prev: 'export',
                    next: 'export'
                },
                {
                    blankLine: 'always',
                    prev: '*',
                    next: 'multiline-const'
                }
            ]
        }
    },
    {
        name: 'brigade/rules-tests',
        files: [
            'test/**/*.js'
        ],
        rules: {
            // The tests check ANSI escape sequences on purpose.
            'no-control-regex': 'off'
        }
    }
]);
