import './FlowerFieldLoading.css';

export default function FlowerFieldLoading() {
	return (
		<div className="flower-field-loading" role="status" aria-live="polite">
			<span>Growing field</span>
			<div className="flower-field-loading-track" aria-hidden="true"><div /></div>
		</div>
	);
}
