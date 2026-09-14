import express from 'express';
import cors from 'cors';

import { getPlaces } from './services/overpass.ts';
import { getRoute, getDistanceMatrix } from './services/openroute.js';
import { optimiseRoute } from './services/routeOptimiser.ts';

const app = express();

const PORT = 3000;

app.use(cors());
app.use(express.json())

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

app.post('/api/route', async (req, res) => {

    try {

        const { places, optimise } = req.body;

        if (!Array.isArray(places)) {
            return res.status(400).json({
                error: 'Places must be an array'
            });
        }

        if (places.length < 2) {
            return res.status(400).json({
                error: 'At least two places are required'
            });
        }

        let routePlaces = places;

        if (optimise) {
            const distances = await getDistanceMatrix(places);

            routePlaces = optimiseRoute(
                places,
                distances
            );

            console.log('Optimised order:', routePlaces.map(place => place.name));
        }

        const route = await getRoute(routePlaces);

        res.json(route);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: 'Failed to generate route'
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});