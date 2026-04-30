import { useState } from 'react';
import { submitManual } from '../../api/weatherApi';

const districts = ["Colombo", "Kandy", "Galle"];

export default function DengueTableInput() {
    const [data, setData] = useState(
        districts.map(d => ({ district: d, cases: '' }))
    );

    const handleChange = (i, val) => {
        const updated = [...data];
        updated[i].cases = val;
        setData(updated);
    };

    const handleSubmit = async () => {
        await submitManual(data);
        alert('Saved');
    };

    return (
        <div>
            {data.map((row, i) => (
                <div key={i} className="flex gap-2 mb-2">
                    <span>{row.district}</span>
                    <input
                        className="border"
                        onChange={(e) => handleChange(i, e.target.value)}
                    />
                </div>
            ))}
            <button onClick={handleSubmit}>Save</button>
        </div>
    );
}