# Northwind Database Scripts

This directory contains scripts to create the "Northwind" database, which a subset of the 
classic Microsoft sample db.  The scripts for creating it were copied
from the SQL tutorial site [dofactory](https://www.dofactory.com/sql/sample-database)
and adapted for different database dialects.

The scripts assume one of:

 - MS SQL Server / SQL Express
 - Mysql
 - Postgres
 - SQLite
 
 There is a pair of scripts for each of the above dialects (mssql | mysql | postgres | sqlite).  If you are using a different database server, you will need to adapt the scripts accordingly.

## Steps

1. Copy contents of the `dbscripts` folder from the sample repo into your own `dbscripts` folder.

2. Use the administration tool for your DBMS to create the database.
  
    - **mssql**: SQL Server Management Studio
    - **mysql**: MySQL Workbench
    - **postgres**: pgAdmin
    - **sqlite**: sqlite3 CLI _or see next section_

3. Open and run the script to create the tables, `dbscripts\{dialect}-sample-model.sql`.

4. Open and run the script to insert the data, `dbscripts\{dialect}-sample-data.sql`

## Sqlite using nodejs

For Sqlite, there is a nodejs script included to create a local database.  This assumes that you already have **nodejs** and **npm** installed.

In this `dbscripts` directory, run the following:
```
npm install sqlite3
node sqlite-import
```
This will create a database file, `northwind.sqlite`, in the parent directory. 
