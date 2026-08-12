import { useState } from 'react';

import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    useMap
} from 'react-leaflet';

import type { Map as LeafletMap } from 'leaflet';

import { categories } from '../../../shared/data/categories';

import 'leaflet/dist/leaflet.css';
import './Map.css';

type Place = {
    id: number;
    name: string;
    lat: number;
    lon: number;
};

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

                {Object.entries(categories).map(([groupKey, group]) => (
                    <div key={groupKey} className="category-group">

                        <h3>{group.label}</h3>

                        <div className="category-buttons">

                            {group.places.map(place => (
                                <button
                                    key={place.value}
                                    className={
                                        category === place.value
                                            ? 'category-button selected'
                                            : 'category-button'
                                    }
                                    onClick={() => setCategory(place.value)}
                                >
                                    {place.label}
                                </button>
                            ))}

                        </div>

                    </div>
                ))}

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