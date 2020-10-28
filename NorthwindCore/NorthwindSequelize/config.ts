import { DbConfig } from "breeze-sequelize/types/dbUtils";
import { join } from "path";
import { AutoOptions } from "sequelize-auto";

const storage = join(__dirname, "../northwind.sqlite");  // db file created earlier
const models = join(__dirname, "./models");  // subdirectory to store model files

export const config: DbConfig = {
  dbName: 'northwind',  // name of database created earlier
  user: '',             // user empty for sqlite
  password: '',         // password empty for sqlite
};

export const options: AutoOptions = {
  dialect: 'sqlite',  // sqlite | mysql | mssql | postgres
  storage: storage,   // storage is for sqlite only
  directory: models   // where to write the models
};

export const namespace = "NorthwindModel.Models";  // namespace for entity names
