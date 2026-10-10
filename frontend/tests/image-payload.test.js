import test from 'node:test';
import assert from 'node:assert/strict';
import { taskImagePayload, profilePayload } from '../src/utils/imagePayload.js';

test('task edits retain hosted images, upload replacements and explicitly clear removed images', () => {
  const id = '507f1f77bcf86cd799439011';
  const hosted = { imageUrl: `/api/tasks/${id}/image?variant=full`, imageThumbnail: `/api/tasks/${id}/image?variant=thumbnail` };
  assert.deepEqual(taskImagePayload(hosted, true), {});
  const replacement = { imageUrl: 'data:image/png;base64,AAAA', imageThumbnail: 'data:image/png;base64,BBBB' };
  assert.deepEqual(taskImagePayload(replacement, true), replacement);
  assert.deepEqual(taskImagePayload({ imageUrl: null, imageThumbnail: null }, true), { imageUrl: null, imageThumbnail: null });
  assert.deepEqual(taskImagePayload({}, false), { imageUrl: null, imageThumbnail: null });
});

test('profile edits preserve hosted avatars and allow new uploads or external image URLs', () => {
  assert.deepEqual(profilePayload({ firstName: 'Test', profileImage: '/api/users/507f1f77bcf86cd799439011/image?v=1' }), { firstName: 'Test' });
  for (const profileImage of ['data:image/png;base64,AAAA', 'https://example.com/avatar.png', '']) {
    assert.deepEqual(profilePayload({ profileImage }), { profileImage });
  }
});
