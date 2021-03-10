# Node.js Breeze Server

This is a sample server using [Breeze](https://www.getbreezenow.com/) and [Sequelize](https://sequelize.org/master/).

See the [STEPS-Server-Node](../STEPS-Server-Node.md) document for step-by-step instructions on how to create this sample.

## Prerequisites

Make sure you have [nodejs](https://nodejs.org) and [npm](https://docs.npmjs.com/) installed.

Create your Northwind database using the scripts from the [dbscripts](../dbscripts) directory.

> If you don't have a database preference, we recommend **SQLite** for this project because it requires no installation except for the `sqlite3` package.

## Running the Server

1. `npm install`
2. `npm run tsc`
3. `node export`
4. `node server`

You should see some messages from Breeze about loading the entity types, and then the message "Listening on port 4000".

Now open a browser and go to [http://localhost:4000/api/breeze/Customer?{"where":{"Country":"Germany"}}](http://localhost:4000/api/breeze/Customer?{%22where%22:{%22Country%22:%22Germany%22}}).  You should see data returned from the database:
```
[
  {
    "Id": 1,
    "FirstName": "Maria",
    "LastName": "Anders",
    "City": "Berlin",
    "Country": "Germany",
    "Phone": "030-0074321",
    "$type": "Customer:#NorthwindModel.Models"
  },
  {
    "Id": 6,
    "FirstName": "Hanna",
    "LastName": "Moos",
    "City": "Mannheim",
    "Country": "Germany",
    "Phone": "0621-08460",
    "$type": "Customer:#NorthwindModel.Models"
  },
  ...
  ```

## Next Steps

See the [STEPS-Server-Node](../STEPS-Server-Node.md) document for more information about this sample.

See the [STEPS](../STEPS.md) document for information about how to create a client application.
