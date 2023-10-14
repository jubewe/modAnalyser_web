const express = require("express");
const config = require("../config.json");
const { mainPath } = require("oberknecht-utils");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");
const { log } = require("console");
const env = require("dotenv").config().parsed;

let csvFilePath;

fs.readdirSync(mainPath("./input"), { withFileTypes: true }).forEach((a) => {
  if (!a.isFile() || !a.name.endsWith(".csv")) return;
  csvFilePath = mainPath(path.resolve("./input", a.name));
});

log(0, `Using CSV file`, csvFilePath);

class j {
  static config = config;

  static env = env;
  static express = express();
  static expressStatic = express.static(mainPath("./html"));
  static wsServer = new WebSocketServer({
    port: config.wsServer.port,
  });
  static csvFilePath = csvFilePath;
}

module.exports = j;
