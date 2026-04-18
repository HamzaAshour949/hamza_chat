import * as ImageManipulator from 'expo-image-manipulator';
import * as VideoThumbnails from 'expo-video-thumbnails';

/**
 * Generate a tiny base64 JPEG thumbnail from an image URI.
 * Target size: ~2 KB so it can be embedded inline in the socket message.
 */
export async function generateThumbnail(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 120 } }],
    { compress: 0.3, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );
  return result.base64 ? `data:image/jpeg;base64,${result.base64}` : '';
}

/**
 * Generate a tiny base64 JPEG thumbnail from a video URI by grabbing the
 * first frame, then aggressively compressing it. Target ≤ 4 KB.
 */
export async function generateVideoThumbnail(uri: string): Promise<string> {
  try {
    const { uri: frameUri } = await VideoThumbnails.getThumbnailAsync(uri, {
      time: 500,
      quality: 0.6,
    });
    return await generateThumbnail(frameUri);
  } catch (e) {
    console.warn('Video thumbnail generation failed:', e);
    return '';
  }
}
