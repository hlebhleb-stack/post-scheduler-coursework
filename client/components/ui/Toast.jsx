// Адаптировано из Rare UI: swamimalode07/rare-ui/toast.
// Палитра, скругления и тексты приведены к оформлению проекта.
import React, { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { getSvgPath } from 'figma-squircle';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Toaster as Sonner, toast as sonner } from 'sonner';
const cn = (...names) => names.filter(Boolean).join(' ');
const PADDING = 10;
const TILE = 36;
const TILE_RADIUS = 8;
const CARD_RADIUS = 12;
const squircle = (width, height, radius) =>
  getSvgPath({ width, height, cornerRadius: radius, cornerSmoothing: 1 });
const TILE_CLIP = `path('${squircle(TILE, TILE, TILE_RADIUS)}')`;
const TONES = {
  success: 'toastBlue',
  error: 'toastRed',
  warning: 'toastAmber',
  info: 'toastBlue',
  loading: 'toastLoading',
};
const POP = { type: 'spring', stiffness: 520, damping: 30 };
const SETTLE = { type: 'spring', stiffness: 320, damping: 36 };
const DRAW = { duration: 0.3, delay: 0.1, ease: 'easeOut' };
const ARRIVAL = 0.32;
const INSTANT = { duration: 0 };
const LEAVE = { duration: 0.14, ease: 'easeOut' };
const BUMP = {
  duration: 0.4,
  delay: LEAVE.duration,
  ease: 'easeOut',
  times: [0, 0.4, 1],
};
function Glyph({ type, reduced, delay }) {
  const stroke = {
    initial: reduced ? false : { pathLength: 0 },
    animate: { pathLength: 1 },
    transition: reduced ? INSTANT : { ...DRAW, delay: DRAW.delay + delay },
  };
  if (type === 'loading') {
    return (
      <svg
        viewBox="0 0 24 24"
        className="toastGlyph toastSpinner"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.75}
        strokeLinecap="round"
      >
        <circle cx="12" cy="12" r="8" strokeOpacity={0.25} />
        <path d="M12 4a8 8 0 0 1 8 8" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      className="toastGlyph"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {type === 'success' && <motion.path d="M6 12.5l4 4 8-9" {...stroke} />}
      {type === 'error' && (
        <>
          <motion.path d="M7.5 7.5l9 9" {...stroke} />
          <motion.path d="M16.5 7.5l-9 9" {...stroke} />
        </>
      )}
      {type === 'warning' && (
        <>
          <motion.path d="M12 6v7" {...stroke} />
          <circle cx="12" cy="18" r="1.6" fill="currentColor" stroke="none" />
        </>
      )}
      {type === 'info' && (
        <>
          <circle cx="12" cy="6.25" r="1.6" fill="currentColor" stroke="none" />
          <motion.path d="M12 11v7" {...stroke} />
        </>
      )}
    </svg>
  );
}
function ToastIcon({ type }) {
  const reduced = useReducedMotion() ?? false;
  const [arrivingType] = useState(type);
  const settled = type !== arrivingType;
  const delay = settled ? 0 : ARRIVAL;
  return (
    <motion.span
      aria-hidden
      data-slot="toast-icon"
      initial={reduced ? false : { scale: 0.85, opacity: 0 }}
      animate={{ scale: settled ? [1, 1.08, 1] : 1, opacity: 1 }}
      transition={
        reduced ? INSTANT : settled ? { scale: BUMP } : { ...SETTLE, delay: ARRIVAL - 0.08 }
      }
      style={{ width: TILE, height: TILE, clipPath: TILE_CLIP }}
      className={cn('toastIcon', TONES[type])}
    >
      <AnimatePresence initial={!reduced} mode="wait">
        <motion.span
          key={type}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{
            scale: 0.5,
            opacity: 0,
            transition: reduced ? INSTANT : LEAVE,
          }}
          transition={reduced ? INSTANT : { ...POP, delay }}
          className="toastIconGlyph"
        >
          <Glyph type={type} reduced={reduced} delay={delay} />
        </motion.span>
      </AnimatePresence>
    </motion.span>
  );
}
function useBoxSize() {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() =>
      setSize({ width: el.offsetWidth, height: el.offsetHeight }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size];
}
function ToastCard({
  toastId,
  type,
  title,
  description,
  action,
  dismissible = true,
  className,
  ...props
}) {
  const [cardRef, { width, height }] = useBoxSize();
  const outline = width > 0 ? squircle(width, height, CARD_RADIUS) : null;
  return (
    <div
      data-slot="toast"
      data-type={type}
      role={type === 'error' ? 'alert' : 'status'}
      {...props}
      className={cn('toastCard', className)}
    >
      <div
        ref={cardRef}
        style={{
          padding: PADDING,
          borderRadius: CARD_RADIUS,
          clipPath: outline ? `path('${outline}')` : void 0,
        }}
        className="toastSurface"
      >
        {outline && (
          <svg aria-hidden width={width} height={height} className="toastOutline">
            {/* Внутренняя обводка толщиной 1 пиксель. */}
            <path d={outline} fill="none" strokeWidth={2} className="toastStroke" />
          </svg>
        )}
        {/* Текст задних уведомлений скрыт в свёрнутой стопке. */}
        <div className="toastContent">
          {type !== 'default' && <ToastIcon type={type} />}
          <div className={cn('toastText', type === 'default' && 'toastDefaultText')}>
            <p data-slot="toast-title" className="toastTitle">
              {title}
            </p>
            {description && (
              <p data-slot="toast-description" className="toastDescription">
                {description}
              </p>
            )}
          </div>
          {action && (
            <button
              type="button"
              data-slot="toast-action"
              onClick={() => {
                action.onClick();
                sonner.dismiss(toastId);
              }}
              style={{ borderRadius: TILE_RADIUS }}
              className="toastAction"
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
      {dismissible && (
        <button
          type="button"
          aria-label="Закрыть уведомление"
          data-slot="toast-close"
          onClick={() => sonner.dismiss(toastId)}
          className="toastClose"
        >
          <svg
            viewBox="0 0 24 24"
            className="toastCloseIcon"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M7 7l10 10M17 7L7 17" />
          </svg>
        </button>
      )}
    </div>
  );
}
function show(type, title, { description, action, ...options } = {}) {
  return sonner.custom(
    (id) => (
      <ToastCard
        toastId={id}
        type={type}
        title={title}
        description={description}
        action={action}
        dismissible={options.dismissible}
      />
    ),
    // Ожидание остаётся на экране до результата операции или закрытия.
    type === 'loading' ? { ...options, duration: options.duration ?? Infinity } : options,
  );
}
const message = (value, input) => (typeof value === 'function' ? value(input) : value);
function promise(task, messages, options = {}) {
  const id = show('loading', messages.loading, {
    ...options,
    duration: Infinity,
  });
  const settle = (type, title) => show(type, title, { ...options, id, duration: options.duration });
  const pending = typeof task === 'function' ? task() : task;
  pending
    .then((data) => settle('success', message(messages.success, data)))
    .catch((error) => settle('error', message(messages.error, error)));
  return pending;
}
const variant = (type) => (title, options) => show(type, title, options);
const toast = Object.assign(variant('default'), {
  success: variant('success'),
  error: variant('error'),
  warning: variant('warning'),
  info: variant('info'),
  loading: variant('loading'),
  promise,
  dismiss: sonner.dismiss,
});
const subscribe = () => () => {};
function Toaster({ position = 'bottom-right', gap = 10, toastOptions, ...props }) {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  if (!mounted) return null;
  return createPortal(
    <Sonner
      containerAriaLabel="Уведомления"
      position={position}
      gap={gap}
      {...props}
      toastOptions={{
        unstyled: true,
        ...toastOptions,
        classNames: {
          ...toastOptions?.classNames,
          toast: cn('rareToast', toastOptions?.classNames?.toast),
        },
      }}
    />,
    document.body,
  );
}
export { ToastCard, Toaster, toast };
