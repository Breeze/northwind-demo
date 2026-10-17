import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmDialogModule } from '@openng/optimus-ui/confirmdialog';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ConfirmDialogModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('northwind-angular22');
}
