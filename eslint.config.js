import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'reports/**', 'shots/**', 'public/**', 'test-results/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // src/core is pure and deterministic: no UI, no DOM, no wall clock, no Math.random.
    files: ['src/core/**/*.ts', 'src/content/**/*.ts', 'src/config/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-dom', 'react/*', 'react-dom/*'], message: 'src/core must not import UI libraries.' },
            { group: ['**/ui/**', '**/ui', '../ui/*', '../../ui/*'], message: 'src/core must not import src/ui.' },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded RNG streams in state.' },
        { object: 'Date', property: 'now', message: 'src/core must be deterministic.' },
        { object: 'performance', property: 'now', message: 'src/core must be deterministic.' },
      ],
      'no-restricted-globals': ['error', 'window', 'document', 'localStorage', 'navigator'],
    },
  },
);
