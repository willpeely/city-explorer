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
    category: string;
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
    const [trip, setTrip] = useState<Place[]>([]);

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

    function addToTrip(place: Place) {

        setTrip(currentTrip => {

            const alreadyAdded = currentTrip.some(
                tripPlace => tripPlace.id === place.id
            );

            if (alreadyAdded) {
                return currentTrip;
            }

            return [...currentTrip, place];
        });
    }

    function removeFromTrip(placeId: number) {

        setTrip(currentTrip =>
            currentTrip.filter(place => place.id !== placeId)
        );
    }

    function moveUp(index: number) {

        if (index === 0) {
            return;
        }

        setTrip(currentTrip => {

            const updatedTrip = [...currentTrip];

            [
                updatedTrip[index - 1],
                updatedTrip[index]
            ] = [
                updatedTrip[index],
                updatedTrip[index - 1]
            ];

            return updatedTrip;
        });
    }

    function moveDown(index: number) {

        setTrip(currentTrip => {

            if (index === currentTrip.length - 1) {
                return currentTrip;
            }

            const updatedTrip = [...currentTrip];

            [
                updatedTrip[index],
                updatedTrip[index + 1]
            ] = [
                updatedTrip[index + 1],
                updatedTrip[index]
            ];

            return updatedTrip;
        });
    }

    return (
        <div className="map-wrapper">

            <div className="map-controls">

                <h2>Categories</h2>

                {Object.entries(categories).map(([groupKey, group]) => (

                    <div
                        key={groupKey}
                        className="category-group"
                    >

                        <h3 className='category-title'>{group.label}</h3>

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

                <FindPlacesButton onFind={loadPlaces} loading={loading}/>

                {places.map(place => (

                    <Marker
                        key={place.id}
                        position={[place.lat, place.lon]}
                    >

                        <Popup>

                            <strong>
                                {place.name}
                            </strong>

                            <br />

                            <button
                                onClick={() => addToTrip(place)}
                                disabled={trip.some(
                                    tripPlace =>
                                        tripPlace.id === place.id
                                )}
                            >
                                {trip.some(
                                    tripPlace =>
                                        tripPlace.id === place.id
                                )
                                    ? 'Added to trip'
                                    : 'Add to trip'
                                }
                            </button>

                        </Popup>

                    </Marker>

                ))}

            </MapContainer>

            <div className="trip-panel">

                <h2>Your Trip</h2>

                {trip.length === 0 ? (

                    <p>
                        Add places to your trip to get started.
                    </p>

                ) : (

                    <div className="trip-list">

                        {trip.map((place, index) => (

                        <div
                            key={place.id}
                            className="trip-place"
                        >

                            <div className="trip-place-info">

                                <strong>
                                    {index + 1}. {place.name}
                                </strong>

                                <small>
                                    {place.category}
                                </small>

                            </div>

                            <div className="trip-place-actions">

                                <button
                                    onClick={() => moveUp(index)}
                                    disabled={index === 0}
                                >
                                    ↑
                                </button>

                                <button
                                    onClick={() => moveDown(index)}
                                    disabled={index === trip.length - 1}
                                >
                                    ↓
                                </button>

                                <button
                                    onClick={() => removeFromTrip(place.id)}
                                >
                                    Remove
                                </button>

                            </div>

                        </div>

                        ))}

                    </div>

                )}

                {trip.length > 0 && (
                    <p>
                        {trip.length} place
                        {trip.length !== 1 ? 's' : ''} selected
                    </p>
                )}

            </div>

        </div>
    );
}

export default Map;