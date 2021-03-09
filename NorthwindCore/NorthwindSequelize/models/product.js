const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('Product', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: true,
      primaryKey: true,
      field: 'Id'
    },
    productName: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      field: 'ProductName'
    },
    supplierId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Supplier',
        key: 'Id'
      },
      field: 'SupplierId'
    },
    unitPrice: {
      type: DataTypes.DECIMAL(12,2),
      allowNull: true,
      defaultValue: 0,
      field: 'UnitPrice'
    },
    package: {
      type: DataTypes.STRING(30),
      allowNull: true,
      field: 'Package'
    },
    isDiscontinued: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'IsDiscontinued'
    }
  }, {
    sequelize,
    tableName: 'Product',
    timestamps: false,
    indexes: [
      {
        name: "sqlite_autoindex_Product_1",
        unique: true,
        fields: [
          { name: "ProductName" },
        ]
      },
    ]
  });
};
