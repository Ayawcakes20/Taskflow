export const MAX_JSON_RESPONSE_BYTES = 4 * 1024 * 1024;

export function serializeImageResponse(body) {
  return JSON.stringify(body, function imageReference(key, value) {
    if (typeof value !== 'string' || !value.startsWith('data:image/')) return value;
    const id = String(this._id || this.id || '');
    if (!/^[a-f0-9]{24}$/i.test(id)) return value;
    const version = encodeURIComponent(String(this.updatedAt || ''));
    if (key === 'profileImage') return `/api/users/${id}/image?v=${version}`;
    if (key === 'imageUrl' || key === 'imageThumbnail') {
      return `/api/tasks/${id}/image?variant=${key === 'imageUrl' ? 'full' : 'thumbnail'}&v=${version}`;
    }
    return value;
  });
}

export function imageResponses(_req, res, next) {
  const json = res.json;
  res.json = function boundedJson(body) {
    const serialized = serializeImageResponse(body);
    if (serialized !== undefined && Buffer.byteLength(serialized) > MAX_JSON_RESPONSE_BYTES) {
      return json.call(this.status(413), { success: false, message: 'This response is too large. Request fewer items or narrow your search.' });
    }
    return this.type('application/json').send(serialized);
  };
  next();
}
