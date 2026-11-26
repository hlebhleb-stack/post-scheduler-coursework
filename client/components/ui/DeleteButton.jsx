// Адаптировано из Rare UI: swamimalode07/rare-ui/delete-button.
// Подтверждение ожидает результат API, оформление использует стили проекта.
import React, { useEffect, useRef, useState } from 'react';
import {
  animate,
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'motion/react';
const cn = (...names) => names.filter(Boolean).join(' ');
const HINGE = '3px 6px';
const LID_OPEN = -35;
const WALL_TOP = 6;
const WALL_TOP_OPEN = 13.5;
const WALL_BASE = 20;
const TILE = 48;
const PANEL = 84;
const HOLD = { deleted: 1400, kept: 600 };
const EASE = [0.32, 0.72, 0, 1];
const EASE_LID = [0.34, 1.1, 0.64, 1];
const WIDTH = { duration: 0.62, ease: EASE };
const LID = { duration: 0.6, ease: EASE_LID };
const WALL = { duration: 0.56, ease: EASE };
const IN = { duration: 0.44, ease: EASE, delay: 0.14 };
const OUT = { duration: 0.3, ease: EASE };
const TAP = { duration: 0.2, ease: EASE };
const SWAP = { duration: 0.22, ease: EASE };
const SETTLE = { duration: 0.45, ease: EASE };
const PRESS = {
  type: 'spring',
  stiffness: 520,
  damping: 18,
  mass: 0.5,
};
const INSTANT = { duration: 0 };
const SURFACE = 'deleteSurface';
const RECESS = 'deleteRecess';
const GLYPH = 'deleteGlyph';
const FOCUS = 'deleteFocus';
const ACCENT = '#c9342d';
const CIRCLE = 'deleteChoice';
const ICON = {
  viewBox: '0 0 24 24',
  fill: 'none',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};
const panelMotion = {
  hidden: { opacity: 0, x: -6, transition: OUT },
  shown: { opacity: 1, x: 0, transition: { ...IN, staggerChildren: 0.07 } },
};
const circleMotion = {
  hidden: { opacity: 0, scale: 0.9, transition: OUT },
  shown: { opacity: 1, scale: 1, transition: IN },
};
function Circle({ label, onClick, children, disabled }) {
  const reduced = useReducedMotion() ?? false;
  return (
    <motion.div className="deleteChoiceWrap" variants={reduced ? void 0 : circleMotion}>
      <motion.button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        whileHover={reduced ? void 0 : { scale: 1.03 }}
        whileTap={reduced ? void 0 : { scale: 0.84 }}
        transition={PRESS}
        className={CIRCLE}
      >
        <svg {...ICON} width="14" height="14" stroke="currentColor" strokeWidth="3.5">
          {children}
        </svg>
      </motion.button>
    </motion.div>
  );
}
function DeleteButton({
  className,
  onConfirm,
  onCancel,
  disabled = false,
  label = 'Удалить',
  ...props
}) {
  const reduced = useReducedMotion() ?? false;
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('idle');
  const trigger = useRef(null);
  const resolving = useRef(false);
  const [busy, setBusy] = useState(false);
  const timing = (transition) => (reduced ? INSTANT : transition);
  const top = useMotionValue(WALL_TOP);
  const wall = useTransform(top, (y) => WALL_BASE - y);
  const bin = useMotionTemplate`M19 ${top}v${wall}a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V${top}`;
  const settle = useMotionValue(1);
  useEffect(() => {
    const walls = animate(top, open ? WALL_TOP_OPEN : WALL_TOP, reduced ? INSTANT : WALL);
    return () => walls.stop();
  }, [open, reduced, top]);
  useEffect(() => {
    if (status === 'idle') return;
    const nudge = status === 'kept' && !reduced ? animate(settle, [1, 0.86, 1], SETTLE) : null;
    const done = setTimeout(() => setStatus('idle'), HOLD[status]);
    return () => {
      nudge?.stop();
      clearTimeout(done);
    };
  }, [status, reduced, settle]);
  const resolve = async (next) => {
    if (disabled || resolving.current) return;
    if (next === 'kept') {
      setOpen(false);
      setStatus('kept');
      trigger.current?.focus();
      onCancel?.();
      return;
    }
    resolving.current = true;
    setBusy(true);
    try {
      const success = await onConfirm?.();
      setOpen(false);
      setStatus(success === false ? 'idle' : 'deleted');
    } finally {
      resolving.current = false;
      setBusy(false);
      trigger.current?.focus();
    }
  };
  return (
    <motion.div
      data-slot="delete-button"
      data-state={open ? 'open' : 'closed'}
      data-status={status}
      className={cn('deleteButton', SURFACE, GLYPH, className)}
      animate={{ width: open ? TILE + PANEL : TILE }}
      transition={timing(WIDTH)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) resolve('kept');
      }}
      {...props}
    >
      <motion.button
        ref={trigger}
        type="button"
        aria-label={label}
        title={label}
        disabled={disabled || busy}
        aria-expanded={open}
        onClick={() => {
          if (disabled || busy) return;
          if (open) return resolve('kept');
          setStatus('idle');
          setOpen(true);
        }}
        whileTap={reduced ? void 0 : { scale: 0.94 }}
        transition={TAP}
        className={cn('deleteTrigger', FOCUS)}
      >
        <AnimatePresence mode="wait" initial={false}>
          {status === 'deleted' ? (
            <motion.svg
              key="done"
              {...ICON}
              width="20"
              height="20"
              stroke={ACCENT}
              strokeWidth="2.5"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={timing(SWAP)}
            >
              <motion.path
                d="M4 12.5 9.5 18 20 7"
                initial={reduced ? void 0 : { pathLength: 0 }}
                animate={reduced ? void 0 : { pathLength: 1 }}
                transition={SETTLE}
              />
            </motion.svg>
          ) : (
            <motion.svg
              key="bin"
              {...ICON}
              width="20"
              height="20"
              stroke="currentColor"
              strokeWidth="2"
              className="deleteBin"
              style={{ scale: settle }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={timing(SWAP)}
            >
              <motion.path d={bin} />
              <motion.g
                style={{ transformBox: 'view-box', transformOrigin: HINGE }}
                animate={{ rotate: open ? LID_OPEN : 0 }}
                transition={timing(LID)}
              >
                <path d="M3 6h18" />
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </motion.g>
            </motion.svg>
          )}
        </AnimatePresence>
      </motion.button>

      <span role="status" aria-live="polite" className="visuallyHidden">
        {status === 'deleted' ? 'Удалено' : status === 'kept' ? 'Удаление отменено' : ''}
      </span>

      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            style={{ width: PANEL }}
            className={cn('deletePanel', RECESS)}
            variants={reduced ? void 0 : panelMotion}
            initial="hidden"
            animate="shown"
            exit="hidden"
          >
            <span aria-hidden className={cn('deleteNotch', RECESS)} />
            <Circle
              disabled={disabled || busy}
              label="Подтвердить удаление"
              onClick={() => resolve('deleted')}
            >
              <path d="M4 12.5 9.5 18 20 7" stroke={ACCENT} />
            </Circle>
            <Circle
              disabled={disabled || busy}
              label="Отменить удаление"
              onClick={() => resolve('kept')}
            >
              <path d="M6 6 18 18M18 6 6 18" />
            </Circle>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
export { DeleteButton };
