import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import './index.css';
import App from './App';

// scrolling the mouse wheel over a focused number box must not change its value
document.addEventListener('wheel', () => { const a = document.activeElement; if (a && a.tagName === 'INPUT' && a.type === 'number') a.blur(); }, { passive: true });

// people who ask their system for reduced motion get no movement animations (fades stay)
createRoot(document.getElementById('root')).render(<MotionConfig reducedMotion="user"><App /></MotionConfig>);
