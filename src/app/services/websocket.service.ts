import { Injectable } from '@angular/core';
import { Client, Stomp, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { BehaviorSubject, Observable } from 'rxjs';

export interface ChatMessage {
  sender: string;
  content: string;
  type: 'JOIN' | 'CHAT' | 'LEAVE';
}

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {

  username = "default";
  private roomMessages = new BehaviorSubject<any>(null);
  private userId: string = this.generateUserId();
  private currentRoomId: string | null = null;
  private codeUpdateSubject = new BehaviorSubject<string>('');
  private roomMessagesSubject = new BehaviorSubject<any>(null);
  private connectionStatusSubject = new BehaviorSubject<boolean>(false);

  private stompClient: Client = new Client({
    webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
    debug: (str) => console.log('[STOMP] ' + str),
    reconnectDelay: 5000,
    heartbeatIncoming: 4000,
    heartbeatOutgoing: 4000,
  });


  constructor() {

    this.currentRoomId = location.pathname.replace("/", "");

  }

  private generateUserId(): string {
    return 'user-' + Math.random().toString(36).substring(2, 9);
  }

  public joinRoom(roomId: string, username: string): Observable<any> {
    return new Observable((subscriber) => {
      this.connect().then(() => {
        this.currentRoomId = roomId;

        // Subscribe to room-specific messages
        const subscription = this.stompClient.subscribe(
          `/topic/room/${roomId}`,
          (message: IMessage) => {
            subscriber.next(JSON.parse(message.body));
          }
        );

        // Send join message
        const joinMessage = {
          type: 'JOIN',
          userId: this.userId,
          username: username,
          roomId: roomId,
          color: this.generateColor()
        };

        this.stompClient.publish({
          destination: `/app/room/${roomId}/join`,
          body: JSON.stringify(joinMessage)
        });

        // Handle unsubscribe
        return () => {
          if (subscription) {
            subscription.unsubscribe();
          }
        };
      }).catch(error => {
        subscriber.error(error);
      });
    });
  }

  // Setup all subscriptions
  private setupSubscriptions(): void {
    if (!this.currentRoomId) return;

    // Subscribe to code updates
    this.stompClient.subscribe(
      `/topic/room/${this.currentRoomId}`,
      (message: IMessage) => {
        const parsed = JSON.parse(message.body);
        console.log('Received room message:', parsed); // Debug log

        // Update appropriate subjects based on message type
        if (parsed.type === 'CODE_UPDATE') {
          this.codeUpdateSubject.next(parsed.content);
        }
        this.roomMessagesSubject.next(parsed);
      }
    );
  }

  public sendMessage(roomId: string, message: any): void {

    const sendUpdate = {
      type: 'CODE_UPDATE',
      content: message
    }

    this.stompClient.publish({
      destination: `/app/room/${roomId}/sendMessage`,
      body: JSON.stringify(message)
    });
  }

  public sendCodeUpdate(roomId: string, content: string): void {
    this.sendMessage(roomId, {
      type: 'CODE_UPDATE',
      content: content
    });
  }

  public sendCursorUpdate(roomId: string, position: any, selection: any): void {
    this.stompClient.publish({
      destination: `/app/room/${roomId}/sendCursor`,
      body: JSON.stringify({
        position: position,
        selection: selection
      })
    });
  }

  public subscribeToRoom(roomId: string): Observable<any> {
    return new Observable(observer => {
      const subscription = this.stompClient.subscribe(
        `/topic/room/${roomId}`,
        (message: IMessage) => {
          observer.next(JSON.parse(message.body));
        }
      );
      return () => subscription.unsubscribe();
    });
  }

  public subscribeToCursors(roomId: string): Observable<any> {
    return new Observable(observer => {
      const subscription = this.stompClient.subscribe(
        `/topic/room/${roomId}/cursors`,
        (message: IMessage) => {
          observer.next(JSON.parse(message.body));
        }
      );
      return () => subscription.unsubscribe();
    });
  }

  private generateColor(): string {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 70%, 60%)`;
  }


  public connect(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      // If already connected, resolve immediately
      if (this.stompClient.connected) {
        resolve(true);
        return;
      }

      // Set up connection callback
      this.stompClient.onConnect = (frame) => {
        this.connectionStatusSubject.next(true);
        console.log('Connected: ' + frame);
        resolve(true);
        this.setupSubscriptions();
      };

      // Set up error callback
      this.stompClient.onStompError = (frame) => {
        console.error('STOMP error: ' + frame.headers['message']);
        this.connectionStatusSubject.next(false);
        reject(false);
      };

      // Set up disconnect callback
      this.stompClient.onDisconnect = (frame) => {
        this.connectionStatusSubject.next(false);
        console.log('Disconnected: ' + frame);
      };

      // Activate the connection
      this.stompClient.activate();
    });
  }

  // PUBLIC METHODS FOR COMPONENTS TO USE

  // Subscribe to code changes
  public onCodeUpdate(): Observable<string> {
    return this.codeUpdateSubject.asObservable();
  }

  // Subscribe to all room messages
  public onRoomMessage(): Observable<any> {
    return this.roomMessagesSubject.asObservable();
  }

  public getConnectionStatus(): Observable<boolean> {
    return this.connectionStatusSubject.asObservable();
  }

  // Disconnect
  public disconnect(): void {
    if (this.stompClient.connected && this.currentRoomId) {
      this.stompClient.publish({
        destination: `/app/room/${this.currentRoomId}/leave`,
        body: JSON.stringify({
          type: 'LEAVE',
          userId: this.userId
        })
      });
    }
    this.stompClient.deactivate();
    this.connectionStatusSubject.next(false);
  }

}
