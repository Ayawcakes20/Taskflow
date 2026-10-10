import { ApiError } from '../middleware/errorMiddleware.js';

const signatures = {
  'image/jpeg': (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  'image/png': (bytes) => bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (bytes) => bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP',
};

export function validateImageDataUri(value, { label = 'image', maxBytes = 1024 * 1024 } = {}) {
  if (value === undefined || value === null || value === '') return null;
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
  if (!match) throw new ApiError(400, `The ${label} must be a valid JPEG, PNG, or WebP image.`);
  const [, mimeType, encoded] = match;
  const bytes = Buffer.from(encoded, 'base64');
  if (!bytes.length || bytes.toString('base64') !== encoded) throw new ApiError(400, `The ${label} is not a valid image file.`);
  if (bytes.length > maxBytes) throw new ApiError(413, `The ${label} must be ${Math.floor(maxBytes / 1024)} KB or smaller.`);
  const checker = signatures[mimeType.toLowerCase()];
  if (!checker?.(bytes)) throw new ApiError(400, `The ${label} contents do not match its image type.`);
  return value;
}

export function validateTaskImages({ imageUrl = null, imageThumbnail = null } = {}) {
  return {
    imageUrl: validateImageDataUri(imageUrl, { label: 'task image', maxBytes: 1024 * 1024 }),
    imageThumbnail: validateImageDataUri(imageThumbnail, { label: 'task image preview', maxBytes: 120 * 1024 }),
  };
}

export function validateProfileImage(value) {
  if (value === undefined || value === null || value === '') return '';
  if (value.startsWith('data:')) return validateImageDataUri(value, { label: 'profile photo', maxBytes: 1024 * 1024 });
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || value.length > 1000) throw new Error('invalid');
    return value;
  } catch {
    throw new ApiError(400, 'The profile photo must be a valid image URL or uploaded image.');
  }
}
