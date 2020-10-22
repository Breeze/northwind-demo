import { breeze, EntityQuery } from "breeze-client";
import { SequelizeManager, SequelizeQuery, SequelizeQueryResult, SequelizeSaveHandler, SequelizeSaveResult,
  urlToEntityQuery } from "breeze-sequelize";
import { NextFunction, Request, Response } from "express";
const config = require("./config");

const _sequelizeManager = createSequelizeManager();

function createSequelizeManager() {
  const sm = new SequelizeManager(config, config.options);
  sm.importModels(config.directory, config.dbName);
  return sm;
}

export function get(req: Request, res: Response, next: NextFunction) {
  const resourceName = req.params.slug;
  const entityQuery = urlToEntityQuery(req.url, resourceName);
  executeEntityQuery(entityQuery, res, next);
}

export function saveChanges(req: Request, res: Response, next: NextFunction) {
  const saveHandler = new SequelizeSaveHandler(_sequelizeManager, req);
  saveHandler.save().then(r => {
    returnResults(r, res);
  }).catch(function (e) {
    next(e);
  });
}

function executeEntityQuery(entityQuery: EntityQuery, res: Response, next: NextFunction) {
  const query = new SequelizeQuery(_sequelizeManager, entityQuery);
  query.execute().then(r => {
    returnResults(r, res);
  }).catch(function (e) {
    next(e);
  });
}

// used to return values to the client
function returnResults(results: SequelizeQueryResult | SequelizeSaveResult, res: Response) {
  res.setHeader("Content-Type", "application/json");
  res.send(results);
}
