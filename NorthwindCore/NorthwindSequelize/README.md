Creating a new server using breeze-sequelize

Assumes that you've already created the database by following the steps in the [STEPS](../../STEPS.md) document.

## Install the packages 

1. Create directory NorthwindSequelize
2. `npm init` to create the `package.json` file
3. `npm install --save sequelize sequelize-auto sqlite3`
4. `npm install --save express breeze-client breeze-sequelize typescript`

## Export the Sequelize model of the database

```
node node_modules/bin/sequelize-auto -h localhost -d northwind
