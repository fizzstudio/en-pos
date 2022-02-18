import pkg from './package.json';
import resolve from '@rollup/plugin-node-resolve';
import eslint from '@rollup/plugin-eslint'; 

export default [
  {
    input: 'dist/index.js',
    output: {
      format: 'es',
      name: pkg.name,
      file: pkg.module,
    },
    plugins: [
      resolve(), // so Rollup can find external modules
      eslint({ 
        exclude: ['./node_modules/**', './src/style/**'], 
        fix: true,
      }),
    ],
  },
];
