var tsGen = require('breeze-entity-generator/tsgen-core');
var fs = require('fs');
var dir = './src/app/model';

if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
}

tsGen.generate({
  inputFileName: '../NorthwindSequelize/metadata.json',
  outputFolder: dir,
  camelCase: true,
  baseClassName: 'BaseEntity',
  kebabCaseFileNames: true,
  codePrefix: 'Northwind'
});
