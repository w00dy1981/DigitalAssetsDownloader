const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
const packageJson = require('./package.json');

module.exports = {
  target: 'electron-renderer',
  entry: './src/renderer/index.tsx',
  externals: {
    // Only exclude modules that should truly be external in renderer
    // Node.js built-ins should not be external - let webpack handle them or use browser alternatives
    'electron': 'commonjs electron',
    'sharp': 'commonjs sharp',
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: path.resolve(__dirname, 'src/tsconfig.renderer.json'),
          },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|jpe?g|gif|svg)$/i,
        type: 'asset/resource',
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@/renderer': path.resolve(__dirname, 'src/renderer'),
      '@/shared': path.resolve(__dirname, 'src/shared'),
      '@/services': path.resolve(__dirname, 'src/services'),
    },
  },
  output: {
    path: path.resolve(__dirname, 'dist/renderer'),
    filename: 'renderer.js',
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/renderer/index.html',
    }),
    new webpack.DefinePlugin({
      'process.env.APP_VERSION': JSON.stringify(packageJson.version),
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
    }),
  ],
  devServer: {
    contentBase: path.join(__dirname, 'dist/renderer'),
    port: 3000,
    hot: true,
  },
};
