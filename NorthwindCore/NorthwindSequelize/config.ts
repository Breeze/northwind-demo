import { DbConfig } from "breeze-sequelize/types/dbUtils";
import { join } from "path";
import { AutoOptions } from "sequelize-auto";

const storage = join(__dirname, "../northwind.sqlite");  // db file created earlier
const models = join(__dirname, "./models");  // subdirectory to store model files

export const config: DbConfig = {
  dbName: 'Northwind',  // name of database created earlier
  user: '',             // user empty for sqlite
  password: '',         // password empty for sqlite
};

export const options: AutoOptions = {
  caseFile: "l",    // lower_case file names
  caseModel: "p",   // PascalCase model names
  caseProp: "c",    // camelCase property names
  dialect: 'sqlite',  // sqlite | mysql | mssql | postgres
  storage: storage,   // storage is for sqlite only
  directory: models,   // where to write the models
  // host: 'localhost',
  // port: 1433          // mssql:1433, mysql: 3306, postgres: 5432
};

export const namespace = "NorthwindModel.Models";  // namespace for entity names
