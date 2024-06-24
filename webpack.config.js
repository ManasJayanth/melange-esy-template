const path = require("path");

module.exports = {
  // resolve: {
  //   modules: [
  //     "/Users/manas/development/prometheansacrifice/melange-esy-template/_build/default/src/output/node_modules",
  //     "/Users/manas/development/prometheansacrifice/melange-esy-template/node_modules",
  //   ],
  // },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "bundle.js",
  },
};
