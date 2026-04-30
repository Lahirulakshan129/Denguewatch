import useWeather from '../hooks/useWeather';
import StatCard from '../components/dashboard/StatCard';
import PredictionChart from '../components/dashboard/PredictionChart';
import { Card } from '../components/common/Card';

export default function Dashboard() {
    const { data } = useWeather();

    return (
        <div className="space-y-6">

            {/* KPI ROW */}
            <div className="grid grid-cols-4 gap-4">
                <StatCard title="Districts" value={data.length} />
                <StatCard title="High Risk" value="5" />
                <StatCard title="Avg Temp" value="27°C" />
                <StatCard title="Rainfall" value="42mm" />
            </div>

            {/* CHART */}
            <Card title="Predicted Dengue Cases">
                <PredictionChart data={data} />
            </Card>

        </div>
    );
}