const path = require("path");
const GasPlugin = require("gas-webpack-plugin");

const mode = "development";
const entry = path.resolve("src", "main.ts");
const devtool = "inline-source-map";
const outPath = path.resolve("build");
const outFileName = "main.js";
const output = {
  path: outPath,
  filename: outFileName,
  chunkFormat: 'commonjs'
};
const rules = [
  {
    test: /\.[tj]s$/,
    use: {
      loader: "babel-loader",
    },
  },
];
const resolve = { extensions: [".ts", ".js"] };
const plugins = [new GasPlugin()];
const target = "es5"

module.exports = [
  {
    mode,
    devtool,
    entry,
    output,
    module: { rules },
    resolve,
    plugins,
    target
  },
];
