import * as ImageManipulator from 'expo-image-manipulator';
import { getInfoAsync } from 'expo-file-system/legacy';

export async function compressImage(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 800 } }],
    { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

export async function getFileSize(uri: string): Promise<number> {
  const info = await getInfoAsync(uri);
  return info.exists ? (info.size ?? 0) : 0;
}
