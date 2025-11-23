import antfu from '@antfu/eslint-config'

export default antfu({
  type: 'lib',
  lessOpinionated: true,
  isInEditor: false,
  unicorn: {
    allRecommended: true,
  },
  typescript: {
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
      project: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
  ignores: [
    'tsconfig.json',
    'tsconfig.build.json',
    '.vscode/',
    '**/*.md',
    'vitest.config.ts',
  ],
  stylistic: {
    semi: false,
    quotes: 'single',
    endOfLine: 'auto',
  },
  rules: {
    'no-console': 'warn',
    'unicorn/prefer-top-level-await': 'off',
    'unicorn/no-lonely-if': 'off',
    'unicorn/no-array-callback-reference': 'off',
    'unicorn/no-null': 'off',
    'unicorn/prefer-module': 'off',
    'unicorn/prevent-abbreviations': [
      'error',
      {
        checkFilenames: false,
      },
    ],
    'test/prefer-lowercase-title': 'off',
    'style/jsx-self-closing-comp': 'error',
    'style/indent': ['error', 2],
    'curly': 'off',
    'perfectionist/sort-imports': [
      'error',
      {
        type: 'natural',
        internalPattern: ['^@/.+'],
        groups: [
          [
            'react',
          ],
          'type-builtin',
          'value-builtin',
          'type-external',
          'value-external',
          'type-internal',
          'value-internal',
          [
            'type-parent',
            'type-sibling',
            'type-index',
          ],
          [
            'value-parent',
            'value-sibling',
            'value-index',
          ],
          'unknown',
        ],
        customGroups: [
          {
            groupName: 'react',
            elementNamePattern: ['^react$', '^react-.+'],
          },
        ],
      },
    ],
  },
})
