const path = require("path");

const storage = path.join(__dirname, "../northwind.sqlite");
const models = path.join(__dirname, "./models");
const config = {
  dbName: 'northwind',
  user: '',
  pass: '',
  options: { dialect: 'sqlite', storage: storage },
  directory: models
};

module.exports = config;
