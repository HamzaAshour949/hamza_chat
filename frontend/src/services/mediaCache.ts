import { cacheDirectory, downloadAsync, getInfoAsync, makeDirectoryAsync } from 'expo-file-system/legacy';

const DIR = `${cacheDirectory}chat-media/`;

export async function getCachedMedia(filename: string): Promise<string | null> {
  const dest = `${DIR}${filename}`;
  const info = await getInfoAsync(dest);
  return info.exists ? dest : null;
}

export async function downloadMedia(url: string, filename: string): Promise<string> {
  await makeDirectoryAsync(DIR, { intermediates: true });
  const dest = `${DIR}${filename}`;
  const existing = await getInfoAsync(dest);
  if (existing.exists) return dest;
  const result = await downloadAsync(url, dest);
  return result.uri;
}

export function filenameFromUrl(url: string, fallback: string): string {
  try {
    const clean = url.split('?')[0];
    const last = clean.split('/').pop();
    if (last && last.length > 2) return last.replace(/[^a-zA-Z0-9._-]/g, '_');
  } catch {
    /* ignore */
  }
  return fallback;
}
