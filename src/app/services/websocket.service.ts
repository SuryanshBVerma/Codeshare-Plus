import { Injectable } from '@angular/core';
import { Client, Stomp, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { BehaviorSubject, Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http'; // Import HttpClient
import { environment } from '../../environments/environment';

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
  // private roomMessages = new BehaviorSubject<any>(null);
  private userId: string = this.generateUserId(); // Ip Address
  private clientIpAddress: string | null = null; // Client IP address
  private currentRoomId: string | null = null;

  private codeUpdateSubject = new BehaviorSubject<string>(' ');
  private roomMessagesSubject = new BehaviorSubject<any>(null);
  private connectionStatusSubject = new BehaviorSubject<boolean>(false);

  private stompClient: Client = new Client({
    webSocketFactory: () => new SockJS(environment.apiUrl),
    debug: (str) => console.log('[STOMP] ' + str),
    reconnectDelay: 5000,
    heartbeatIncoming: 4000,
    heartbeatOutgoing: 4000,
  });


  constructor(
    private http: HttpClient, // Inject HttpClient
  ) {
    this.currentRoomId = location.pathname.replace("/", "");
    this.fetchClientIpAddress().then(() => {
      console.log('IP Address fetched successfully');
    }).catch((error) => {
      console.error('Error fetching IP Address:', error);
    });
  }

  public fetchClientIpAddress(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http.get('https://api.ipify.org?format=json').subscribe(
        (response: any) => {
          this.clientIpAddress = response.ip;
          console.log('Client IP Address:', this.clientIpAddress); // Debug log
          resolve(); // Resolve the promise after assigning the IP address
        },
        (error) => {
          console.error('Failed to fetch IP address:', error);
          reject(error); // Reject the promise if there's an error
        }
      );
    });
  }

  private generateUserId(): string {
    return 'user-' + Math.random().toString(36).substring(2, 9);
  }

  public joinRoom(roomId: string, username: string = this.userId): Observable<any> {

    return new Observable((subscriber) => {
      this.connect().then(() => {

        // Send join message
        const joinMessage = {
          type: 'JOIN',
          content: {
            userName: username,
            code: '',
            roomId: roomId
          },
          sender: this.clientIpAddress
        };

        this.stompClient.publish({
          destination: `/app/room/${roomId}/join`,
          body: JSON.stringify(joinMessage)
        });

        // Notify the subscriber that the join operation was successful
        subscriber.next({ success: true, roomId });
        subscriber.complete();

      }).catch(error => {
        subscriber.error(error);
      });
    });
  }


  
  public sendCodeUpdate(roomId: string, content: string): void {
    
    this.sendMessage(roomId, {
      type: 'CODE_UPDATE',
      content: {
        userName: this.username,
        code: content,
        roomId: roomId
      },
      sender: this.clientIpAddress
    });
  }
  
  private sendMessage(roomId: string, message: any): void {

    this.stompClient.publish({
      destination: `/app/room/${roomId}/sendMessage`,
      body: JSON.stringify(message)
    });
  }

  public sendCursorUpdate(roomId: string, position: any, selection: any): void {
    this.stompClient.publish({
      destination: `/app/room/${roomId}/sendCursor`,
      body: JSON.stringify({
        userId: this.userId,
        username: this.username,
        position: position,
        selection: selection,
        timestamp: new Date().getTime()
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

  //Subscribe to username
  public getUsername() {
    return this.userId;
  }

  public getIpAddress() {
    return this.clientIpAddress;
  }

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
