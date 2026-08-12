import { useState } from 'react';

import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    useMap
} from 'react-leaflet';

import type { Map as LeafletMap } from 'leaflet';

import 'leaflet/dist/leaflet.css';
import './Map.css';

type Place = {
    id: number;
    name: string;
    lat: number;
    lon: number;
};

type Category = {
    value: string;
    label: string;
};

const categories: Category[] = [
    { value: 'cafe', label: 'Cafes' },
    { value: 'restaurant', label: 'Restaurants' },
    { value: 'pub', label: 'Pubs' },
    { value: 'museum', label: 'Museums' },
    { value: 'park', label: 'Parks' }
];

function FindPlacesButton({
    onFind,
    loading
}: {
    onFind: (map: LeafletMap) => void;
    loading: boolean;
}) {
    const map = useMap();

    return (
        <button
            className="find-places-button"
            onClick={() => onFind(map)}
            disabled={loading}
        >
            {loading ? 'Loading...' : 'Search'}
        </button>
    );
}

function Map() {
    const [places, setPlaces] = useState<Place[]>([]);
    const [loading, setLoading] = useState(false);
    const [category, setCategory] = useState('cafe');

    async function loadPlaces(map: LeafletMap) {
        setLoading(true);

        const bounds = map.getBounds();

        const params = new URLSearchParams({
            category: category,
            south: bounds.getSouth().toString(),
            west: bounds.getWest().toString(),
            north: bounds.getNorth().toString(),
            east: bounds.getEast().toString()
        });

        console.log('Request:', params.toString());

        try {
            const response = await fetch(
                `http://localhost:3000/api/places?${params}`
            );

            if (!response.ok) {
                throw new Error(`Request failed: ${response.status}`);
            }

            const data: Place[] = await response.json();

            console.log('Places received:', data);

            setPlaces(data);

        } catch (error) {
            console.error('Failed to load places:', error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="map-wrapper">

            <div className="map-controls">

                <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                >
                    {categories.map(category => (
                        <option
                            key={category.value}
                            value={category.value}
                        >
                            {category.label}
                        </option>
                    ))}
                </select>

            </div>

            <MapContainer
                className="map"
                center={[54.0722, -1.9975]}
                zoom={19}
            >
                <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <FindPlacesButton
                    onFind={loadPlaces}
                    loading={loading}
                />

                {places.map(place => (
                    <Marker
                        key={place.id}
                        position={[place.lat, place.lon]}
                    >
                        <Popup>
                            {place.name}
                        </Popup>
                    </Marker>
                ))}

            </MapContainer>

        </div>
    );
}

export default Map;