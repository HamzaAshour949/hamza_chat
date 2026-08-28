import * as ImageManipulator from 'expo-image-manipulator';
import { getInfoAsync } from 'expo-file-system/legacy';

const IMAGE_TARGET_BYTES = 50 * 1024;

export async function getFileSize(uri: string): Promise<number> {
  const info = await getInfoAsync(uri);
  return info.exists ? (info.size ?? 0) : 0;
}

export async function compressImage(uri: string): Promise<string> {
  let width = 800;
  let compress = 0.5;
  let result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width } }],
    { compress, format: ImageManipulator.SaveFormat.JPEG },
  );
  let size = await getFileSize(result.uri);
  let guard = 0;
  while (size > IMAGE_TARGET_BYTES && guard < 6) {
    if (compress > 0.25) compress -= 0.1;
    else width = Math.max(320, Math.floor(width * 0.75));
    result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width } }],
      { compress, format: ImageManipulator.SaveFormat.JPEG },
    );
    size = await getFileSize(result.uri);
    guard += 1;
  }
  return result.uri;
}
