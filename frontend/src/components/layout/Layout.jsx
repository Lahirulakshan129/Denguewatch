import Sidebar from './Sidebar';
import Header from './Header';
export default function Layout({ children }) {
    return (
        <div className="flex h-screen bg-bg">
            <Sidebar />

            <div className="flex-1 flex flex-col">
                <Header />
                <main className="p-6 overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
