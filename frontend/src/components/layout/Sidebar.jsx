import { Link, useLocation } from 'react-router-dom';

export default function Sidebar() {
    const { pathname } = useLocation();

    const item = (path, label) => (
        <Link
            to={path}
            className={`px-4 py-2 rounded-lg transition ${
                pathname === path
                    ? 'bg-primary text-white'
                    : 'text-gray-300 hover:bg-gray-800'
            }`}
        >
            {label}
        </Link>
    );

    return (
        <div className="w-64 bg-gray-900 text-white flex flex-col p-4">
            <h2 className="text-2xl font-bold mb-8">DengueWatch</h2>

            <nav className="flex flex-col gap-2">
                {item('/', 'Dashboard')}
                {item('/input', 'Dengue Input')}
                {item('/logs', 'Logs')}
            </nav>
        </div>
    );
}