var DataTypes = require("sequelize").DataTypes;
var _Customer = require("./customer");
var _Order = require("./order");
var _OrderItem = require("./order_item");
var _Product = require("./product");
var _Supplier = require("./supplier");

function initModels(sequelize) {
  var Customer = _Customer(sequelize, DataTypes);
  var Order = _Order(sequelize, DataTypes);
  var OrderItem = _OrderItem(sequelize, DataTypes);
  var Product = _Product(sequelize, DataTypes);
  var Supplier = _Supplier(sequelize, DataTypes);

  Order.belongsTo(Customer, { as: "customer", foreignKey: "customerId"});
  Customer.hasMany(Order, { as: "orders", foreignKey: "customerId"});
  OrderItem.belongsTo(Order, { as: "order", foreignKey: "orderId"});
  Order.hasMany(OrderItem, { as: "orderItems", foreignKey: "orderId"});
  OrderItem.belongsTo(Product, { as: "product", foreignKey: "productId"});
  Product.hasMany(OrderItem, { as: "orderItems", foreignKey: "productId"});
  Product.belongsTo(Supplier, { as: "supplier", foreignKey: "supplierId"});
  Supplier.hasMany(Product, { as: "products", foreignKey: "supplierId"});

  return {
    Customer,
    Order,
    OrderItem,
    Product,
    Supplier,
  };
}
module.exports = initModels;
module.exports.initModels = initModels;
module.exports.default = initModels;
