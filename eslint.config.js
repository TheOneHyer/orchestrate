import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactCompiler from 'eslint-plugin-react-compiler'

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
        ...jsxA11y.flatConfigs.recommended,
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
            'react-compiler': reactCompiler,
        },
        rules: {
            'react-compiler/react-compiler': 'warn',
            ...reactHooks.configs.recommended.rules,
            'react-refresh/only-export-components': [
                'warn',
                { allowConstantExport: true },
            ],
            // TypeScript handles prop typing, so runtime prop-types checks are redundant.
            'react/prop-types': 'off',
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
        // These files must not be modified manually (only via the shadcn CLI), so
        // rules that would require manual edits are suppressed here instead.
        files: ['src/components/ui/**/*.{ts,tsx}'],
        rules: {
            'react-refresh/only-export-components': 'off',
            // shadcn/ui uses Math.random() in useMemo for skeleton width; this is
            // intentional upstream behaviour we cannot change without forking.
            'react-hooks/purity': 'off',
            // shadcn/ui PaginationLink spreads children via props onto a self-closing
            // <a> element; axe-core validates runtime output not static JSX.
            'jsx-a11y/anchor-has-content': 'off',
        },
    },
    {
        // Sidebar constants are part of upstream shadcn template internals.
        // Keep this scoped to sidebar.tsx to avoid broad no-unused-vars suppression.
        files: ['src/components/ui/sidebar.tsx'],
        rules: {
            '@typescript-eslint/no-unused-vars': 'off',
        },
    },
)
