const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('OrderItem', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: true,
      primaryKey: true,
      field: 'Id'
    },
    orderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Order',
        key: 'Id'
      },
      unique: true,
      field: 'OrderId'
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Product',
        key: 'Id'
      },
      unique: true,
      field: 'ProductId'
    },
    unitPrice: {
      type: DataTypes.DECIMAL(12,2),
      allowNull: false,
      defaultValue: 0,
      field: 'UnitPrice'
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      field: 'Quantity'
    }
  }, {
    sequelize,
    tableName: 'OrderItem',
    timestamps: false,
    indexes: [
      {
        name: "sqlite_autoindex_OrderItem_1",
        unique: true,
        fields: [
          { name: "OrderId" },
          { name: "ProductId" },
        ]
      },
    ]
  });
};
