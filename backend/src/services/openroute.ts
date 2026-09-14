import 'dotenv/config';

const ORS_URL = 'https://api.openrouteservice.org/v2/directions/foot-walking/geojson';

const ORS_MATRIX_URL = 'https://api.openrouteservice.org/v2/matrix/foot-walking';

type Coordinate = {
    lat: number;
    lon: number;
};

export async function getRoute(
    places: Coordinate[]
) {

    if (places.length < 2) {
        throw new Error('At least two places are required');
    }

    const coordinates = places.map(place => [
        place.lon,
        place.lat
    ]);

    const response = await fetch(ORS_URL, {
        method: 'POST',

        headers: {
            'Authorization': process.env.ORS_API_KEY ?? '',
            'Content-Type': 'application/json'
        },

        body: JSON.stringify({
            coordinates
        })
    });

    if (!response.ok) {

        const errorText = await response.text();

        throw new Error(
            `OpenRouteService request failed: ${response.status} ${errorText}`
        );
    }

    return await response.json();
}

export async function getDistanceMatrix(
    places: Coordinate[]
) {

    if (places.length < 2) {
        throw new Error('At least two places are required');
    }

    const locations = places.map(place => [
        place.lon,
        place.lat
    ]);

    const response = await fetch(ORS_MATRIX_URL, {
        method: 'POST',

        headers: {
            'Authorization': process.env.ORS_API_KEY ?? '',
            'Content-Type': 'application/json'
        },

        body: JSON.stringify({
            locations,
            metrics: ['distance']
        })
    });

    if (!response.ok) {

        const errorText = await response.text();

        throw new Error(
            `OpenRouteService matrix request failed: ${response.status} ${errorText}`
        );
    }

    const data = await response.json();

    return data.distances;
}