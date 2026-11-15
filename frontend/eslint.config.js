import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'public/data', 'archive', 'plan_documentation'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['src/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['react', 'react-dom', 'maplibre-gl'],
          patterns: [
            {
              group: [
                '@/components/**',
                '@/compositions/**',
                '@/pages/**',
                '@/hooks/**',
                '@/services/**',
                '**/components/**',
                '**/compositions/**',
                '**/pages/**',
                '**/hooks/**',
                '**/services/**',
              ],
              message: 'Domain logic must remain independent of UI, hooks and services.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/services/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/components/**',
                '@/compositions/**',
                '@/pages/**',
                '@/hooks/**',
                '**/components/**',
                '**/compositions/**',
                '**/pages/**',
                '**/hooks/**',
              ],
              message: 'Services may depend on data and domain modules, not the UI.',
            },
          ],
        },
      ],
    },
  },
  {
    // Vendored shadcn/ui components export variant helpers next to components by design.
    files: ['src/components/ui/**'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
);
