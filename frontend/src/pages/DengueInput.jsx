import DengueTableInput from '../components/dengue/DengueTableInput';
import CsvUpload from '../components/dengue/CsvUpload';

export default function DengueInput() {
    return (
        <div className="space-y-6">

            <div className="bg-card p-6 rounded-2xl shadow border">
                <h2 className="text-lg font-semibold mb-4">
                    Manual Entry
                </h2>
                <DengueTableInput />
            </div>

            <div className="bg-card p-6 rounded-2xl shadow border">
                <h2 className="text-lg font-semibold mb-4">
                    Upload CSV
                </h2>
                <CsvUpload />
            </div>

        </div>
    );
}