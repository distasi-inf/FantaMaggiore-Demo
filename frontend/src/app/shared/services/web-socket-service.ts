import { Injectable } from '@angular/core';
import { Client, Message, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Observable, Subject } from 'rxjs';
// FIX: importa 'environment' (non 'environment.development')
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class WebSocketService {
  private stompClient: Client;

  // Mappa topic → Subject: ogni topic ha il suo canale indipendente
  private topicSubjects = new Map<string, Subject<any>>();

  // Mappa topic → StompSubscription: per poter fare unsubscribe
  private activeSubscriptions = new Map<string, StompSubscription>();

  constructor() {
    const baseURL = environment.apiUrl.replace('/api', '');

    this.stompClient = new Client({
      webSocketFactory: () => new SockJS(baseURL + '/ws'),
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,

      debug: (str) => console.log('📡 [STOMP]', str),
    });

    // Un unico onConnect che gestisce tutti i topic registrati
    this.stompClient.onConnect = () => {
      this.topicSubjects.forEach((subject, topic) => {
        this.subscribeToTopic(topic, subject);
      });
    };

    this.stompClient.onStompError = (frame) => {
      console.error('Broker reported error: ' + frame.headers['message']);
      console.error('Additional details: ' + frame.body);
    };
  }

  /**
   * Attiva la connessione WebSocket.
   */
  public connect(): void {
    if (this.stompClient.active) {
      return;
    }
    this.stompClient.activate();
  }

  /**
   * Disattiva la connessione WebSocket e pulisce tutte le sottoscrizioni.
   */
  public disconnect(): void {
    if (this.stompClient.active) {
      this.stompClient.deactivate();
    }
    // FIX: NON CANCELLARE i topicSubjects, altrimenti distruggi gli Observable di Angular!
    // this.topicSubjects.clear(); <--- RIMOSSA!
    this.activeSubscriptions.clear();
  }

  /**
   * Ascolta un canale specifico (es. /topic/live-score).
   * Può essere chiamato più volte per topic diversi senza sovrascrivere i precedenti.
   */
  watch(topic: string): Observable<any> {
    if (!this.topicSubjects.has(topic)) {
      const subject = new Subject<any>();
      this.topicSubjects.set(topic, subject);

      if (this.stompClient.connected) {
        this.subscribeToTopic(topic, subject);
      }
    }
    return this.topicSubjects.get(topic)!.asObservable();
  }

  /**
   * Annulla la sottoscrizione a un singolo topic.
   */
  unwatch(topic: string): void {
    const subscription = this.activeSubscriptions.get(topic);
    if (subscription) {
      subscription.unsubscribe();
      this.activeSubscriptions.delete(topic);
    }
    this.topicSubjects.delete(topic);
  }

  /**
   * Invia un messaggio a un canale.
   */
  send(topic: string, body: any) {
    this.stompClient.publish({
      destination: topic,
      body: JSON.stringify(body),
    });
  }

  /**
   * Metodo interno: effettua la sottoscrizione STOMP e salva il riferimento.
   */
  private subscribeToTopic(topic: string, subject: Subject<any>): void {
    if (this.activeSubscriptions.has(topic)) return;

    const subscription = this.stompClient.subscribe(topic, (message: Message) => {
      if (message.body) {
        try {
          subject.next(JSON.parse(message.body));
        } catch (e) {
          subject.next(message.body);
        }
      }
    });

    this.activeSubscriptions.set(topic, subscription);
  }
}
