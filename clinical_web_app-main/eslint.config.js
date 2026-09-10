import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { react: { version: 'detect' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react/jsx-no-target-blank': 'off',
      // This codebase is plain JS and does not use runtime prop validation.
      // Type safety is tracked as a separate TypeScript-migration task.
      'react/prop-types': 'off',
      // React 19 automatic JSX runtime — a bare `import React` is dead code.
      // Downgraded to warn: ~60 pre-existing hits (unused catch bindings,
      // dead destructured props). Burn down incrementally, then restore to error.
      'no-unused-vars': ['warn', { varsIgnorePattern: '^React$' }],
      'no-empty': 'warn',
      'react/no-unescaped-entities': 'warn',
      'react/display-name': 'warn',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
]
