import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { NavbarComponent } from "./components/navbar/navbar.component";

@Component({
  selector: 'app-root',
  imports: [
    ButtonModule,
    ToggleSwitchModule,
    RouterOutlet,
    NavbarComponent
],
  templateUrl: './app.component.html',
})
export class AppComponent {
  title = 'codeshare';
}
