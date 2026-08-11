import express from 'express';
import { getCafes } from './services/overpass.js';

const app = express();

const PORT = 3000;

app.get('/', (req, res) => {
    res.send("Backend");
});

app.get('/api/places', async (req, res) => {
    const places = await getCafes();
    res.json(places);
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});



