const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('Order', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: true,
      primaryKey: true,
      field: 'Id'
    },
    orderDate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      unique: true,
      field: 'OrderDate'
    },
    orderNumber: {
      type: DataTypes.STRING(10),
      allowNull: true,
      unique: true,
      field: 'OrderNumber'
    },
    customerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Customer',
        key: 'Id'
      },
      unique: true,
      field: 'CustomerId'
    },
    totalAmount: {
      type: DataTypes.DECIMAL(12,2),
      allowNull: true,
      defaultValue: 0,
      field: 'TotalAmount'
    }
  }, {
    sequelize,
    tableName: 'Order',
    timestamps: false,
    indexes: [
      {
        name: "sqlite_autoindex_Order_1",
        unique: true,
        fields: [
          { name: "CustomerId" },
          { name: "OrderDate" },
          { name: "OrderNumber" },
        ]
      },
      {
        name: "sqlite_autoindex_Order_2",
        unique: true,
        fields: [
          { name: "OrderNumber" },
        ]
      },
    ]
  });
};
