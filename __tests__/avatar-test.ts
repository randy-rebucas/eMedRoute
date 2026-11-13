const mockResize = jest.fn();
const mockSaveAsync = jest.fn();

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: jest.fn(() => ({
      resize: (arg: unknown) => {
        mockResize(arg);
        return { renderAsync: async () => ({ saveAsync: mockSaveAsync }) };
      },
    })),
  },
}));

import * as ImagePicker from 'expo-image-picker';
import { PhotoPermissionError, pickProfilePhoto } from '@/lib/avatar';

const picker = ImagePicker as jest.Mocked<typeof ImagePicker>;

describe('pickProfilePhoto', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null when the rep cancels', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null } as any);
    expect(await pickProfilePhoto('library')).toBeNull();
    expect(mockSaveAsync).not.toHaveBeenCalled();
  });

  it('throws a permission error when the camera is refused, without opening it', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false } as any);
    await expect(pickProfilePhoto('camera')).rejects.toBeInstanceOf(PhotoPermissionError);
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it('crops square, shrinks the longer side to 512 and returns a JPEG data URI', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///a.jpg', width: 3000, height: 4000 }] } as any);
    mockSaveAsync.mockResolvedValue({ base64: 'QUJD', uri: 'file:///b.jpg' });

    expect(await pickProfilePhoto('library')).toBe('data:image/jpeg;base64,QUJD');
    expect(picker.launchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({ allowsEditing: true, aspect: [1, 1], mediaTypes: ['images'] }));
    expect(mockResize).toHaveBeenCalledWith({ height: 512 });
    expect(mockSaveAsync).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.75, base64: true });
  });

  it('never enlarges a small picture', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///s.jpg', width: 300, height: 200 }] } as any);
    mockSaveAsync.mockResolvedValue({ base64: 'eA==' });
    await pickProfilePhoto('library');
    expect(mockResize).toHaveBeenCalledWith({ width: 300 });
  });
});
