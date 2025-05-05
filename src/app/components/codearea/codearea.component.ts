import { CommonModule, Location } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MonacoEditorModule } from '@materia-ui/ngx-monaco-editor';
import { Subscription } from 'rxjs';
import { WebsocketService } from '../../services/websocket.service';
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';


@Component({
  selector: 'app-codearea',
  imports: [
    CommonModule,
    FormsModule,
    MonacoEditorModule
  ],
  templateUrl: './codearea.component.html',
})
export class CodeareaComponent {

  code: string = 'function x() {\nconsole.log("Hello world!");\n}';
  roomId: string = '';

  editorOptions = {
    theme: 'vs-dark',
    language: 'text',
    automaticLayout: true,
    suggestOnTriggerCharacters: false,
    quickSuggestions: false,
    parameterHints: { enabled: false },
    wordBasedSuggestions: false,
    suggest: {
      snippetsPreventQuickSuggestions: false
    },
    hover: { enabled: false }
  };

  constructor(
    private websocketService: WebsocketService,
    private loaction: Location
  ) {
    
  }

  ngOnInit() {

    this.websocketService.connect().then(connected => {
      if (connected) {
        console.log('Successfully connected to WebSocket');
        // Proceed with subscriptions
      }
    })
      .catch(error => {
        console.error('Failed to connect:', error);
      });


    this.roomId = location.pathname.replace("/", ""); // GETTING THE LOCATION TO CONNECT TO THE PARTICULAR ROOM
    console.log("Joining Room with Id", this.roomId);
    this.websocketService.joinRoom(this.roomId, "user").subscribe({
      next: (res) => {

      }
    })

    // Subscribe to room messages
    this.websocketService.onRoomMessage().subscribe({
      next : (msg) =>{
        if(msg.content != null){
          this.code = msg.content;
        }
      }
    });
  }

  onTextChange() {
    setTimeout(() => {
      this.websocketService.sendCodeUpdate(this.roomId, this.code);
    }, 700);
  }

}
