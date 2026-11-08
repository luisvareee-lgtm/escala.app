// Reduce fotos en el navegador (máx. 900 px, WebP) antes de subirlas: rápido, barato y entra en el bucket de 1 MB.
export async function redimensionar(file, max = 900, calidad = .82) {
  if (!/^image\//.test(file.type)) throw new Error('Elegí una imagen (JPG, PNG o WebP).');
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height)), w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(bmp, 0, 0, w, h);
  const blob = await new Promise(r => c.toBlob(r, 'image/webp', calidad));
  if (!blob) throw new Error('No se pudo procesar la imagen.');
  if (blob.size > 1024 * 1024) throw new Error('La imagen sigue pesando más de 1 MB. Probá con una más chica.');
  return blob;
}
