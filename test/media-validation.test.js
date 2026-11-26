import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mediaError, mediaKind } from '../client/lib/media.js';

const file = (name, type, size = 1024) => ({ name, type, size });

test('Типы и ограничения файлов одинаковы для формы и медиатеки', () => {
  assert.equal(mediaKind(file('photo.jpg', 'image/jpeg')), 'photo');
  assert.equal(mediaKind(file('video.mp4', 'video/mp4')), 'video');
  assert.equal(mediaKind(file('report.pdf', 'application/pdf')), 'document');
  assert.match(mediaError([file('empty.pdf', 'application/pdf', 0)]), /пуст/);
  assert.match(mediaError([file('photo.jpg', 'image/jpeg', 11 * 1024 * 1024)]), /10 МБ/);
});

test('YouTube принимает ровно одно MP4-видео', () => {
  assert.equal(mediaError([file('video.mp4', 'video/mp4')], 'youtube'), '');
  assert.match(mediaError([file('audio.mp3', 'audio/mpeg')], 'youtube'), /MP4/);
  assert.match(
    mediaError([file('one.mp4', 'video/mp4'), file('two.mp4', 'video/mp4')], 'youtube'),
    /одно MP4-видео/,
  );
});
