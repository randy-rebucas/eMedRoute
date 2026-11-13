import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * Longest side of the stored picture. It's kept inline on the profile (a data URI, ≤ 2 MB on the
 * server), so it's made small: 512 px JPEG at 0.75 is usually 30–60 KB, plenty for an avatar.
 */
const SIZE = 512;
const QUALITY = 0.75;

export type PhotoSource = 'camera' | 'library';

/** Why no picture came back: the rep cancelled, or the camera / photos permission was refused. */
export class PhotoPermissionError extends Error {
  constructor(public source: PhotoSource) {
    super(`No ${source} permission`);
  }
}

/**
 * Let the rep take or choose a picture, cropped square, then shrink it to a small JPEG data URI
 * ready for PUT /profile. Null when they cancel. Throws PhotoPermissionError when access is refused.
 */
export async function pickProfilePhoto(source: PhotoSource): Promise<string | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new PhotoPermissionError('camera');
  }
  // The library opens Android's photo picker, which needs no permission; iOS asks on its own.
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? null : result.assets?.[0];
  if (!asset) return null;

  const resize = asset.width >= asset.height ? { width: Math.min(SIZE, asset.width) } : { height: Math.min(SIZE, asset.height) };
  const rendered = await ImageManipulator.manipulate(asset.uri).resize(resize).renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: QUALITY, base64: true });
  if (!saved.base64) return null;
  return `data:image/jpeg;base64,${saved.base64}`;
}
