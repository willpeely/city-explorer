import express from 'express';
import cors from 'cors'
import { getPlaces } from './services/overpass.js';

const app = express();

const PORT = 3000;

app.use(cors())

app.get('/', (req, res) => {
    res.send("Backend");
});

app.get('/api/places', async (req, res) => {
    try {
        const {
            category,
            south,
            west,
            north,
            east
        } = req.query;

        const places = await getPlaces(
            category,
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



