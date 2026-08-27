declare module 'socket.io-client' {
  export interface Socket {
    connected: boolean;
    on(event: string, callback: (...args: any[]) => void): this;
    off(event: string, callback?: (...args: any[]) => void): this;
    emit(event: string, ...args: any[]): this;
    disconnect(): this;
  }

  export interface ConnectOptions {
    transports?: string[];
    autoConnect?: boolean;
    [key: string]: unknown;
  }

  export default function io(uri: string, opts?: ConnectOptions): Socket;
}