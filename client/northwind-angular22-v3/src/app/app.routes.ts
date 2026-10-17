import { Routes } from '@angular/router';
import { CustomerComponent } from './customer/customer.component';
import { OrderComponent } from './order/order.component';
import { unsavedChangesGuard } from './unsaved-changes.guard';

export const routes: Routes = [
  {
    path: 'customers',
    component: CustomerComponent,
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'orders/:id',
    component: OrderComponent,
  },
  {
    path: '**',
    redirectTo: 'customers'
  }
];
