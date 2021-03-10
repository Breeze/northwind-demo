<template>
<div>
  <p>customer works!</p>
  <table>
    <tr v-for="cust in customers" :key="cust.id" @click="select(cust)" 
      v-bind:style="{'background-color': selected === cust ? 'lightgray':'white'}">
      <td>{{cust.firstName}} {{cust.lastName}}</td>
      <td>{{cust.entityAspect.entityState}}</td>
    </tr>
  </table>
  <button type="button" @click="addCustomer()">Add</button>

  <div v-if="!!selected">
    <h3>Edit</h3>
    <div>Id: <input type="text" name="id" v-model="selected.id"></div>
    <div>First Name: <input type="text" name="firstName" v-model="selected.firstName"></div>
    <div>Last Name: <input type="text" name="lastName" v-model="selected.lastName"></div>
    <div>City: <input type="text" name="city" v-model="selected.city"></div>
    <div>Country: <input type="text" name="country" v-model="selected.country"></div>
    <div>Phone: <input type="text" name="phone" v-model="selected.phone"></div>
    <button type="button" @click="remove(selected)">Delete</button>

  <table>
    <tr v-for="order in selected.orders" :key="order.id">
      <td>{{order.orderNumber}}</td>
      <td>{{order.totalAmount}}</td>
      <td>{{order.orderDate }}</td>
      <td><button type="button" @click="remove(order)">Delete</button></td>
    </tr>
  </table>

  </div>

  <div v-if="manager.hasChanges()">
    <hr>
    <button type="button" @click="saveChanges()">Save Changes</button>
    <button type="button" @click="rejectChanges()">Revert Changes</button>
  </div>
</div>
</template>

<script src="./Customers.ts" />
<style scoped>
table {
  margin-left: auto;
  margin-right: auto;
}
</style>
