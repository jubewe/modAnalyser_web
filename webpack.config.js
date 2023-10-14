const path = require("path");
const webpack = require("webpack");

module.exports = {
  entry: "./html/scripts/index.js",
  // mode: "production",
  mode: "development",
  output: {
    path: path.resolve(__dirname, "./html/scripts"),
    filename: "index.bundle.js",
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: "process/browser",
    }),
    new webpack.ProvidePlugin({
      Buffer: ["buffer", "Buffer"],
    }),
  ],
  resolve: {
    // fallback: {
    //   buffer: require.resolve("buffer/"),
    // },
  },
  watch: true
};
