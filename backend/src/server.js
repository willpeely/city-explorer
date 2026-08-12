import express from 'express';
import cors from 'cors'
import { getCafes } from './services/overpass.js';

const app = express();

const PORT = 3000;

app.use(cors())

app.get('/', (req, res) => {
    res.send("Backend");
});

app.get('/api/places', async (req, res) => {
    try {
        const { south, west, north, east } = req.query;

        const places = await getCafes(
            Number(south),
            Number(west),
            Number(north),
            Number(east)
        );

        res.json(places);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Failed to fetch places'
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});



