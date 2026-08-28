import type { SendMessageInput } from '../types';
import { getBackend } from '../backend';
import * as messageStore from './messageStore';

export async function enqueueMessage(input: SendMessageInput): Promise<void> {
  const backend = getBackend();
  if (backend.isConnected()) {
    backend.sendMessage(input);
    return;
  }
  await messageStore.enqueueOutbox(input.localId, input);
}

export async function flushQueue(): Promise<void> {
  const backend = getBackend();
  if (!backend.isConnected()) return;
  const items = await messageStore.getOutbox();
  for (const item of items) {
    backend.sendMessage(item.payload as SendMessageInput);
    await messageStore.removeOutbox(item.id);
  }
}
