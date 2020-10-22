const SequelizeAuto = require('sequelize-auto');
const BreezeSequelize = require('breeze-sequelize');
const fs = require("fs");
const config = require("./config");

var auto = new SequelizeAuto(config.dbName, config.user, config.pass, config.options);

auto.run().then(data => {
  const tableNames = Object.keys(data.tables);
  console.log(tableNames);      // table list

  const sequelizeManager = new BreezeSequelize.SequelizeManager(config, config.options);
  sequelizeManager.importModels(config.directory, config.dbName);
  const metadata = sequelizeManager.metadataStore.exportMetadata();

  fs.writeFileSync("metadata.json", metadata);
  console.log("Wrote", "metadata.json");
});
