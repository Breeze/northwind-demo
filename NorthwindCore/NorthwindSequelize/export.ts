import { SequelizeManager } from "breeze-sequelize";
import { writeFileSync } from "fs";
import { SequelizeAuto } from "sequelize-auto";
import { config, namespace, options } from "./config";

const auto = new SequelizeAuto(config.dbName, config.user, config.password, options);

auto.run().then(data => {
  console.log(Object.keys(data.tables));  // list the exported tables

  // import models into Breeze, and export the resulting metadata
  const sequelizeManager = new SequelizeManager(config, options);
  sequelizeManager.importModels(options.directory, namespace);

  const metadata = sequelizeManager.metadataStore.exportMetadata();
  writeFileSync("metadata.json", metadata);
});
