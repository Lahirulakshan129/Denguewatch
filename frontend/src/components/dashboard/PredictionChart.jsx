import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';

export default function PredictionChart({ data }) {
    return (
        <LineChart width={500} height={300} data={data}>
            <XAxis dataKey="district" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="predicted_cases" />
        </LineChart>
    );
}