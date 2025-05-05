import { Component, Input } from '@angular/core';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { MessageModule } from 'primeng/message';
import { LucideAngularModule, LoaderCircle } from 'lucide-angular';
import { WebsocketService } from '../../services/websocket.service';

@Component({
  selector: 'app-navbar',
  imports: [
    ToggleSwitchModule,
    MessageModule,
    LucideAngularModule
  ],
  templateUrl: './navbar.component.html',
  styles: ``
})
export class NavbarComponent {

  readonly loader = LoaderCircle;

  @Input() isconnected : boolean = false;

  constructor(private webSocketService : WebsocketService){

  }

  ngOnInit(){
    setTimeout(() => {
      this.webSocketService.getConnectionStatus().subscribe({
        next : (value) =>{
            this.isconnected = value;
        }
      })
    }, 1000);
  }

}
