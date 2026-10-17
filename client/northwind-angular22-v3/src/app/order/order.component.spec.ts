import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { configureBreeze } from 'breeze-client';
import { httpClientFetch } from 'breeze-client/adapter-angular-httpclient';

import { EntityManagerProvider } from '../entity-manager-provider';
import { OrderComponent } from './order.component';

// Breeze allows an entity constructor to be registered with only one MetadataStore,
// so every test shares a single EntityManagerProvider.
let sharedProvider: EntityManagerProvider | undefined;
function getSharedProvider() {
  sharedProvider ??= new EntityManagerProvider();
  return sharedProvider;
}

// An order as the server returns it for the expanded query
const orderResponse = [
  {
    $id: '1',
    $type: 'NorthwindModel.Models.Order, NorthwindModel',
    Id: 11, CustomerId: 1, OrderNumber: '542379', OrderDate: '2012-07-05T00:00:00', TotalAmount: 1863.4,
    Customer: {
      $id: '2',
      $type: 'NorthwindModel.Models.Customer, NorthwindModel',
      Id: 1, FirstName: 'Maria', LastName: 'Cartman', City: 'Berlin', Country: 'Germany', Phone: '030-0074321'
    },
    OrderItems: [
      {
        $id: '3',
        $type: 'NorthwindModel.Models.OrderItem, NorthwindModel',
        Id: 30, OrderId: 11, ProductId: 14, UnitPrice: 18.6, Quantity: 9,
        Product: {
          $id: '4',
          $type: 'NorthwindModel.Models.Product, NorthwindModel',
          Id: 14, ProductName: 'Tofu', Package: '40 - 100 g pkgs.', SupplierId: 6, UnitPrice: 23.25, IsDiscontinued: false,
          Supplier: {
            $id: '5',
            $type: 'NorthwindModel.Models.Supplier, NorthwindModel',
            Id: 6, CompanyName: 'Mayumi\'s', ContactName: 'Mayumi Ohno', City: 'Osaka', Country: 'Japan'
          }
        }
      },
      {
        $id: '6',
        $type: 'NorthwindModel.Models.OrderItem, NorthwindModel',
        Id: 31, OrderId: 11, ProductId: 51, UnitPrice: 42.4, Quantity: 40,
        Product: {
          $id: '7',
          $type: 'NorthwindModel.Models.Product, NorthwindModel',
          Id: 51, ProductName: 'Manjimup Dried Apples', Package: '50 - 300 g pkgs.', SupplierId: 24, UnitPrice: 53, IsDiscontinued: true,
          Supplier: {
            $id: '8',
            $type: 'NorthwindModel.Models.Supplier, NorthwindModel',
            Id: 24, CompanyName: 'G\'day, Mate', ContactName: 'Wendy Mackenzie', City: 'Sydney', Country: 'Australia'
          }
        }
      }
    ]
  }
];

describe('OrderComponent', () => {
  let component: OrderComponent;
  let fixture: ComponentFixture<OrderComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: EntityManagerProvider, useFactory: getSharedProvider },
      ],
    }).compileComponents();

    // The app initializer does not run in a component test, so configure Breeze here.
    configureBreeze({ fetch: httpClientFetch(TestBed.inject(HttpClient)) });

    httpMock = TestBed.inject(HttpTestingController);

    fixture = TestBed.createComponent(OrderComponent);
    component = fixture.componentInstance;
    // In the app, the router sets this from the orders/:id route parameter
    fixture.componentRef.setInput('id', '11');
    await fixture.whenStable();
  });

  afterEach(() => {
    httpMock.verify();
  });

  async function respond(body: object[]) {
    const req = httpMock.expectOne(r => r.url.startsWith('http://localhost:4000/api/breeze/Orders'));
    expect(req.request.method).toBe('GET');
    req.flush(body);
    // yield to the task queue to let Breeze's query promise settle
    await new Promise(resolve => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  it('should show a loading message until the query returns', async () => {
    expect(fixture.nativeElement.textContent).toContain('Loading order...');
    await respond([]);
  });

  it('should query the order with its customer, items, products and suppliers', async () => {
    const req = httpMock.expectOne(r => r.url.startsWith('http://localhost:4000/api/breeze/Orders'));
    const url = decodeURIComponent(req.request.urlWithParams);
    // Breeze sends the server's property names
    expect(url).toContain('"where":{"Id":11}');
    expect(url).toContain('"expand":["Customer","OrderItems.Product.Supplier"]');
    req.flush(orderResponse);
    await new Promise(resolve => setTimeout(resolve, 0));
  });

  it('should show the order and its customer', async () => {
    await respond(orderResponse);

    expect(component.order()?.orderNumber).toBe('542379');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Order 542379');
    expect(text).toContain('$1,863.40');
    expect(text).toContain('Maria Cartman');
    expect(text).toContain('Berlin');
  });

  it('should show the order items with product and supplier', async () => {
    await respond(orderResponse);

    const rows = fixture.nativeElement.querySelectorAll('.order-items tbody tr') as NodeListOf<HTMLElement>;
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Tofu');
    expect(rows[0].textContent).toContain('40 - 100 g pkgs.');
    expect(rows[0].textContent).toContain('Mayumi\'s');
    expect(rows[0].textContent).toContain('$167.40');  // 18.60 x 9
    expect(rows[0].textContent).not.toContain('Discontinued');
    expect(rows[1].textContent).toContain('G\'day, Mate');
    expect(rows[1].textContent).toContain('Discontinued');
  });

  it('should say when the order is not found', async () => {
    await respond([]);

    expect(component.order()).toBeUndefined();
    expect(fixture.nativeElement.textContent).toContain('Order 11 was not found.');
  });
});
