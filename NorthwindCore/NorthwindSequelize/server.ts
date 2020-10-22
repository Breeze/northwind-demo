import e from "express";
import { Request, Response, NextFunction } from "express";
import * as  bodyParser from "body-parser";
import * as routes from "./routes";

const app: e.Application = e();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json({limit: "50mb"}));

app.post("/api/breeze/SaveChanges", routes.saveChanges);

app.get("/api/breeze/:slug", noCache, routes.get);

app.use(logErrors);
app.use(errorHandler);

app.listen(3000);
console.log("Listening on port 3000");

function noCache(req: Request, res: Response, next: NextFunction): void {
  res.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.header("Expires", "-1");
  res.header("Pragma", "no-cache");
  next();
}

function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  const status: number = err.statusCode || 500;
  if (err.message) {
    res.status(status).send(err.message);
  } else {
    res.status(status);
  }
}

function logErrors(err: any, req: Request, res: Response, next: NextFunction): void {
  console.error(err.stack);
  next(err);
}
