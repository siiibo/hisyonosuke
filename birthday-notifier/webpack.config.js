const path = require("path");
const GasPlugin = require("gas-webpack-plugin");

const mode = "development";
const devtool = "inline-source-map";
const entry = {
  init: path.resolve("src", "init.ts"),
  handler: path.resolve("src", "handler.ts"),
  notificator: path.resolve("src", "notificator.ts"),
};
const outPath = path.resolve("build");
const outFileName = "[name].js";
const output = {
  path: outPath,
  filename: outFileName,
};
const rules = [
  {
    test: /\.[tj]s$/,
    use: {
      loader: "ts-loader",
      options: {
        allowTsInNodeModules: true,
        transpileOnly: true,
        configFile: path.resolve("tsconfig.json"),
      },
    },
  },
];
const resolve = {
  extensions: [".ts", ".js", ".json"],
  fallback: {
    path: false,
    os: false
  },
};
const plugins = [new GasPlugin()];

module.exports = [
  {
    mode,
    entry,
    devtool,
    output,
    module: { rules },
    resolve,
    plugins,
  },
];
