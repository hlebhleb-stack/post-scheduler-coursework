const maxFiles = 10;
const maxUploadBytes = 50 * 1024 * 1024;
const maxPhotoBytes = 10 * 1024 * 1024;

const mimeOf = (file) => file.mime || file.type || '';

export function mediaKind(file) {
  const extension = file.name.split('.').pop().toLowerCase();
  const mime = mimeOf(file);
  if (['jpg', 'jpeg', 'png'].includes(extension) && mime.startsWith('image/')) return 'photo';
  if (extension === 'gif' && mime === 'image/gif') return 'animation';
  if (extension === 'mp4' && mime === 'video/mp4') return 'video';
  if (['mp3', 'm4a'].includes(extension) && mime.startsWith('audio/')) return 'audio';
  return 'document';
}

export function mediaError(files, platform) {
  if (
    platform === 'youtube' &&
    (files.length !== 1 || mediaKind(files[0]) !== 'video' || mimeOf(files[0]) !== 'video/mp4')
  )
    return 'Для YouTube выберите одно MP4-видео до 50 МБ';
  const empty = files.find((file) => !file.size);
  if (empty) return `Файл «${empty.name}» пуст`;
  const oversized = files.find((file) => file.size > maxUploadBytes);
  if (oversized) return `Файл «${oversized.name}» превышает 50 МБ`;
  const largePhoto = files.find((file) => mediaKind(file) === 'photo' && file.size > maxPhotoBytes);
  if (largePhoto) return `Фото «${largePhoto.name}» превышает 10 МБ`;
  if (
    files.length > maxFiles ||
    files.reduce((total, file) => total + Number(file.size), 0) > maxUploadBytes
  )
    return 'Выберите до 10 файлов общим размером до 50 МБ';
  return '';
}
