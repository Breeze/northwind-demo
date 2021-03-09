const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('Customer', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: true,
      primaryKey: true,
      field: 'Id'
    },
    firstName: {
      type: DataTypes.STRING(40),
      allowNull: false,
      unique: true,
      field: 'FirstName'
    },
    lastName: {
      type: DataTypes.STRING(40),
      allowNull: false,
      unique: true,
      field: 'LastName'
    },
    city: {
      type: DataTypes.STRING(40),
      allowNull: true,
      field: 'City'
    },
    country: {
      type: DataTypes.STRING(40),
      allowNull: true,
      field: 'Country'
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'Phone'
    }
  }, {
    sequelize,
    tableName: 'Customer',
    timestamps: false,
    indexes: [
      {
        name: "sqlite_autoindex_Customer_1",
        unique: true,
        fields: [
          { name: "LastName" },
          { name: "FirstName" },
        ]
      },
    ]
  });
};
