import { error } from '../lib/http.js';
const hints = {
  email:'Введите корректный адрес электронной почты',
  password:'Пароль должен содержать от 8 до 72 байт',
  name:'Введите название допустимой длины',
  destination:'Проверьте имя или ID канала',
  token:'Введите токен доступа целиком',
  channel_id:'Выберите доступный канал',
  body:'Сократите текст публикации до допустимой длины',
  image_url:'Укажите полный адрес изображения, начинающийся с https://',
  scheduled_at:'Укажите корректные дату и время',
  status:'Выберите режим публикации',
};
export const fields = schema => (req,res,next) => {
  const result=schema.safeParse(req.body);
  if (!result.success) {
    const fieldErrors={};
    for (const issue of result.error.issues) {
      const name=issue.path[0];
      if (name && !fieldErrors[name]) {
        let message=issue.code==='custom' ? issue.message : hints[name] || 'Проверьте значение';
        if(issue.code==='too_small' && issue.minimum===1) message='Заполните это поле';
        if(issue.code==='too_big' && issue.origin==='string') message='Не более '+issue.maximum+' символов';
        fieldErrors[name]=message;
      }
    }
    return next(Object.assign(error(400,'Проверьте выделенные поля'),{fields:fieldErrors}));
  }
  req.input=result.data;
  next();
};
