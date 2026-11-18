import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import './index.css';
import App from './App';

// people who ask their system for reduced motion get no movement animations (fades stay)
createRoot(document.getElementById('root')).render(<MotionConfig reducedMotion="user"><App /></MotionConfig>);
