import { MotionConfig } from 'motion/react';
import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import FlowerFieldLoading from './field/FlowerFieldLoading';
import Stroll from './pages/Stroll';

const Demo = lazy(() => import('./pages/Demo'));
const FlowerDesignStudio = lazy(() => import('./pages/flower-studio/FlowerDesignStudio'));

export default function App() {
	return (
		<MotionConfig reducedMotion="user">
			<Suspense fallback={<FlowerFieldLoading />}>
				<Routes>
					<Route path="/" element={<Stroll />} />
					<Route path="/demo" element={<Demo />} />
					<Route path="/flower-studio" element={<FlowerDesignStudio />} />
					<Route path="*" element={<Navigate to="/" replace />} />
				</Routes>
			</Suspense>
		</MotionConfig>
	);
}
