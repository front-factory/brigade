import config from '@front-factory/eslint-config';

export default [
    ...config,
    {
        ignores: [
            'node_modules/**',
            'coverage/**'
        ]
    }
];
