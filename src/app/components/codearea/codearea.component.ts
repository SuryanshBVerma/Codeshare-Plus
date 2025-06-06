import { CommonModule, Location } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MonacoEditorModule } from '@materia-ui/ngx-monaco-editor';
import { WebsocketService } from '../../services/websocket.service';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco'; // Optional, or you can manually bind

interface cursorDetails {
  decorations: string[];
  selectionDecorations: string[];
  color: string;
  username: string;
}

@Component({
  standalone: true,
  selector: 'app-codearea',
  imports: [
    CommonModule,
    FormsModule,
    MonacoEditorModule,
  ],
  templateUrl: './codearea.component.html',
  styles: ''
})
export class CodeareaComponent {

  code: string = '';
  roomId: string = '';
  private editor: any;
  private ignoreNextUpdate = false;
  private lastCursorPosition: any;
  private lastSelection: any;
  private username = '';
  private ydoc = new Y.Doc();
  private yText = this.ydoc.getText('monaco');

  private remoteCursors: Map<string, cursorDetails> = new Map();


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

  // Utility function to validate Base64 strings
  private isValidBase64(str: string): boolean {
    const base64Regex = /^[A-Za-z0-9+/=]+$/;
    return base64Regex.test(str) && str.length % 4 === 0;
  }

  constructor(
    private websocketService: WebsocketService,
    private loaction: Location
  ) { }

  onEditorInit(editor: any) {

    this.editor = editor;
    const model = editor.getModel();
    new MonacoBinding(this.yText, model, new Set([editor]), null);

    this.username = this.websocketService.getUsername();

    // Track cursor position
    this.editor.onDidChangeCursorPosition((e: any) => {
      this.lastCursorPosition = e.position;
      this.lastSelection = this.editor.getSelection();
      this.websocketService.sendCursorUpdate(this.roomId, this.lastCursorPosition, this.lastSelection);
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

    // Subscribe to room message updates
    this.websocketService.subscribeToRoom(this.roomId).subscribe({
      next: (msg) => {
        if (msg.type === 'CODE_UPDATE') {
          const base64Update = msg.content; // string received from server
          // Validate the Base64 string
          if (!base64Update || !this.isValidBase64(base64Update)) {
            console.log(msg);
            console.error('Invalid or empty Base64 string received:', base64Update);
            return;
          }

          try {
            const binaryString = atob(base64Update);
            const update = new Uint8Array(binaryString.length);

            for (let i = 0; i < binaryString.length; i++) {
              update[i] = binaryString.charCodeAt(i);
            }

            Y.applyUpdate(this.ydoc, update); // Apply the received update to the Yjs document
          } catch (error) {
            console.error('Error decoding Base64 string:', error);
          }
        }else {
          const base64Update = msg.content;

          try {
            const binaryString = atob(base64Update);
            const update = new Uint8Array(binaryString.length);

            for (let i = 0; i < binaryString.length; i++) {
              update[i] = binaryString.charCodeAt(i);
            }

            Y.applyUpdate(this.ydoc, update); // Apply the received update to the Yjs document
          } catch (error) {
            // console.error('Error decoding Base64 string:', error);
          }
          
        }
      } 
    });

    // Subscribe to cursor updates
    this.websocketService.subscribeToCursors(this.roomId).subscribe({
      next: (msg) => {
        console.log("CURSOR UPDATE");
        this.handleRemoteCursorUpdate(msg);
      }
    })

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

    const update = Y.encodeStateAsUpdate(this.ydoc);
    const base64Update = btoa(String.fromCharCode(...update)); // convert to base64 string
    this.websocketService.sendCodeUpdate(this.roomId, base64Update);

  }

  private handleRemoteCursorUpdate(update: any) {
    // Skip our own cursor updates
    if (update.userId === this.websocketService.getUsername()) {
      return;
    }

    // Get or create cursor data
    let cursorData = this.remoteCursors.get(update.userId);
    if (!cursorData) {
      cursorData = {
        decorations: [],
        selectionDecorations: [],
        color: this.generateUserColor(update.userId),
        username: update.username
      };
      this.remoteCursors.set(update.userId, cursorData);
      this.addCursorStyle(update.userId, cursorData.color);
    }

    console.log("Remote cursor", this.remoteCursors);


    // Update cursor position
    this.updateRemoteCursor(update.userId, update.position, update.selection);
  }

  private generateUserColor(userId: string): string {
    // Simple deterministic color generation based on user ID
    const hash = Array.from(userId).reduce(
      (hash, char) => char.charCodeAt(0) + ((hash << 5) - hash), 0
    );
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 70%, 60%)`;
  }

  private addCursorStyle(userId: string, color: string): void {
    const styleId = `cursor-style-${userId}`;
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
      .remote-cursor-${userId} {
        background-color: ${color};
        width: 2px !important;
        margin-left: -1px;
      }
      .remote-cursor-glyph-${userId} {
        background-color: ${color};
        width: 10px !important;
        margin-left: -5px;
      }
      .remote-selection-${userId} {
        background-color: ${color};
        opacity: 0.3;
      }
    `;
    document.head.appendChild(style);
  }

  private updateRemoteCursor(userId: string, position: any, selection: any) {
    const cursorData = this.remoteCursors.get(userId);
    if (!cursorData || !this.editor) return;

    // Clear old decorations
    if (cursorData.decorations.length) {
      this.editor.deltaDecorations(cursorData.decorations, []);
    }
    if (cursorData.selectionDecorations.length) {
      this.editor.deltaDecorations(cursorData.selectionDecorations, []);
    }

    // Add cursor position decoration
    cursorData.decorations = this.editor.deltaDecorations([], [{
      range: new monaco.Range(
        position.lineNumber,
        position.column,
        position.lineNumber,
        position.column + 1
      ),
      options: {
        className: `remote-cursor-${userId}`,
        glyphMarginClassName: `remote-cursor-glyph-${userId}`,
        glyphMarginHoverMessage: { value: cursorData.username },
        stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
      }
    }]);

    // Add selection decoration if exists
    if (selection && !this.isSelectionEmpty(selection)) {
      cursorData.selectionDecorations = this.editor.deltaDecorations([], [{
        range: new monaco.Range(
          selection.startLineNumber,
          selection.startColumn,
          selection.endLineNumber,
          selection.endColumn
        ),
        options: {
          className: `remote-selection-${userId}`,
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
        }
      }]);
    }
  }

  private isSelectionEmpty(selection: any): boolean {
    return (
      selection.startLineNumber === selection.endLineNumber &&
      selection.startColumn === selection.endColumn
    );
  }


  ngOnDestroy() {
    alert("called");
    this.websocketService.disconnect();
  }

}
