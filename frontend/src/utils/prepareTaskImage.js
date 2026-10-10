const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_IMAGE_BYTES = 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 120 * 1024;
const MAX_DIMENSION = 1600;
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function loadImage(file) {
  const objectUrl = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(objectUrl); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('This file could not be decoded as an image. Choose a valid JPEG, PNG, or WebP image.')); };
    image.src = objectUrl;
  });
}

function canvasBlob(canvas, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error('This image could not be prepared. Try a different image.')),
    'image/jpeg',
    quality,
  ));
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('This image could not be read. Try a different file.'));
    reader.readAsDataURL(blob);
  });
}

function drawResized(image, maxDimension) {
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image processing is unavailable in this browser.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function compressedImage(image) {
  let scale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
  for (let resize = 0; resize < 7; resize += 1) {
    const canvas = drawResized(image, Math.max(480, Math.round(MAX_DIMENSION * scale)));
    for (const quality of [0.84, 0.74, 0.64, 0.54]) {
      const blob = await canvasBlob(canvas, quality);
      if (blob.size <= MAX_IMAGE_BYTES) return blob;
    }
    scale *= 0.82;
  }
  throw new Error('This image is too large after compression. Choose a smaller image.');
}

async function thumbnailImage(image) {
  const canvas = drawResized(image, 360);
  for (const quality of [0.7, 0.55, 0.4]) {
    const blob = await canvasBlob(canvas, quality);
    if (blob.size <= MAX_THUMBNAIL_BYTES) return blob;
  }
  throw new Error('The image preview could not be compressed. Choose a smaller image.');
}

export async function prepareTaskImage(file) {
  if (!file) throw new Error('Choose an image file first.');
  if (!ACCEPTED_TYPES.has(file.type)) throw new Error('Choose a JPEG, PNG, or WebP image.');
  if (file.size > MAX_SOURCE_BYTES) throw new Error('Choose an image smaller than 12 MB.');
  if (file.size <= 0) throw new Error('The selected image is empty. Choose a different file.');

  const image = await loadImage(file);
  const [fullImage, thumbnail] = await Promise.all([compressedImage(image), thumbnailImage(image)]);
  return { imageUrl: await blobToDataUrl(fullImage), imageThumbnail: await blobToDataUrl(thumbnail) };
}
