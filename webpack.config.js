const { resolve } = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const CSSMinimizerPlugin = require("css-minimizer-webpack-plugin");

const path = require('path');

module.exports = {
  target: "node",
  entry: "./src/index.tsx",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "main.js",
    library: {
      type: "commonjs2",
      name: "OpenConcord"
    },
    devtoolModuleFilenameTemplate: "../src/[resource-path]",
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@services": path.resolve(__dirname, "./src/services"),
      "@utils": path.resolve(__dirname, "./src/utils"),
      "@types": path.resolve(__dirname, "./src/types"),
      "@hooks": path.resolve(__dirname, "./src/hooks"),
    },
    fallback: {
      "stream": require.resolve("stream-browserify"),
      "buffer": require.resolve("buffer"),
      "path": require.resolve("path-browserify"),
      "fs": require.resolve("fs-extra"),
      "child_process": require.resolve("child_process"),
      "crypto": require.resolve("crypto-browserify"),
      "net": require.resolve("net-browserify"),
      "os": require.resolve("os-browserify"),
      "util": require.resolve("util"),
      "tls": require.resolve("tls"),
      "url": require.resolve("url"),
      "http": require.resolve("http-browserify"),
      "https": require.resolve("https-browserify"),
      "zlib": require.resolve("browserify-zlib"),
    },
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
            options: {
              configFile: path.resolve(__dirname, "./tsconfig.json"),
            },
          },
        ],
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: "src/public",
          to: "public",
        },
        {
          from: "resources/*",
          to: "resources/[name][ext]",
        },
      ],
    }),
  ],
  experiments: {
    topLevelAwait: true,
  },
  optimization: {
    minimize: true,
    minimizer: [
      new CSSMinimizerPlugin({
        parallel: true,
        preset: [
          "default",
          {
            sourceMap: true,
            svgo: { plugins: ["removeViewBox", "cleanupIds", "cleanupOverlaps", "removeDimensions"] },
          },
        ],
      }),
    ],
  },
};
