import axios from 'axios';

const BASE = 'http://localhost:3001';

export const getPredictions = () => axios.get(`${BASE}/weather/predictions`);
export const getLogs = () => axios.get(`${BASE}/weather/logs`);
export const triggerJob = () => axios.post(`${BASE}/weather/trigger`);

export const uploadCSV = (file) => {
    const formData = new FormData();
    formData.append('file', file);

    return axios.post(`${BASE}/dengue/upload`, formData);
};

export const submitManual = (data) =>
    axios.post(`${BASE}/dengue/manual`, data);