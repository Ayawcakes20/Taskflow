import test from 'node:test';
import assert from 'node:assert/strict';
import Task from '../models/Task.js';
import User from '../models/User.js';
import { serializeImageResponse, imageResponses, MAX_JSON_RESPONSE_BYTES } from '../middleware/imageResponses.js';
import { getTaskImage, getUserImage } from '../controllers/imageController.js';

const id = '507f1f77bcf86cd799439011';
const image = 'data:image/png;base64,iVBORw0KGgo=';

test('image-heavy task and user payloads become small authenticated URLs without changing stored data', () => {
  const rows = Array.from({ length: 250 }, () => ({ _id: id, imageUrl: image, imageThumbnail: image,
    assignedUsers: [{ _id: id, profileImage: 'data:image/png;base64,' + 'A'.repeat(1_300_000) }] }));
  const serialized = serializeImageResponse({ data: { items: rows } });
  assert.ok(Buffer.byteLength(serialized) < MAX_JSON_RESPONSE_BYTES);
  const row = JSON.parse(serialized).data.items[0];
  assert.ok(row.imageUrl.startsWith(`/api/tasks/${id}/image?variant=full`));
  assert.ok(row.imageThumbnail.includes('variant=thumbnail'));
  assert.ok(row.assignedUsers[0].profileImage.startsWith(`/api/users/${id}/image?`));
  assert.equal(rows[0].imageUrl, image);
});

test('oversized non-image JSON returns a bounded error instead of an invalid Vercel payload', () => {
  let result;
  let status = 200;
  const res = { json(body) { result = body; }, status(code) { status = code; return this; }, type() { return this; }, send(body) { result = body; } };
  imageResponses({}, res, () => {});
  res.json({ data: 'x'.repeat(MAX_JSON_RESPONSE_BYTES) });
  assert.equal(status, 413);
  assert.equal(result.success, false);
});

test('task image retrieval preserves participant visibility and sends bounded private binary images', async (t) => {
  let scope;
  t.mock.method(Task, 'findOne', (filter) => { scope = filter; return { select: () => ({ lean: async () => ({ imageThumbnail: image }) }) }; });
  let sent;
  const headers = {};
  const res = { setHeader(name, value) { headers[name] = value; }, type(mime) { assert.equal(mime, 'image/png'); return this; }, send(bytes) { sent = bytes; } };
  await getTaskImage({ params: { id }, query: { variant: 'thumbnail' }, user: { _id: id, role: 'User' } }, res);
  assert.equal(scope.$or.length, 3);
  assert.ok(Buffer.isBuffer(sent));
  assert.equal(headers['Cache-Control'], 'private, no-store');
  t.mock.method(Task, 'findOne', () => ({ select: () => ({ lean: async () => null }) }));
  await assert.rejects(getTaskImage({ params: { id }, query: {}, user: { _id: id, role: 'User' } }, res), (error) => error.statusCode === 404);
});

test('avatar retrieval preserves active and historical task avatars, restricts unrelated inactive users and rejects invalid identifiers', async (t) => {
  let scope;
  let active = true;
  let related = null;
  t.mock.method(User, 'findOne', (filter) => { scope = filter; return { select: () => ({ lean: async () => ({ profileImage: image, isActive: active }) }) }; });
  t.mock.method(Task, 'exists', async () => related);
  const res = { setHeader() {}, type() { return this; }, send() {} };
  await getUserImage({ params: { id }, user: { _id: '507f1f77bcf86cd799439012', role: 'User' } }, res);
  assert.equal(scope._id, id);
  active = false;
  const req = { params: { id }, user: { _id: '507f1f77bcf86cd799439012', role: 'User' } };
  await assert.rejects(getUserImage(req, res), (error) => error.statusCode === 404);
  related = { _id: id };
  await getUserImage(req, res);
  await assert.rejects(getUserImage({ params: { id: 'invalid' }, user: {} }, res), (error) => error.statusCode === 404);
});
