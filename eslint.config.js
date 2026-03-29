import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
    { ignores: ['dist', 'coverage'] },
    {
        ...react.configs.flat.recommended,
        files: ['**/*.{ts,tsx}'],
    },
    {
        ...react.configs.flat['jsx-runtime'],
        files: ['**/*.{ts,tsx}'],
    },
    {
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            ecmaVersion: 'latest',
            globals: globals.browser,
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
        },
        settings: {
            react: {
                version: 'detect',
            },
        },
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            'react-refresh/only-export-components': [
                'warn',
                { allowConstantExport: true },
            ],
            // TypeScript handles prop typing, so runtime prop-types checks are redundant.
            'react/prop-types': 'off',
            // These React Compiler-oriented rules are too strict for existing patterns in this codebase.
            'react-hooks/set-state-in-effect': 'off',
            'react-hooks/static-components': 'off',
            'react-hooks/purity': 'off',
            'react-hooks/preserve-manual-memoization': 'off',
            'react/no-unescaped-entities': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_',
            }],
            'prefer-const': 'warn',
        },
    },
    {
        // Relax rules that don't apply inside test / utility files
        files: ['**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}', 'src/lib/*-{generator,seed-data}.ts'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
        },
    },
    {
        // shadcn/ui files intentionally co-export component factories and helpers.
        files: ['src/components/ui/**/*.{ts,tsx}'],
        rules: {
            'react-refresh/only-export-components': 'off',
        },
    },
)
