import { uploadCSV } from '../../api/weatherApi';

export default function CsvUpload() {
    const handleFile = async (e) => {
        await uploadCSV(e.target.files[0]);
        alert('Uploaded');
    };

    return <input type="file" accept=".csv" onChange={handleFile} />;
}