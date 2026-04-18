import { uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy';
import { API_BASE_URL } from './config';
import { getToken } from './api';

interface UploadResult {
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

export async function uploadMedia(
  uri: string,
  mimeType: string,
  fileName: string
): Promise<UploadResult> {
  const token = await getToken();

  const result = await uploadAsync(
    `${API_BASE_URL}/media/upload`,
    uri,
    {
      httpMethod: 'POST',
      uploadType: FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      parameters: {
        filename: fileName,
      },
    }
  );

  if (result.status !== 201) {
    const error = JSON.parse(result.body);
    throw new Error(error.error || 'Upload failed');
  }

  return JSON.parse(result.body) as UploadResult;
}
