import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  startAfter,
  updateDoc,
  where,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes, type FirebaseStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseConfig } from '../config';
import type {
  Conversation,
  Message,
  MessageAck,
  MessageType,
  SendMessageInput,
  UploadResult,
  User,
} from '../types';
import type { BackendClient } from './types';

type Listener<T> = (value: T) => void;

function chatIdFor(a: string, b: string): string {
  return [a, b].sort().join('_');
}

function mapMessage(id: string, data: Record<string, unknown>): Message {
  return {
    id,
    serverId: id,
    from: String(data.from || ''),
    to: String(data.to || ''),
    type: (data.type as MessageType) || 'text',
    content: (data.content as string | null) ?? null,
    mediaUrl: (data.mediaUrl as string | null) ?? null,
    localUri: null,
    thumbnail: (data.thumbnail as string | null) ?? null,
    mimeType: (data.mimeType as string | null) ?? null,
    fileName: (data.fileName as string | null) ?? null,
    fileSize: typeof data.fileSize === 'number' ? data.fileSize : null,
    createdAt: String(data.createdAt || new Date().toISOString()),
    status: 'sent',
  };
}

export class FirebaseBackend implements BackendClient {
  readonly kind = 'firebase' as const;
  private auth: Auth;
  private db: Firestore;
  private storage: FirebaseStorage;
  private connected = false;
  private ready: Promise<void>;
  private resolveReady: () => void = () => {};
  private inboxUnsub: Unsubscribe | null = null;
  private seen = new Set<string>();
  private connectionListeners = new Set<Listener<boolean>>();
  private messageListeners = new Set<Listener<Message>>();
  private ackListeners = new Set<Listener<MessageAck>>();

  constructor() {
    const app = getApps().length ? getApp() : initializeApp({
      apiKey: firebaseConfig.apiKey || undefined,
      authDomain: firebaseConfig.authDomain || undefined,
      projectId: firebaseConfig.projectId || undefined,
      storageBucket: firebaseConfig.storageBucket || undefined,
      messagingSenderId: firebaseConfig.messagingSenderId || undefined,
      appId: firebaseConfig.appId || undefined,
    });
    try {
      this.auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    } catch {
      this.auth = getAuth(app);
    }
    this.db = getFirestore(app);
    this.storage = getStorage(app);
    this.ready = new Promise((resolve) => {
      this.resolveReady = resolve;
    });
    onAuthStateChanged(this.auth, () => this.resolveReady());
  }

  connect(_token: string): void {
    this.setConnected(true);
    const uid = this.auth.currentUser?.uid;
    if (!uid) return;
    this.inboxUnsub?.();
    const q = query(
      collectionGroup(this.db, 'messages'),
      where('to', '==', uid),
      orderBy('createdAt', 'desc'),
      fsLimit(20),
    );
    this.inboxUnsub = onSnapshot(q, (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type !== 'added') return;
        if (this.seen.has(change.doc.id)) return;
        this.seen.add(change.doc.id);
        const msg = mapMessage(change.doc.id, change.doc.data() as Record<string, unknown>);
        this.messageListeners.forEach((cb) => cb(msg));
      });
    });
  }

  disconnect(): void {
    this.inboxUnsub?.();
    this.inboxUnsub = null;
    this.setConnected(false);
    signOut(this.auth).catch(() => {});
  }

  isConnected(): boolean {
    return this.connected && Boolean(this.auth.currentUser);
  }

  onConnectionChange(cb: Listener<boolean>): () => void {
    this.connectionListeners.add(cb);
    cb(this.isConnected());
    return () => {
      this.connectionListeners.delete(cb);
    };
  }

  async register(email: string, password: string): Promise<{ token: string; user: User }> {
    const cred = await createUserWithEmailAndPassword(this.auth, email.trim().toLowerCase(), password);
    const user = this.toUser(cred.user);
    await setDoc(doc(this.db, 'users', user.id), {
      email: user.email,
      emailLower: user.email,
      createdAt: new Date().toISOString(),
    });
    const token = await cred.user.getIdToken();
    return { token, user };
  }

  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const cred = await signInWithEmailAndPassword(this.auth, email.trim().toLowerCase(), password);
    const user = this.toUser(cred.user);
    await setDoc(
      doc(this.db, 'users', user.id),
      { email: user.email, emailLower: user.email },
      { merge: true },
    );
    const token = await cred.user.getIdToken();
    return { token, user };
  }

  async me(_token: string): Promise<User> {
    await this.ready;
    const current = this.auth.currentUser;
    if (!current) throw new Error('Not authenticated');
    return this.toUser(current);
  }

  async searchUsers(q: string): Promise<User[]> {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    const uid = this.requireUid();
    const snap = await getDocs(
      query(
        collection(this.db, 'users'),
        where('emailLower', '>=', needle),
        where('emailLower', '<=', `${needle}\uf8ff`),
        fsLimit(20),
      ),
    );
    return snap.docs
      .map((d) => ({ id: d.id, email: String(d.data().email || '') }))
      .filter((u) => u.id !== uid);
  }

  async getConversations(): Promise<Conversation[]> {
    const uid = this.requireUid();
    const snap = await getDocs(
      query(
        collection(this.db, 'chats'),
        where('members', 'array-contains', uid),
        orderBy('lastMessageAt', 'desc'),
        fsLimit(50),
      ),
    );
    return snap.docs.map((d) => {
      const data = d.data();
      const members = (data.members as string[]) || [];
      const peerId = members.find((id) => id !== uid) || uid;
      const emails = (data.emails as Record<string, string>) || {};
      return {
        userId: peerId,
        email: emails[peerId] || peerId,
        lastMessage: String(data.lastMessage || ''),
        lastMessageType: (data.lastMessageType as MessageType) || 'text',
        lastMessageAt: String(data.lastMessageAt || ''),
      };
    });
  }

  async getMessages(peerId: string, opts?: { limit?: number; before?: string }): Promise<Message[]> {
    const uid = this.requireUid();
    const chatId = chatIdFor(uid, peerId);
    const pageSize = opts?.limit ?? 30;
    const col = collection(this.db, 'chats', chatId, 'messages');
    let q = query(col, orderBy('createdAt', 'desc'), fsLimit(pageSize));
    if (opts?.before) {
      const beforeDoc = await getDoc(doc(this.db, 'chats', chatId, 'messages', opts.before));
      if (beforeDoc.exists()) {
        q = query(col, orderBy('createdAt', 'desc'), startAfter(beforeDoc), fsLimit(pageSize));
      }
    }
    const snap = await getDocs(q);
    const messages = snap.docs.map((d) => {
      this.seen.add(d.id);
      return mapMessage(d.id, d.data() as Record<string, unknown>);
    });
    return messages;
  }

  sendMessage(input: SendMessageInput): void {
    const uid = this.auth.currentUser?.uid;
    const email = this.auth.currentUser?.email || '';
    if (!uid) return;
    const createdAt = new Date().toISOString();
    const chatId = chatIdFor(uid, input.to);
    void this.writeMessage(uid, email, chatId, input, createdAt);
  }

  onMessage(cb: Listener<Message>): () => void {
    this.messageListeners.add(cb);
    return () => {
      this.messageListeners.delete(cb);
    };
  }

  onMessageAck(cb: Listener<MessageAck>): () => void {
    this.ackListeners.add(cb);
    return () => {
      this.ackListeners.delete(cb);
    };
  }

  async uploadMedia(uri: string, mimeType: string, fileName: string): Promise<UploadResult> {
    const uid = this.requireUid();
    const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : '';
    const path = `media/${uid}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    const response = await fetch(uri);
    const blob = await response.blob();
    const storageRef = ref(this.storage, path);
    await uploadBytes(storageRef, blob, { contentType: mimeType });
    const url = await getDownloadURL(storageRef);
    return { url, filename: path, mimeType, size: blob.size };
  }

  resolveMediaUrl(url: string | null): string | null {
    return url;
  }

  private async writeMessage(
    uid: string,
    email: string,
    chatId: string,
    input: SendMessageInput,
    createdAt: string,
  ): Promise<void> {
    const chatRef = doc(this.db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);
    const peerSnap = await getDoc(doc(this.db, 'users', input.to));
    const peerEmail = String(peerSnap.data()?.email || input.to);
    if (!chatSnap.exists()) {
      await setDoc(chatRef, {
        members: [uid, input.to],
        emails: { [uid]: email, [input.to]: peerEmail },
        lastMessage: input.type === 'text' ? input.content || '' : input.type,
        lastMessageType: input.type,
        lastMessageAt: createdAt,
      });
    } else {
      await updateDoc(chatRef, {
        lastMessage: input.type === 'text' ? input.content || '' : input.type,
        lastMessageType: input.type,
        lastMessageAt: createdAt,
        [`emails.${uid}`]: email,
        [`emails.${input.to}`]: peerEmail,
      });
    }
    const docRef = await addDoc(collection(this.db, 'chats', chatId, 'messages'), {
      from: uid,
      to: input.to,
      type: input.type,
      content: input.content ?? null,
      mediaUrl: input.mediaUrl ?? null,
      thumbnail: input.thumbnail ?? null,
      mimeType: input.mimeType ?? null,
      fileName: input.fileName ?? null,
      fileSize: input.fileSize ?? null,
      localId: input.localId,
      createdAt,
    });
    this.seen.add(docRef.id);
    const ack: MessageAck = { localId: input.localId, id: docRef.id, createdAt };
    this.ackListeners.forEach((cb) => cb(ack));
  }

  private requireUid(): string {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('Not authenticated');
    return uid;
  }

  private toUser(user: FirebaseUser): User {
    return { id: user.uid, email: user.email || '' };
  }

  private setConnected(value: boolean): void {
    this.connected = value;
    this.connectionListeners.forEach((cb) => cb(this.isConnected()));
  }
}
