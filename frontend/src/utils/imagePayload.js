// Server-hosted image URLs represent unchanged stored images, not new uploads.
export function taskImagePayload(form, editing) {
  return Object.fromEntries(['imageUrl', 'imageThumbnail'].filter((key) =>
    !editing || !/^\/api\/tasks\/[a-f0-9]{24}\/image\?/i.test(form[key] || '')
  ).map((key) => [key, form[key] || null]));
}

export function profilePayload(form) {
  const payload = { ...form };
  if (/^\/api\/users\/[a-f0-9]{24}\/image\?/i.test(payload.profileImage || '')) delete payload.profileImage;
  return payload;
}
