import antfu from '@antfu/eslint-config'

export default antfu({
  type: 'lib',
  typescript: true,
  lessOpinionated: true,
  isInEditor: true,
  stylistic: {
    quotes: 'single',
    semi: false,
    indent: 2,
  },
  ignores: [
    'tsconfig.json',
    'README.md',
    './src/index.ts',
  ],
}, {
  files: ['**/*.ts'],
  rules: {
    'no-useless-return': ['off'],
    'curly': ['off'],
    'ts/explicit-function-return-type': ['off'],
  },
})
