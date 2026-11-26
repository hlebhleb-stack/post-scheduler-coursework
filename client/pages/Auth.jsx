import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { request } from '../services/api.js';
import { FormField, FieldError, validateForm, focusFirstError } from '../components/FormField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
export default function Auth({ register }) {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const invalid = validateForm(form);
    setFieldErrors(invalid);
    if (Object.keys(invalid).length) {
      focusFirstError(form, invalid);
      return;
    }
    const input = Object.fromEntries(new FormData(form));
    setPending(true);
    setError('');
    try {
      if (register) await request('auth/register', { method: 'POST', body: input });
      const session = await request('auth/login', { method: 'POST', body: input });
      login(session);
      navigate('/overview');
    } catch (error) {
      setFieldErrors(error.fields || {});
      setError(Object.keys(error.fields || {}).length ? '' : error.message);
      focusFirstError(form, error.fields || {});
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="auth">
      <form
        className="authForm"
        noValidate
        onSubmit={submit}
        onChange={(event) =>
          setFieldErrors((current) => ({ ...current, [event.target.name]: undefined }))
        }
      >
        <div className="authHeading">
          <h1>{register ? 'Создать аккаунт' : 'С возвращением'}</h1>
          <p>
            {register
              ? 'Зарегистрируйтесь, чтобы планировать публикации.'
              : 'Войдите в свой планировщик.'}
          </p>
        </div>
        <FormField name="email" label="Электронная почта" message={fieldErrors.email}>
          <input type="email" autoComplete="email" placeholder="name@example.com" required />
        </FormField>
        <div className="passwordGroup">
          <label htmlFor="auth-password">Пароль</label>
          <div className="passwordField">
            <input
              id="auth-password"
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? 'error-password' : undefined}
              type={showPassword ? 'text' : 'password'}
              autoComplete={register ? 'new-password' : 'current-password'}
              name="password"
              minLength={register ? 8 : undefined}
              placeholder={register ? 'Минимум 8 символов' : 'Введите пароль'}
              required
            />
            <button
              type="button"
              aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <FieldError name="password" message={fieldErrors.password} />
        </div>
        {error && (
          <p className="inlineError" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={pending}>
          {pending ? 'Подождите…' : register ? 'Зарегистрироваться' : 'Войти'}
        </button>
        <p className="authSwitch">
          {register ? 'Уже есть аккаунт?' : 'Нет аккаунта?'}{' '}
          <Link to={register ? '/login' : '/register'}>
            {register ? 'Войти' : 'Зарегистрироваться'}
          </Link>
        </p>
      </form>
    </main>
  );
}
