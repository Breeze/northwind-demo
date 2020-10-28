import e from "express";
import { Request, Response, NextFunction } from "express";
import * as  bodyParser from "body-parser";
import * as routes from "./routes";
const cors = require("cors");

const app: e.Application = e();

// Configure CORS and request parsing
app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json({limit: "50mb"}));

// Set up handler for Breeze save and query
app.post("/api/breeze/SaveChanges", routes.saveChanges);
app.get("/api/breeze/:slug", noCache, routes.query);

app.use(errorHandler);
app.listen(4000);
console.log("Listening on port 4000");

/** Tell browser not to cache query results */
function noCache(req: Request, res: Response, next: NextFunction): void {
  res.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.header("Expires", "-1");
  res.header("Pragma", "no-cache");
  next();
}

/** Log error and return message to client */
function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  console.error(err.stack);
  const status: number = err.statusCode || 500;
  if (err.message) {
    res.status(status).send(err.message);
  } else {
    res.status(status);
  }
}
