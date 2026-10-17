import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { configureBreeze } from 'breeze-client';
import { httpClientFetch } from 'breeze-client/adapter-angular-httpclient';

import { EntityManagerProvider } from '../entity-manager-provider';
import { CustomerComponent } from './customer.component';

// Breeze allows an entity constructor to be registered with only one MetadataStore,
// so every test shares a single EntityManagerProvider.  Each test still gets its own
// EntityManager, because newManager() returns an empty copy of the master.
let sharedProvider: EntityManagerProvider | undefined;
function getSharedProvider() {
  sharedProvider ??= new EntityManagerProvider();
  return sharedProvider;
}

describe('CustomerComponent', () => {
  let component: CustomerComponent;
  let fixture: ComponentFixture<CustomerComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomerComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: EntityManagerProvider, useFactory: getSharedProvider },
      ],
    }).compileComponents();

    // The Breeze adapters are normally registered by the app initializer in
    // app.config.ts, which does not run in a component test.  Registering the
    // ajax adapter points Breeze at this test's HttpTestingController backend.
    configureBreeze({ fetch: httpClientFetch(TestBed.inject(HttpClient)) })

    httpMock = TestBed.inject(HttpTestingController);

    fixture = TestBed.createComponent(CustomerComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();

    // Answer the query that ngOnInit issues.
    const req = httpMock.expectOne(r => r.url.startsWith('http://localhost:4000/api/breeze/Customers'));
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        $id: '1',
        $type: 'NorthwindModel.Models.Customer, NorthwindModel',
        Id: 1, FirstName: 'Maria', LastName: 'Cartman', City: 'Berlin', Country: 'Germany', Phone: '030-0074321'
      }
    ]);

    // The app is zoneless, so whenStable() does not track Breeze's own promise
    // chain; yield to the task queue to let the query promise settle.
    await new Promise(resolve => setTimeout(resolve, 0));
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load customers from the query', () => {
    expect(component.customers().length).toBe(1);
    expect(component.customers()[0].lastName).toBe('Cartman');
    expect(component.manager.hasChanges()).toBe(false);
  });

  it('should render a row per customer', () => {
    const rows = fixture.nativeElement.querySelectorAll('.customers tbody tr') as NodeListOf<HTMLElement>;
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Maria Cartman');
    expect(rows[0].textContent).toContain('Unchanged');
  });

  it('should edit the selected customer through the form', async () => {
    const row = fixture.nativeElement.querySelector('.customers tbody tr') as HTMLElement;
    row.click();
    fixture.detectChanges();

    // Selecting the customer queries its orders
    httpMock.expectOne(r => r.url.startsWith('http://localhost:4000/api/breeze/Orders')).flush([]);

    // ngModel writes the initial input value asynchronously
    await new Promise(resolve => setTimeout(resolve, 0));
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input[name="firstName"]') as HTMLInputElement;
    expect(input.value).toBe('Maria');

    input.value = 'Anna';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(component.customers()[0].firstName).toBe('Anna');
    expect(component.customers()[0].entityAspect.entityState.isModified()).toBe(true);
    expect(component.manager.hasChanges()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Save Changes');
  });

  it('should show the orders of the selected customer', async () => {
    const cust = component.customers()[0];
    component.select(cust);
    fixture.detectChanges();
    expect(component.ordersLoading()).toBe(true);

    const req = httpMock.expectOne(r => r.url.startsWith('http://localhost:4000/api/breeze/Orders'));
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        $id: '1',
        $type: 'NorthwindModel.Models.Order, NorthwindModel',
        Id: 10, CustomerId: 1, OrderNumber: '542378', OrderDate: '2012-07-04T00:00:00', TotalAmount: 440
      },
      {
        $id: '2',
        $type: 'NorthwindModel.Models.Order, NorthwindModel',
        Id: 11, CustomerId: 1, OrderNumber: '542379', OrderDate: '2012-07-05T00:00:00', TotalAmount: 1863.4
      }
    ]);
    await new Promise(resolve => setTimeout(resolve, 0));
    fixture.detectChanges();

    expect(component.ordersLoading()).toBe(false);
    expect(component.orders().map(o => o.orderNumber)).toEqual(['542378', '542379']);
    const rows = fixture.nativeElement.querySelectorAll('.orders tbody tr') as NodeListOf<HTMLElement>;
    expect(rows.length).toBe(2);
    expect(rows[1].textContent).toContain('542379');
    expect(rows[1].textContent).toContain('$1,863.40');
    expect(fixture.nativeElement.textContent).toContain('Orders for Maria Cartman');

    // Each order number links to the order page
    const link = rows[1].querySelector('a') as HTMLAnchorElement;
    expect(link.textContent).toBe('542379');
    expect(link.getAttribute('href')).toBe('/orders/11');

    // Selecting the customer again uses the orders already in the cache
    component.select(undefined);
    component.select(cust);
    httpMock.expectNone(r => r.url.startsWith('http://localhost:4000/api/breeze/Orders'));
    expect(component.orders().length).toBe(2);
  });

  it('should report unsaved changes to the navigation guard', () => {
    expect(component.hasUnsavedChanges()).toBe(false);
    component.addCustomer();
    expect(component.hasUnsavedChanges()).toBe(true);
  });

  it('should ask the browser to confirm a reload only when there are changes', () => {
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);

    component.addCustomer();
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });

  it('should add a customer', () => {
    component.addCustomer();
    fixture.detectChanges();

    expect(component.customers().length).toBe(2);
    expect(component.selected()).toBe(component.customers()[1]);
    expect(component.manager.hasChanges()).toBe(true);
    expect(fixture.nativeElement.querySelectorAll('.customers tbody tr').length).toBe(2);
  });

  it('should mark a customer deleted', () => {
    const cust = component.customers()[0];
    component.delete(cust);
    fixture.detectChanges();

    expect(cust.entityAspect.entityState.isDeleted()).toBe(true);
    expect(component.manager.hasChanges()).toBe(true);
  });

  it('should revert changes', () => {
    component.addCustomer();
    component.rejectChanges();
    fixture.detectChanges();

    expect(component.customers().length).toBe(1);
    expect(component.manager.hasChanges()).toBe(false);
  });

  it('should post the save bundle when saving changes', () => {
    component.addCustomer();
    component.selected()!.firstName = 'Test';
    component.selected()!.lastName = 'Person';

    component.saveChanges();

    const req = httpMock.expectOne('http://localhost:4000/api/breeze/SaveChanges');
    expect(req.request.method).toBe('POST');

    // Breeze sends the save bundle as a JSON string
    const body = typeof req.request.body === 'string' ? JSON.parse(req.request.body) : req.request.body;
    expect(body.entities.length).toBe(1);
    expect(body.entities[0].LastName).toBe('Person');
    expect(body.entities[0].entityAspect.entityState).toBe('Added');

    req.flush({ Entities: [], KeyMappings: [], DeletedKeys: [] });
  });
});
