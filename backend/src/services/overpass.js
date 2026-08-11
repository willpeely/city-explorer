const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

export async function getCafes() {
    console.log('Getting cafes from Overpass');

    const query = `
        [out:json];

        node
            ["amenity"="cafe"]
            (51.49,-0.15,51.52,-0.10);

        out;
    `;

    const response = await fetch(OVERPASS_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain',
            'User-Agent': 'CityExplorer/1.0'
        },
        body: query
    });

    if (!response.ok) {
        const errorText = await response.text();

        throw new Error(
            `Overpass request failed: ${response.status} ${errorText}`
        );
    }

    const data = await response.json();

    return data.elements.map(place => ({
        id: place.id,
        name: place.tags?.name ?? 'Unnamed cafe',
        lat: place.lat,
        lon: place.lon
    }));
}