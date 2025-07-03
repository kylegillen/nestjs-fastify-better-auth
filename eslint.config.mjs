import antfu from '@antfu/eslint-config'

export default antfu({
  type: 'lib',
  typescript: true,
  lessOpinionated: true,
  stylistic: {
    quotes: 'single',
    semi: false,
  },
  ignores: [
    'tsconfig.json',
  ],
}, {
  files: ['**/*.ts'],
  rules: {
    'no-useless-return': ['off'],
    'curly': ['off'],
    'ts/explicit-function-return-type': ['off'],
  },
})
