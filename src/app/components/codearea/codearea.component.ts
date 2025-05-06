import { CommonModule, Location } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MonacoEditorModule } from '@materia-ui/ngx-monaco-editor';
import { WebsocketService } from '../../services/websocket.service';
import { LogIn, User } from 'lucide-angular';



@Component({
  standalone: true,
  selector: 'app-codearea',
  imports: [
    CommonModule,
    FormsModule,
    MonacoEditorModule,
  ],
  templateUrl: './codearea.component.html',
})
export class CodeareaComponent {

  code: string = 'function x() {\nconsole.log("Hello world!");\n}';
  roomId: string = '';
  private editor: any;
  private ignoreNextUpdate = false;
  private lastCursorPosition: any;
  private username = '';

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
  ) { }

  onEditorInit(editor: any) {

    this.editor = editor;

    this.username = this.websocketService.getUsername();

    // Track cursor position
    this.editor.onDidChangeCursorPosition((e: any) => {
      this.lastCursorPosition = e.position;
    });

    // Listen for content changes
    this.editor.onDidChangeModelContent((event: any) => {
      if (this.ignoreNextUpdate) {
        console.log('Ignoring content change (circular update prevention)');
        return;
      }

      const currentContent = this.editor.getModel().getValue();
      console.log('Content changed:', currentContent);

      // Send updated content to the server
      this.onTextChange();
    });
  }


  ngOnInit() {
    this.websocketService.connect().then(connected => {
      if (connected) {
        console.log('Successfully connected to WebSocket');
        this.initializeRoom();
      }
    }).catch(error => {
      console.error('Connection failed:', error);
    });
  }

  private initializeRoom() {
    this.roomId = location.pathname.replace("/", "");
    console.log("Joining Room with Id", this.roomId);

    this.websocketService.fetchClientIpAddress().then(() => {
      const usernameToPass = this.username.trim() !== '' ? this.username : undefined;

      this.websocketService.joinRoom(this.roomId, usernameToPass).subscribe({
        next: (res) => {
          console.log(this.roomId, 'Room joined successfully', res);
        },
        error: (err) => {
          console.error('Error joining room:', err);
        }
      });

      this.setupMessageListener();
    }).catch((error) => {
      console.error('Error fetching IP Address before joining room:', error);
    });
  }

  private setupMessageListener() {
    this.websocketService.subscribeToRoom(this.roomId).subscribe({
      next: (msg) => {
        // console.log("UPDATED MESSAGE:", msg);
        // console.log("UPDATED MESSAGE : ", msg.content);
        // this.updateEditorContent(msg.content);   
      }
    })
  }

  private updateEditorContent(newContent: string) {
    if (!this.editor) return;

    const model = this.editor.getModel();
    const oldContent = model.getValue();

    if (oldContent === newContent) return;

    this.ignoreNextUpdate = true;

    const fullRange = model.getFullModelRange();
    const id = { major: 1, minor: 1 }; // Unique operation id for undo stack
    const textEdits = [{
      range: fullRange,
      text: newContent,
      forceMoveMarkers: true
    }];

    this.editor.executeEdits('remote-update', textEdits);

    // Optionally trigger a model change marker for undo stack
    this.editor.pushUndoStop();

    // Restore the cursor with minimal flickering
    setTimeout(() => {
      if (this.lastCursorPosition) {
        this.editor.setPosition(this.lastCursorPosition);
        this.editor.focus();
      }
      this.ignoreNextUpdate = false;
    }, 0);
  }



  onTextChange() {
    if (this.ignoreNextUpdate) {
      console.log('Ignoring update (circular update prevention)');
      return;
    }

    if (!this.editor) {
      console.error('Editor not initialized!');
      return;
    }

    const currentContent = this.editor.getValue();
    console.log('Sending content to server:', currentContent.substring(0, 50) + '...'); // Log first 50 chars

    setTimeout(() => {
      try {
        this.websocketService.sendCodeUpdate(this.roomId, currentContent);
      } catch (e) {
        console.error('Error sending content:', e);
      }
    }, 300);
  }

  ngOnDestroy() {
    this.websocketService.disconnect();
  }

}
