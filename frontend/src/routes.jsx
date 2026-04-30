import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import DengueInput from './pages/DengueInput';
import Logs from './pages/Logs';
import Layout from './components/layout/Layout';

export default function AppRoutes() {
    return (
        <BrowserRouter>
            <Layout>
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/input" element={<DengueInput />} />
                    <Route path="/logs" element={<Logs />} />
                </Routes>
            </Layout>
        </BrowserRouter>
    );
}
