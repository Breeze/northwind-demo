const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('Supplier', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: true,
      primaryKey: true,
      field: 'Id'
    },
    companyName: {
      type: DataTypes.STRING(40),
      allowNull: false,
      unique: true,
      field: 'CompanyName'
    },
    contactName: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'ContactName'
    },
    contactTitle: {
      type: DataTypes.STRING(40),
      allowNull: true,
      field: 'ContactTitle'
    },
    city: {
      type: DataTypes.STRING(40),
      allowNull: true,
      field: 'City'
    },
    country: {
      type: DataTypes.STRING(40),
      allowNull: true,
      unique: true,
      field: 'Country'
    },
    phone: {
      type: DataTypes.STRING(30),
      allowNull: true,
      field: 'Phone'
    },
    fax: {
      type: DataTypes.STRING(30),
      allowNull: true,
      field: 'Fax'
    }
  }, {
    sequelize,
    tableName: 'Supplier',
    timestamps: false,
    indexes: [
      {
        name: "sqlite_autoindex_Supplier_1",
        unique: true,
        fields: [
          { name: "CompanyName" },
          { name: "Country" },
        ]
      },
    ]
  });
};
