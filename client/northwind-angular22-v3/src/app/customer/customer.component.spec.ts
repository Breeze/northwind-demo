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

const customersUrl = 'http://localhost:4000/api/breeze/Customers';

// A customer as the server sends it
function serverCustomer(id: number, firstName: string, lastName: string) {
  return {
    $id: String(id),
    $type: 'NorthwindModel.Models.Customer, NorthwindModel',
    Id: id, FirstName: firstName, LastName: lastName, City: 'Berlin', Country: 'Germany', Phone: '030-0074321'
  };
}

// The app is zoneless, so whenStable() does not track Breeze's own promise
// chain; yield to the task queue to let a query promise settle.
function settle() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

describe('CustomerComponent', () => {
  let component: CustomerComponent;
  let fixture: ComponentFixture<CustomerComponent>;
  let httpMock: HttpTestingController;

  // Answer the pending query for a page of customers, and return its decoded URL.
  // With inlineCount, the server wraps the page in a QueryResult with the total count.
  async function answerCustomersQuery(results: object[], inlineCount: number) {
    const req = httpMock.expectOne(r => r.url.startsWith(customersUrl));
    expect(req.request.method).toBe('GET');
    req.flush({ Results: results, InlineCount: inlineCount });
    await settle();
    fixture.detectChanges();
    return decodeURIComponent(req.request.urlWithParams);
  }

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

    // Answer the query for the first page, which the table requests when it first displays
    await answerCustomersQuery([serverCustomer(1, 'Maria', 'Cartman')], 1);
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

  it('should add a customer at the top of the page', () => {
    component.addCustomer();
    fixture.detectChanges();

    expect(component.customers().length).toBe(2);
    expect(component.selected()).toBe(component.customers()[0]);
    expect(component.customers()[0].entityAspect.entityState.isAdded()).toBe(true);
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

  it('should revert changes without querying the server', () => {
    component.addCustomer();
    component.rejectChanges();
    fixture.detectChanges();

    expect(component.customers().length).toBe(1);
    expect(component.selected()).toBeUndefined();  // the new customer is gone, so it can't stay selected
    expect(component.manager.hasChanges()).toBe(false);
    httpMock.expectNone(r => r.url.startsWith(customersUrl));
  });

  it('should post the save bundle when saving changes, then re-query the page', async () => {
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
    await settle();

    // The saved customer now belongs wherever the sort order puts it, so the page is queried again
    await answerCustomersQuery([serverCustomer(1, 'Maria', 'Cartman')], 1);
  });

  describe('paging', () => {
    // 25 customers on the server; returns the ones on a page
    function serverPage(first: number, rows: number) {
      return Array.from({ length: Math.min(rows, 25 - first) },
        (_, i) => serverCustomer(first + i + 1, 'First' + (first + i + 1), 'Last' + (first + i + 1)));
    }

    function rowCount() {
      return fixture.nativeElement.querySelectorAll('.customers tbody tr').length;
    }

    beforeEach(async () => {
      // Start over with a first page of 10 out of 25 customers
      component.loadPage({ first: 0, rows: 10 });
      await answerCustomersQuery(serverPage(0, 10), 25);
    });

    it('should query a page in a stable order, with the total count', () => {
      component.loadPage({ first: 10, rows: 10 });
      const req = httpMock.expectOne(r => r.url.startsWith(customersUrl));
      const url = decodeURIComponent(req.request.urlWithParams);
      expect(url).toContain('"orderBy":["LastName","FirstName","Id"]');
      expect(url).toContain('"skip":10');
      expect(url).toContain('"take":10');
      expect(url).toContain('"inlineCount":true');
      req.flush({ Results: [], InlineCount: 25 });
    });

    it('should show the page and the total in the paginator', () => {
      expect(rowCount()).toBe(10);
      expect(component.totalRecords()).toBe(25);
      expect(fixture.nativeElement.textContent).toContain('1 to 10 of 25');
    });

    it('should query the next page when the paginator\'s next button is clicked', async () => {
      const next = fixture.nativeElement.querySelector('.p-paginator-next') as HTMLButtonElement;
      next.click();
      fixture.detectChanges();

      const url = await answerCustomersQuery(serverPage(10, 10), 25);
      expect(url).toContain('"skip":10');
      expect(component.customers()[0].lastName).toBe('Last11');
      expect(fixture.nativeElement.textContent).toContain('11 to 20 of 25');
    });

    it('should keep new customers at the top of every page until they are saved', async () => {
      component.addCustomer();
      component.loadPage({ first: 10, rows: 10 });
      await answerCustomersQuery(serverPage(10, 10), 25);

      expect(component.customers().length).toBe(11);
      expect(component.customers()[0].entityAspect.entityState.isAdded()).toBe(true);
      expect(component.customers()[1].lastName).toBe('Last11');
    });

    it('should keep unsaved edits when returning to a page', async () => {
      const cust = component.customers()[0];
      cust.firstName = 'Edited';

      component.loadPage({ first: 10, rows: 10 });
      await answerCustomersQuery(serverPage(10, 10), 25);
      component.loadPage({ first: 0, rows: 10 });
      await answerCustomersQuery(serverPage(0, 10), 25);

      // The query returned the original name, but Breeze kept the cached, modified entity
      expect(component.customers()[0]).toBe(cust);
      expect(cust.firstName).toBe('Edited');
      expect(cust.entityAspect.entityState.isModified()).toBe(true);
    });

    it('should show the last page when the requested page is past the end', async () => {
      // e.g. after the customers on the last page have been deleted
      component.loadPage({ first: 20, rows: 10 });
      await answerCustomersQuery([], 15);

      const url = await answerCustomersQuery(serverPage(10, 5), 15);
      expect(url).toContain('"skip":10');
      expect(component.first()).toBe(10);
      expect(rowCount()).toBe(5);
    });

    it('should ignore a page that arrives after a newer one was requested', async () => {
      component.loadPage({ first: 10, rows: 10 });
      component.loadPage({ first: 20, rows: 10 });
      const [older, newer] = httpMock.match(r => r.url.startsWith(customersUrl));

      newer.flush({ Results: serverPage(20, 10), InlineCount: 25 });
      older.flush({ Results: serverPage(10, 10), InlineCount: 25 });
      await settle();
      fixture.detectChanges();

      expect(component.customers()[0].lastName).toBe('Last21');
      expect(component.customersLoading()).toBe(false);
    });
  });

  describe('sorting and searching', () => {
    function header(label: string) {
      return [...fixture.nativeElement.querySelectorAll('.customers th')]
        .find((th: HTMLElement) => th.textContent?.trim() === label) as HTMLElement;
    }

    // The table waits filterDelay (300 ms) after the last keystroke before it asks for data
    async function search(text: string) {
      const input = fixture.nativeElement.querySelector('input[name="search"]') as HTMLInputElement;
      input.value = text;
      input.dispatchEvent(new Event('input'));
      await new Promise(resolve => setTimeout(resolve, 350));
    }

    it('should sort by name by default, and show it in the header', () => {
      expect(component.sortField()).toBe('lastName');
      expect(component.sortOrder()).toBe(1);
      expect(header('Name').getAttribute('aria-sort')).toBe('ascending');
    });

    it('should sort by a column when its header is clicked, then by name', async () => {
      header('City').click();
      fixture.detectChanges();

      const url = await answerCustomersQuery([serverCustomer(1, 'Maria', 'Cartman')], 1);
      expect(url).toContain('"orderBy":["City","LastName","FirstName","Id"]');
      expect(url).toContain('"skip":0');
      expect(header('City').getAttribute('aria-sort')).toBe('ascending');
    });

    it('should reverse the sort when the header is clicked again', async () => {
      header('Name').click();
      fixture.detectChanges();

      const url = await answerCustomersQuery([serverCustomer(1, 'Maria', 'Cartman')], 1);
      expect(url).toContain('"orderBy":["LastName desc","FirstName desc","Id desc"]');
      expect(component.sortOrder()).toBe(-1);
    });

    it('should search the name, city and country', async () => {
      await search('berlin');

      const url = await answerCustomersQuery([serverCustomer(1, 'Maria', 'Cartman')], 1);
      expect(url).toContain('"where":{"or":[{"FirstName":{"contains":"berlin"}},{"LastName":{"contains":"berlin"}},'
        + '{"City":{"contains":"berlin"}},{"Country":{"contains":"berlin"}}]}');
      expect(url).toContain('"skip":0');
      expect(component.searchText()).toBe('berlin');
    });

    it('should require every word of the search to match', async () => {
      await search('  maria   berlin ');

      const url = await answerCustomersQuery([serverCustomer(1, 'Maria', 'Cartman')], 1);
      expect(url).toContain('"where":{"and":[{"or":[{"FirstName":{"contains":"maria"}}');
      expect(url).toContain('{"or":[{"FirstName":{"contains":"berlin"}}');
    });

    it('should go back to the first page when searching', async () => {
      component.loadPage({ first: 10, rows: 10 });
      await answerCustomersQuery([serverCustomer(11, 'Hanna', 'Moos')], 25);
      expect(component.first()).toBe(10);

      await search('berlin');
      const url = await answerCustomersQuery([serverCustomer(1, 'Maria', 'Cartman')], 1);
      expect(url).toContain('"skip":0');
      expect(component.first()).toBe(0);
    });

    it('should say when no customers match the search', async () => {
      await search('zzz');
      await answerCustomersQuery([], 0);

      expect(fixture.nativeElement.querySelector('.customers tbody').textContent).toContain('No customers match "zzz".');
    });

    it('should query all customers again when the search is cleared', async () => {
      await search('berlin');
      await answerCustomersQuery([serverCustomer(1, 'Maria', 'Cartman')], 1);

      await search('');
      const url = await answerCustomersQuery([serverCustomer(1, 'Maria', 'Cartman')], 1);
      expect(url).not.toContain('"where"');
      expect(component.searchText()).toBe('');
    });
  });
});
