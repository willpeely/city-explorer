import {
    useEffect,
    useMemo,
    useState
} from 'react';

import {
    MapContainer,
    Marker,
    Polyline,
    Popup,
    TileLayer,
    useMap
} from 'react-leaflet';

import type { Map as LeafletMap } from 'leaflet';

import { categories } from '../../../shared/data/categories';

import 'leaflet/dist/leaflet.css';
import './Map.css';


/*
|--------------------------------------------------------------------------
| Configuration
|--------------------------------------------------------------------------
*/

const API_URL = (
    import.meta.env.VITE_API_URL
    ?? 'http://localhost:3000'
).replace(/\/$/, '');


const MAX_TRIP_PLACES = 20;


const DEFAULT_MAP_CENTER: [number, number] = [
    54.0722,
    -1.9975
];


const DEFAULT_MAP_ZOOM = 19;


/*
|--------------------------------------------------------------------------
| Types
|--------------------------------------------------------------------------
*/

type Place = {
    id: number;
    name: string;
    lat: number;
    lon: number;
    category: string;
};


type RoutePoint = [
    number,
    number
];


type RouteInfo = {
    distance: number;
    duration: number;
};


type RouteApiResponse = {
    features: Array<{
        properties: {
            summary: RouteInfo;
        };

        geometry: {
            coordinates: Array<[
                number,
                number
            ]>;
        };
    }>;
};


type ApiErrorResponse = {
    error?: string;
};


/*
|--------------------------------------------------------------------------
| API helpers
|--------------------------------------------------------------------------
*/

/*
| Extract a useful error from our backend.
|
| The backend now returns responses such as:
|
| {
|     "error": "Too many requests"
| }
*/

async function getApiErrorMessage(
    response: Response,
    fallbackMessage: string
): Promise<string> {

    try {

        const data =
            await response.json() as ApiErrorResponse;


        return (
            data.error
            ?? fallbackMessage
        );

    } catch {

        return fallbackMessage;

    }

}


async function fetchJson<T>(
    url: string,
    options: RequestInit | undefined,
    fallbackError: string
): Promise<T> {

    const response =
        await fetch(
            url,
            options
        );


    if (!response.ok) {

        const message =
            await getApiErrorMessage(
                response,
                fallbackError
            );


        throw new Error(message);

    }


    return await response.json() as T;

}


/*
|--------------------------------------------------------------------------
| Search button
|--------------------------------------------------------------------------
*/

type FindPlacesButtonProps = {
    onFind: (
        map: LeafletMap
    ) => Promise<void>;

    loading: boolean;
};


function FindPlacesButton({
    onFind,
    loading
}: FindPlacesButtonProps) {

    const map = useMap();


    return (

        <button
            type="button"
            className="find-places-button"
            onClick={() => {
                void onFind(map);
            }}
            disabled={loading}
        >

            {
                loading
                    ? 'Searching...'
                    : 'Search this area'
            }

        </button>

    );

}


/*
|--------------------------------------------------------------------------
| Automatically show the complete route
|--------------------------------------------------------------------------
*/

type RouteFitterProps = {
    route: RoutePoint[];
};


function RouteFitter({
    route
}: RouteFitterProps) {

    const map = useMap();


    useEffect(() => {

        if (route.length < 2) {
            return;
        }


        map.fitBounds(
            route,
            {
                padding: [
                    40,
                    40
                ]
            }
        );

    }, [
        map,
        route
    ]);


    return null;

}


/*
|--------------------------------------------------------------------------
| Main component
|--------------------------------------------------------------------------
*/

function Map() {

    /*
    |--------------------------------------------------------------------------
    | State
    |--------------------------------------------------------------------------
    */

    const [
        places,
        setPlaces
    ] = useState<Place[]>([]);


    const [
        trip,
        setTrip
    ] = useState<Place[]>([]);


    const [
        route,
        setRoute
    ] = useState<RoutePoint[]>([]);


    const [
        routeInfo,
        setRouteInfo
    ] = useState<RouteInfo | null>(null);


    const [
        category,
        setCategory
    ] = useState('cafe');


    const [
        optimise,
        setOptimise
    ] = useState(false);


    const [
        placesLoading,
        setPlacesLoading
    ] = useState(false);


    const [
        routeLoading,
        setRouteLoading
    ] = useState(false);


    const [
        placesError,
        setPlacesError
    ] = useState<string | null>(null);


    const [
        routeError,
        setRouteError
    ] = useState<string | null>(null);


    /*
    |--------------------------------------------------------------------------
    | Derived state
    |--------------------------------------------------------------------------
    |
    | These values can be calculated from existing state, so they don't
    | need their own useState().
    |
    */

    const tripPlaceIds = useMemo(

        () => new Set(
            trip.map(
                place => place.id
            )
        ),

        [trip]

    );


    /*
    | Places in the trip should remain visible even after searching for
    | a different category.
    |
    | Using a Map also removes duplicate markers.
    */

    const markers = useMemo(() => {

        /*
        | Once a route has been generated, only show
        | places that are part of the trip.
        */

        if (route.length > 0) {

            return trip;

        }


        /*
        | Before planning a route, show all search results
        | as well as any selected trip places.
        */

        const markersById =
            new globalThis.Map<number, Place>();


        for (const place of places) {

            markersById.set(
                place.id,
                place
            );

        }


        for (const place of trip) {

            markersById.set(
                place.id,
                place
            );

        }


        return Array.from(
            markersById.values()
        );

    }, [
        places,
        trip,
        route
    ]);


    const tripIsFull =
        trip.length >= MAX_TRIP_PLACES;


    /*
    |--------------------------------------------------------------------------
    | Route state helpers
    |--------------------------------------------------------------------------
    */

    function clearRoute() {

        setRoute([]);

        setRouteInfo(null);

        setRouteError(null);

    }


    /*
    |--------------------------------------------------------------------------
    | Category handling
    |--------------------------------------------------------------------------
    */

    function selectCategory(
        newCategory: string
    ) {

        if (
            newCategory === category
        ) {
            return;
        }


        setCategory(
            newCategory
        );


        /*
        | Existing search results belong to the old category,
        | so remove them to avoid misleading the user.
        */

        setPlaces([]);

        setPlacesError(null);

    }


    /*
    |--------------------------------------------------------------------------
    | Load places
    |--------------------------------------------------------------------------
    */

    async function loadPlaces(
        map: LeafletMap
    ) {

        if (placesLoading) {
            return;
        }


        setPlacesLoading(true);

        setPlacesError(null);


        try {

            const bounds =
                map.getBounds();


            const params =
                new URLSearchParams({

                    category,

                    south:
                        bounds
                            .getSouth()
                            .toString(),

                    west:
                        bounds
                            .getWest()
                            .toString(),

                    north:
                        bounds
                            .getNorth()
                            .toString(),

                    east:
                        bounds
                            .getEast()
                            .toString()

                });


            const data =
                await fetchJson<Place[]>(

                    `${API_URL}/api/places?${params}`,

                    undefined,

                    'Failed to load places'

                );


            setPlaces(data);

        } catch (error) {

            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to load places';


            setPlacesError(message);

        } finally {

            setPlacesLoading(false);

        }

    }


    /*
    |--------------------------------------------------------------------------
    | Add place
    |--------------------------------------------------------------------------
    */

    function addToTrip(
        place: Place
    ) {

        if (
            tripPlaceIds.has(place.id)
            || tripIsFull
        ) {
            return;
        }


        clearRoute();


        setTrip(
            currentTrip => [
                ...currentTrip,
                place
            ]
        );

    }


    /*
    |--------------------------------------------------------------------------
    | Remove place
    |--------------------------------------------------------------------------
    */

    function removeFromTrip(
        placeId: number
    ) {

        clearRoute();


        setTrip(
            currentTrip =>
                currentTrip.filter(
                    place =>
                        place.id !== placeId
                )
        );

    }


    /*
    |--------------------------------------------------------------------------
    | Reorder places
    |--------------------------------------------------------------------------
    |
    | One function replaces separate moveUp() and moveDown()
    | implementations.
    |
    */

    function moveTripPlace(
        fromIndex: number,
        toIndex: number
    ) {

        if (
            toIndex < 0
            || toIndex >= trip.length
            || fromIndex === toIndex
        ) {
            return;
        }


        clearRoute();


        setTrip(
            currentTrip => {

                const updatedTrip = [
                    ...currentTrip
                ];


                [
                    updatedTrip[fromIndex],
                    updatedTrip[toIndex]
                ] = [
                    updatedTrip[toIndex],
                    updatedTrip[fromIndex]
                ];


                return updatedTrip;

            }
        );

    }


    /*
    |--------------------------------------------------------------------------
    | Clear trip
    |--------------------------------------------------------------------------
    */

    function clearTrip() {

        setTrip([]);

        clearRoute();

    }


    /*
    |--------------------------------------------------------------------------
    | Generate route
    |--------------------------------------------------------------------------
    */

    async function planRoute() {

        if (
            trip.length < 2
            || routeLoading
        ) {
            return;
        }


        setRouteLoading(true);

        setRouteError(null);


        try {

            const data =
                await fetchJson<RouteApiResponse>(

                    `${API_URL}/api/route`,

                    {
                        method: 'POST',

                        headers: {
                            'Content-Type':
                                'application/json'
                        },

                        body: JSON.stringify({
                            places: trip,
                            optimise
                        })
                    },

                    'Failed to generate route'

                );


            const feature =
                data.features[0];


            if (!feature) {

                throw new Error(
                    'Routing service returned no route'
                );

            }


            const {
                distance,
                duration
            } =
                feature.properties.summary;


            setRouteInfo({
                distance,
                duration
            });


            /*
            | OpenRouteService coordinates:
            |
            | [longitude, latitude]
            |
            | Leaflet expects:
            |
            | [latitude, longitude]
            */

            const leafletRoute =
                feature.geometry.coordinates.map(
                    ([
                        lon,
                        lat
                    ]): RoutePoint => [

                        lat,
                        lon

                    ]
                );


            setRoute(
                leafletRoute
            );

        } catch (error) {

            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to generate route';


            setRoute([]);

            setRouteInfo(null);

            setRouteError(message);

        } finally {

            setRouteLoading(false);

        }

    }


    /*
    |--------------------------------------------------------------------------
    | Render
    |--------------------------------------------------------------------------
    */

    return (

        <div className="map-wrapper">


            {/* ------------------------------------------------------------
                Categories
            ------------------------------------------------------------- */}

            <aside className="map-controls">

                <h2>
                    Categories
                </h2>


                {
                    Object.entries(
                        categories
                    ).map(
                        ([
                            groupKey,
                            group
                        ]) => (

                            <section
                                key={groupKey}
                                className="category-group"
                            >

                                <h3 className="category-title">
                                    {group.label}
                                </h3>


                                <div className="category-buttons">

                                    {
                                        group.places.map(
                                            place => (

                                                <button
                                                    key={place.value}
                                                    type="button"

                                                    className={
                                                        category === place.value
                                                            ? 'category-button selected'
                                                            : 'category-button'
                                                    }

                                                    onClick={() =>
                                                        selectCategory(
                                                            place.value
                                                        )
                                                    }
                                                >

                                                    {place.label}

                                                </button>

                                            )
                                        )
                                    }

                                </div>

                            </section>

                        )
                    )
                }


                {
                    placesError && (

                        <p
                            className="error-message"
                            role="alert"
                        >
                            {placesError}
                        </p>

                    )
                }

            </aside>


            {/* ------------------------------------------------------------
                Map
            ------------------------------------------------------------- */}

            <MapContainer
                className="map"
                center={DEFAULT_MAP_CENTER}
                zoom={DEFAULT_MAP_ZOOM}
            >

                <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />


                <FindPlacesButton
                    onFind={loadPlaces}
                    loading={placesLoading}
                />


                {
                    markers.map(
                        place => {

                            const alreadyAdded =
                                tripPlaceIds.has(
                                    place.id
                                );


                            return (

                                <Marker
                                    key={place.id}
                                    position={[
                                        place.lat,
                                        place.lon
                                    ]}
                                >

                                    <Popup>

                                        <strong>
                                            {place.name}
                                        </strong>

                                        <br />

                                        <small>
                                            {place.category}
                                        </small>

                                        <br />

                                        <button
                                            type="button"

                                            onClick={() =>
                                                addToTrip(place)
                                            }

                                            disabled={
                                                alreadyAdded
                                                || tripIsFull
                                            }
                                        >

                                            {
                                                alreadyAdded
                                                    ? 'Added to trip'
                                                    : tripIsFull
                                                        ? 'Trip full'
                                                        : 'Add to trip'
                                            }

                                        </button>

                                    </Popup>

                                </Marker>

                            );

                        }
                    )
                }


                {
                    route.length > 0 && (

                        <>
                            <Polyline
                                positions={route}
                            />

                            <RouteFitter
                                route={route}
                            />
                        </>

                    )
                }

            </MapContainer>


            {/* ------------------------------------------------------------
                Trip panel
            ------------------------------------------------------------- */}

            <aside className="trip-panel">

                <div className="trip-panel-header">

                    <h2>
                        Your Trip
                    </h2>


                    {
                        trip.length > 0 && (

                            <button
                                type="button"
                                onClick={clearTrip}
                                disabled={routeLoading}
                            >
                                Clear
                            </button>

                        )
                    }

                </div>


                {
                    trip.length === 0
                        ? (

                            <p>
                                Add places to your trip to get started.
                            </p>

                        )
                        : (

                            <div className="trip-list">

                                {
                                    trip.map(
                                        (
                                            place,
                                            index
                                        ) => (

                                            <div
                                                key={place.id}
                                                className="trip-place"
                                            >

                                                <div className="trip-place-info">

                                                    <strong>

                                                        {index + 1}.{' '}
                                                        {place.name}

                                                    </strong>


                                                    <small>
                                                        {place.category}
                                                    </small>

                                                </div>


                                                <div className="trip-place-actions">

                                                    <button
                                                        type="button"

                                                        aria-label={
                                                            `Move ${place.name} up`
                                                        }

                                                        onClick={() =>
                                                            moveTripPlace(
                                                                index,
                                                                index - 1
                                                            )
                                                        }

                                                        disabled={
                                                            index === 0
                                                            || routeLoading
                                                        }
                                                    >
                                                        ↑
                                                    </button>


                                                    <button
                                                        type="button"

                                                        aria-label={
                                                            `Move ${place.name} down`
                                                        }

                                                        onClick={() =>
                                                            moveTripPlace(
                                                                index,
                                                                index + 1
                                                            )
                                                        }

                                                        disabled={
                                                            index === trip.length - 1
                                                            || routeLoading
                                                        }
                                                    >
                                                        ↓
                                                    </button>


                                                    <button
                                                        type="button"

                                                        onClick={() =>
                                                            removeFromTrip(
                                                                place.id
                                                            )
                                                        }

                                                        disabled={
                                                            routeLoading
                                                        }
                                                    >
                                                        Remove
                                                    </button>

                                                </div>

                                            </div>

                                        )
                                    )
                                }

                            </div>

                        )
                }


                {
                    trip.length > 0 && (

                        <p className="trip-count">

                            {trip.length}
                            {' / '}
                            {MAX_TRIP_PLACES}
                            {' places selected'}

                        </p>

                    )
                }


                {
                    tripIsFull && (

                        <p
                            className="info-message"
                            role="status"
                        >
                            Maximum of {MAX_TRIP_PLACES} places reached.
                        </p>

                    )
                }


                <fieldset className="route-options">

                    <legend>
                        Route order
                    </legend>


                    <label>

                        <input
                            type="radio"
                            name="route-mode"

                            checked={
                                !optimise
                            }

                            onChange={() => {

                                setOptimise(false);

                                clearRoute();

                            }}
                        />

                        Keep my order

                    </label>


                    <label>

                        <input
                            type="radio"
                            name="route-mode"

                            checked={
                                optimise
                            }

                            onChange={() => {

                                setOptimise(true);

                                clearRoute();

                            }}
                        />

                        Optimise route

                    </label>

                </fieldset>


                {
                    optimise
                    && trip.length >= 2
                    && (

                        <p className="info-message">

                            The optimiser may visit your selected places
                            in a different order.

                        </p>

                    )
                }


                {
                    trip.length >= 2 && (

                        <button
                            type="button"
                            className="plan-route-button"

                            onClick={() => {
                                void planRoute();
                            }}

                            disabled={
                                routeLoading
                            }
                        >

                            {
                                routeLoading
                                    ? 'Planning route...'
                                    : 'Plan route'
                            }

                        </button>

                    )
                }


                {
                    routeError && (

                        <p
                            className="error-message"
                            role="alert"
                        >
                            {routeError}
                        </p>

                    )
                }


                {
                    routeInfo && (

                        <div className="route-info">

                            <strong>
                                Route Summary
                            </strong>


                            <p>
                                Distance:{' '}
                                {
                                    (
                                        routeInfo.distance
                                        / 1000
                                    ).toFixed(2)
                                } km
                            </p>


                            <p>
                                Walking time:{' '}
                                {
                                    Math.round(
                                        routeInfo.duration
                                        / 60
                                    )
                                } min
                            </p>

                        </div>

                    )
                }

            </aside>

        </div>

    );

}


export default Map;