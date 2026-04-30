export default function StatCard({ title, value, icon }) {
    return (
        <div className="bg-card p-5 rounded-2xl shadow-sm border">
            <div className="flex justify-between items-center">
                <h4 className="text-sm text-muted">{title}</h4>
                <span>{icon}</span>
            </div>

            <p className="text-2xl font-semibold mt-2 text-text">
                {value}
            </p>
        </div>
    );
}