const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

export async function getPlaces(category, south, west, north, east) {
    console.log('Getting cafes from Overpass');

    const query = `
        [out:json];

        node
            ["amenity"="${category}"]
            (${south},${west},${north},${east});
        out;
    `;

    console.log(query);

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

    return data.elements.map(place => ({
        id: place.id,
        name: place.tags?.name ?? 'Unnamed Place',
        lat: place.lat,
        lon: place.lon
    }));
}