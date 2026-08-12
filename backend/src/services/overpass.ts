import { categories, type PlaceCategory } from '../../../shared/data/categories';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

export type Place = {
    id: number;
    name: string;
    lat: number;
    lon: number;
    category: string;
};

function findCategory(value: string): PlaceCategory | undefined {
    for (const group of Object.values(categories)) {
        const place = group.places.find(place => place.value === value);

        if (place) {
            return place;
        }
    }

    return undefined;
}

export async function getPlaces(
    category: string,
    south: number,
    west: number,
    north: number,
    east: number
): Promise<Place[]> {

    const categoryInfo = findCategory(category);

    if (!categoryInfo) {
        throw new Error(`Unknown category: ${category}`);
    }

    const query = `
        [out:json];

        node
            ["${categoryInfo.key}"="${categoryInfo.osmValue}"]
            (${south},${west},${north},${east});

        out;
    `;

    console.log('Overpass query:', query);

    const response = await fetch(OVERPASS_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain',
            'User-Agent': 'CityExplorer/1.0'
        },
        body: query
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
        const errorText = await response.text();

        throw new Error(
            `Overpass request failed: ${response.status} ${errorText}`
        );
    }

    const data = await response.json();

    return data.elements.map((place: any) => ({
        id: place.id,
        name: place.tags?.name ?? 'Unnamed place',
        lat: place.lat,
        lon: place.lon,
        category: category
    }));
}