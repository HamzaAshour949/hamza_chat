import * as ImageManipulator from 'expo-image-manipulator';
import * as VideoThumbnails from 'expo-video-thumbnails';

export async function generateThumbnail(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 96 } }],
    { compress: 0.25, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  return result.base64 ? `data:image/jpeg;base64,${result.base64}` : '';
}

export async function generateVideoThumbnail(uri: string): Promise<string> {
  try {
    const { uri: frameUri } = await VideoThumbnails.getThumbnailAsync(uri, {
      time: 400,
      quality: 0.4,
    });
    return await generateThumbnail(frameUri);
  } catch (e) {
    console.warn('Video thumbnail generation failed:', e);
    return '';
  }
}
