// Адаптировано из Rare UI: swamimalode07/rare-ui/duration-picker.
// Стили заменены на CSS проекта, подписи и пределы — на время суток.
import { Slot } from '@radix-ui/react-slot';
import { getSvgPath } from 'figma-squircle';
import { interpolate } from 'flubber';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  useVelocity,
} from 'motion/react';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import useMeasure from 'react-use-measure';

const PEN_PATH =
  'M3.78181 16.3092L3 21L7.69086 20.2182C8.50544 20.0825 9.25725 19.6956 9.84119 19.1116L20.4198 8.53288C21.1934 7.75922 21.1934 6.5049 20.4197 5.73126L18.2687 3.58024C17.495 2.80658 16.2406 2.80659 15.4669 3.58027L4.88841 14.159C4.30447 14.7429 3.91757 15.4947 3.78181 16.3092Z';
const TICK_PATH =
  'M7.959 20.513L1.592 12.872L3.128 11.592L8.041 17.487L20.947 3.587L22.413 4.948L7.959 20.513Z';
const OPEN_GAP = 8;
const CORNER_RADIUS = 8;
const GAP_SPRING = { stiffness: 200, damping: 28, mass: 1 };
const ICON_SPRING = { stiffness: 200, damping: 28 };
const WIDTH_SPRING = { stiffness: 250, damping: 31 };
const SWAY_SPRING = { stiffness: 200, damping: 24 };
const ERROR_SPRING = { stiffness: 700, damping: 9 };
const MotionSlot = motion.create(Slot);
const radiusValue = (radius) => (typeof radius === 'number' ? radius : radius.get());
const SquircleSegment = ({
  asChild,
  cornerSmoothing = 1,
  leftRadius,
  rightRadius,
  className,
  style,
  children,
}) => {
  const Component = asChild ? MotionSlot : motion.div;
  const [ref, bounds] = useMeasure();
  const width = useMotionValue(0);
  const height = useMotionValue(0);
  useEffect(() => {
    width.set(bounds.width);
    height.set(bounds.height);
  }, [bounds.width, bounds.height, width, height]);
  const clipPath = useTransform(() => {
    const w = width.get();
    const h = height.get();
    if (w <= 0 || h <= 0) {
      return 'none';
    }
    const left = radiusValue(leftRadius);
    const right = radiusValue(rightRadius);
    const path = getSvgPath({
      width: w,
      height: h,
      topLeftCornerRadius: left,
      bottomLeftCornerRadius: left,
      topRightCornerRadius: right,
      bottomRightCornerRadius: right,
      cornerSmoothing,
    });
    return `path('${path}')`;
  });
  return (
    <Component
      data-slot="duration-picker-segment"
      ref={ref}
      className={className}
      style={{ ...style, clipPath }}
    >
      {children}
    </Component>
  );
};
const DurationField = ({
  value,
  onValueChange,
  max,
  isEditing,
  shouldReduceMotion,
  disabled,
  swayX,
  inputRef,
}) => {
  const measureRef = useRef(null);
  const [textWidth, setTextWidth] = useState(0);
  const errorX = useSpring(0, ERROR_SPRING);
  const x = useTransform(() => swayX.get() + errorX.get());
  useLayoutEffect(() => {
    if (measureRef.current) {
      setTextWidth(measureRef.current.offsetWidth);
    }
  }, [value]);
  const handleChange = (event) => {
    const next = event.target.value.replace(/[^0-9]/g, '');
    if (next !== '' && (Number(next) > max || Number(next) < 0)) {
      onValueChange(String(Math.min(max, Math.max(0, Number(next)))));
      if (!shouldReduceMotion) {
        errorX.jump(6);
        errorX.set(0);
      }
      return;
    }
    onValueChange(next);
  };
  const collapsedWidth = Math.max(textWidth + 12, 22);
  return (
    <>
      <motion.input
        data-slot="duration-picker-input"
        ref={inputRef}
        type="number"
        min={0}
        max={max}
        step={1}
        aria-label={max === 23 ? 'Часы' : 'Минуты'}
        value={value}
        onChange={handleChange}
        placeholder={isEditing ? '' : '0'}
        readOnly={!isEditing}
        disabled={disabled}
        style={{ x, width: isEditing ? 44 : collapsedWidth }}
        animate={{ width: isEditing ? 44 : collapsedWidth }}
        transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', ...WIDTH_SPRING }}
        className="durationInput"
      />
      <span ref={measureRef} aria-hidden className="durationMeasure">
        {value || '0'}
      </span>
    </>
  );
};
const clampField = (raw, max) => Math.min(max, Math.max(0, Math.trunc(raw) || 0));
function DurationPicker({
  value,
  defaultValue,
  onChange,
  onConfirm,
  onEditingChange,
  defaultEditing = false,
  maxHours = 23,
  maxMinutes = 59,
  hoursLabel = 'ч',
  minutesLabel = 'мин',
  disabled = false,
  className,
  ...props
}) {
  const isControlled = value !== void 0;
  const [isEditing, setIsEditing] = useState(defaultEditing);
  const [hoursText, setHoursText] = useState(() => fieldText(value ?? defaultValue, 'hours'));
  const [minutesText, setMinutesText] = useState(() => fieldText(value ?? defaultValue, 'minutes'));
  useEffect(() => {
    if (!isControlled) {
      return;
    }
    if (clampField(Number(hoursText), maxHours) !== clampField(value.hours, maxHours)) {
      setHoursText(fieldText(value, 'hours'));
    }
    if (clampField(Number(minutesText), maxMinutes) !== clampField(value.minutes, maxMinutes)) {
      setMinutesText(fieldText(value, 'minutes'));
    }
  }, [isControlled, value?.hours, value?.minutes, maxHours, maxMinutes]);
  const toValue = (hours, minutes) => ({
    hours: clampField(Number(hours), maxHours),
    minutes: clampField(Number(minutes), maxMinutes),
  });
  const handleHoursChange = (text) => {
    setHoursText(text);
    onChange?.(toValue(text, minutesText));
  };
  const handleMinutesChange = (text) => {
    setMinutesText(text);
    onChange?.(toValue(hoursText, text));
  };
  const shouldReduceMotion = useReducedMotion();
  const gap = useSpring(defaultEditing ? OPEN_GAP : 0, GAP_SPRING);
  const openness = (v) => Math.min(OPEN_GAP, Math.max(0, v)) / OPEN_GAP;
  const segmentSpacing = useTransform(
    gap,
    (v) => `${Math.min(OPEN_GAP, Math.max(0, v)) - (1 - openness(v))}px`,
  );
  const innerRadius = useTransform(gap, (v) => CORNER_RADIUS * openness(v));
  const innerPadRight = useTransform(gap, (v) => `${3 + 9 * openness(v)}px`);
  const innerPadLeft = useTransform(gap, (v) => `${9 * openness(v)}px`);
  const gapVelocity = useVelocity(gap);
  const swayXRaw = useTransform(gapVelocity, [-70, 0, 70], [-3, 0, 3], { clamp: true });
  const swayX = useSpring(swayXRaw, SWAY_SPRING);
  const iconProgress = useSpring(defaultEditing ? 1 : 0, ICON_SPRING);
  const iconPath = useTransform(iconProgress, [0, 1], [PEN_PATH, TICK_PATH], {
    clamp: true,
    mixer: (from, to) => interpolate(from, to, { maxSegmentLength: 1 }),
  });
  const iconStrokeWidth = useTransform(iconProgress, [0, 1], [0, 2.5], { clamp: true });
  const iconStrokeOpacity = useTransform(iconProgress, [0, 1], [0, 1], { clamp: true });
  const iconDashOpacity = useTransform(iconProgress, [0, 0.4], [1, 0], { clamp: true });
  const hoursInputRef = useRef(null);
  const toggleEdit = () => {
    if (disabled) {
      return;
    }
    const next = !isEditing;
    const targetGap = next ? OPEN_GAP : 0;
    const targetIcon = next ? 1 : 0;
    if (shouldReduceMotion) {
      gap.jump(targetGap);
      iconProgress.jump(targetIcon);
    } else {
      gap.set(targetGap);
      iconProgress.set(targetIcon);
    }
    setIsEditing(next);
    onEditingChange?.(next);
    if (next) {
      hoursInputRef.current?.focus();
    } else {
      onConfirm?.(toValue(hoursText, minutesText));
    }
  };
  return (
    <motion.div
      data-slot="duration-picker"
      data-editing={isEditing || void 0}
      data-disabled={disabled || void 0}
      className={['durationPicker', className].filter(Boolean).join(' ')}
      {...props}
    >
      <SquircleSegment
        leftRadius={CORNER_RADIUS}
        rightRadius={innerRadius}
        style={{ paddingRight: innerPadRight }}
        className="durationSegment durationHours"
      >
        <DurationField
          value={hoursText}
          onValueChange={handleHoursChange}
          max={maxHours}
          isEditing={isEditing}
          shouldReduceMotion={!!shouldReduceMotion}
          disabled={disabled}
          swayX={swayX}
          inputRef={hoursInputRef}
        />
        <motion.span style={{ x: swayX }} className="durationLabel">
          {hoursLabel}
        </motion.span>
      </SquircleSegment>
      <SquircleSegment
        leftRadius={innerRadius}
        rightRadius={innerRadius}
        style={{
          marginLeft: segmentSpacing,
          paddingLeft: innerPadLeft,
          paddingRight: innerPadRight,
        }}
        className="durationSegment"
      >
        <DurationField
          value={minutesText}
          onValueChange={handleMinutesChange}
          max={maxMinutes}
          isEditing={isEditing}
          shouldReduceMotion={!!shouldReduceMotion}
          disabled={disabled}
          swayX={swayX}
        />
        <motion.span style={{ x: swayX }} className="durationLabel">
          {minutesLabel}
        </motion.span>
      </SquircleSegment>
      <SquircleSegment
        asChild
        leftRadius={innerRadius}
        rightRadius={CORNER_RADIUS}
        style={{ marginLeft: segmentSpacing }}
      >
        <button
          data-slot="duration-picker-toggle"
          type="button"
          onClick={toggleEdit}
          disabled={disabled}
          aria-label={isEditing ? 'Подтвердить время' : 'Изменить время'}
          className="durationToggle"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18">
            <motion.path
              fill="#868593"
              stroke="#868593"
              strokeWidth={0}
              strokeLinejoin="round"
              strokeLinecap="round"
              style={{ strokeWidth: iconStrokeWidth, strokeOpacity: iconStrokeOpacity }}
              d={iconPath}
            />
            <motion.path
              d="M14 6L18 10"
              fill="none"
              strokeWidth={1.5}
              strokeLinecap="round"
              className="durationIconCut"
              style={{ opacity: iconDashOpacity }}
            />
          </svg>
        </button>
      </SquircleSegment>
    </motion.div>
  );
}
function fieldText(value, field) {
  const n = value?.[field];
  return n === void 0 || n === 0 ? '' : String(n);
}
export { DurationPicker };
