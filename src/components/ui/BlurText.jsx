import { useRef, useEffect, useState, useMemo } from 'react';
import { motion } from 'motion/react';

const BlurText = ({
  text = '',
  delay = 200,
  className = '',
  animateBy = 'words',
  direction = 'top',
  threshold = 0.1,
  rootMargin = '0px',
  stepDuration = 0.35,
}) => {
  const elements = animateBy === 'words' ? text.split(' ') : text.split('');
  const [inView, setInView] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold, rootMargin }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold, rootMargin]);

  const defaultFrom = useMemo(() => (
    direction === 'top' ? { filter: 'blur(10px)', opacity: 0, y: -10 }
      : { filter: 'blur(10px)', opacity: 0, y: 10 }
  ), [direction]);

  const defaultTo = { filter: 'blur(0px)', opacity: 1, y: 0 };

  return (
    <p ref={ref} className={`blur-text-wrapper ${className}`} style={{ display: 'flex', flexWrap: 'wrap' }}>
      {elements.map((el, i) => (
        <motion.span
          key={i}
          initial={defaultFrom}
          animate={inView ? defaultTo : defaultFrom}
          transition={{ duration: stepDuration, delay: i * (delay / 1000) }}
          style={{ display: 'inline-block', willChange: 'transform, filter, opacity' }}
        >
          {el === ' ' ? '\u00A0' : el}
          {animateBy === 'words' && i < elements.length - 1 ? '\u00A0' : ''}
        </motion.span>
      ))}
    </p>
  );
};

export default BlurText;
