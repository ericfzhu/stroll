import { MotionConfig } from 'motion/react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Demo from './pages/Demo';
import FlowerDesignStudio from './pages/flower-studio/FlowerDesignStudio';
import Stroll from './pages/Stroll';

export default function App() {
	return (
		<MotionConfig reducedMotion="user">
			<Routes>
				<Route path="/" element={<Stroll />} />
				<Route path="/demo" element={<Demo />} />
				<Route path="/flower-studio" element={<FlowerDesignStudio />} />
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</MotionConfig>
	);
}
