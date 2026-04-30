import { triggerJob } from '../../api/weatherApi';

export default function Header() {
    return (
        <div className="flex justify-between items-center bg-white px-6 py-4 border-b">
            <div>
                <h1 className="text-xl font-semibold text-text">Dashboard</h1>
                <p className="text-sm text-muted">Monitor dengue predictions</p>
            </div>

            <button
                onClick={triggerJob}
                className="bg-primary hover:opacity-90 text-white px-4 py-2 rounded-lg shadow"
            >
                Run Pipeline
            </button>
        </div>
    );
}