import {
  SequelizeManager, SequelizeQuery, SequelizeQueryResult, SequelizeSaveHandler, SequelizeSaveResult,
  urlToEntityQuery
} from "breeze-sequelize";
import { NextFunction, Request, Response } from "express";
import { config, namespace, options } from "./config";

const sequelizeManager = createSequelizeManager();

function createSequelizeManager() {
  (options as any).logging = console.log;  // log to console
  const sm = new SequelizeManager(config, options);
  sm.importModels(options.directory, namespace);
  return sm;
}

/** Handle GET: /api/breeze/Customer?{"where":{"Country":"Germany"}} */
export function query(req: Request, res: Response, next: NextFunction) {
  const resourceName = req.params.slug;  // e.g. Customer
  const entityQuery = urlToEntityQuery(req.url, resourceName);

  const sequelizeQuery = new SequelizeQuery(sequelizeManager, entityQuery);
  sequelizeQuery.execute().then(r => {
    returnResults(r, res);
  }).catch(e => {
    next(e);
  });
}

/** Handle POST: /api/breeze/SaveChanges */
export function saveChanges(req: Request, res: Response, next: NextFunction) {
  const saveHandler = new SequelizeSaveHandler(sequelizeManager, req);
  saveHandler.save().then(r => {
    returnResults(r, res);
  }).catch(e => {
    next(e);
  });
}

/** Send JSON result to client */
function returnResults(results: SequelizeQueryResult | SequelizeSaveResult, res: Response) {
  res.setHeader("Content-Type", "application/json");
  res.send(results);
}
