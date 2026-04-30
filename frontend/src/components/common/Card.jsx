export function Card({ title, children }) {
    return (
        <div className="bg-card p-6 rounded-2xl shadow-sm border">
            <h3 className="text-lg font-semibold mb-4">{title}</h3>
            {children}
        </div>
    );
}