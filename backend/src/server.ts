import express from 'express';
import cors from 'cors';

import { getPlaces } from './services/overpass.ts';

const app = express();

const PORT = 3000;

app.use(cors());

app.get('/', (req, res) => {
    res.send('Backend');
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

        if (
            typeof category !== 'string' ||
            typeof south !== 'string' ||
            typeof west !== 'string' ||
            typeof north !== 'string' ||
            typeof east !== 'string'
        ) {
            return res.status(400).json({
                error: 'Missing or invalid parameters'
            });
        }

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