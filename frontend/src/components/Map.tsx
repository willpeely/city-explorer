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
import './Map.css'

type Place = {
    id: number;
    name: string;
    lat: number;
    lon: number;
};

function FindCafesButton({onFind, loading}: {onFind: (map: LeafletMap) => void; loading: boolean;}) {

    const map = useMap();

    return (
        <button className="find-cafes-button" onClick={() => onFind(map)} disabled={loading}>
            {loading ? 'Loading...' : 'Find Cafes'}
        </button>
    );
}

function Map() {
    const [places, setPlaces] = useState<Place[]>([]);
    const [loading, setLoading] = useState(false);

    async function loadPlaces(map: LeafletMap) {
        setLoading(true);

        const bounds = map.getBounds();

        const params = new URLSearchParams({
            south: bounds.getSouth().toString(),
            west: bounds.getWest().toString(),
            north: bounds.getNorth().toString(),
            east: bounds.getEast().toString()
        });

        console.log('Map bounds:', {
            south: bounds.getSouth(),
            west: bounds.getWest(),
            north: bounds.getNorth(),
            east: bounds.getEast()
        });

        try {
            const response = await fetch(`http://localhost:3000/api/places?${params}`);

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
            <MapContainer className="map" center={[54.0722, -1.9975]} zoom={19}>

                <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>

                <FindCafesButton onFind={loadPlaces} loading={loading}/>

                {places.map(place => (

                    <Marker key={place.id} position={[place.lat, place.lon]}>

                        <Popup>{place.name}</Popup>

                    </Marker>
                ))}

            </MapContainer>
        </div>
    );
}

export default Map;