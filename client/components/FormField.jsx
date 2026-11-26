import React from 'react';

export function FieldError({name,message}) {
  return message ? <p id={'error-'+name} className="fieldError" role="alert">{message}</p> : null;
}
export function FormField({name,label,message,children}) {
  const id='field-'+name;
  return <div className="formField"><label htmlFor={id}>{label}</label>
    {React.cloneElement(children,{id,name,'aria-invalid':Boolean(message),'aria-describedby':message?'error-'+name:undefined})}
    <FieldError name={name} message={message}/>
  </div>;
}
export function validateForm(form) {
  const fields={};
  for (const input of form.elements) {
    if (!input.name || !input.validity || input.validity.valid) continue;
    if (input.validity.valueMissing) fields[input.name]='Заполните это поле';
    else if (input.validity.typeMismatch) fields[input.name]=input.type==='email'?'Введите корректный email':'Введите полный адрес ссылки';
    else if (input.validity.tooShort) fields[input.name]='Введите не менее '+input.minLength+' символов';
    else if (input.validity.tooLong) fields[input.name]='Допустимо не более '+input.maxLength+' символов';
    else fields[input.name]='Проверьте значение';
  }
  return fields;
}
export function focusFirstError(form,fields) {
  const input=Array.from(form.elements).find(input=>fields[input.name]);
  if(input) input.focus();
  else if(fields.body) form.querySelector('[role="textbox"]')?.focus();
}
