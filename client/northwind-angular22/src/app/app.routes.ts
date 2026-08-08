import { Routes } from '@angular/router';
import { CustomerComponent } from './customer/customer.component';

export const routes: Routes = [
  {
    path: 'customers',
    component: CustomerComponent,
  },
  {
    path: '**',
    redirectTo: 'customers'
  }
];
