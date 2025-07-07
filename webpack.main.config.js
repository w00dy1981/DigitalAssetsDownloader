const path = require('path');

module.exports = {
  target: 'electron-main',
  entry: {
    main: './src/main/main.ts',
    preload: './src/main/preload.ts',
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: path.resolve(__dirname, 'src/tsconfig.main.json'),
          },
        },
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@/main': path.resolve(__dirname, 'src/main'),
      '@/shared': path.resolve(__dirname, 'src/shared'),
      '@/services': path.resolve(__dirname, 'src/services'),
      '@/workers': path.resolve(__dirname, 'src/workers'),
    },
  },
  output: {
    path: path.resolve(__dirname, 'dist/main'),
    filename: '[name].js',
  },
  externals: {
    electron: 'commonjs electron',
    sharp: 'commonjs sharp',
  },
  node: {
    __dirname: false,
    __filename: false,
  },
};
