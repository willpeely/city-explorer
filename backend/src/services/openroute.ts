import { z } from 'zod';


const ORS_URL =
    'https://api.openrouteservice.org/v2/directions/foot-walking/geojson';


const ORS_MATRIX_URL =
    'https://api.openrouteservice.org/v2/matrix/foot-walking';


const ORS_TIMEOUT_MS =
    15_000;


/*
|--------------------------------------------------------------------------
| Types
|--------------------------------------------------------------------------
*/

type Coordinate = {

    lat: number;

    lon: number;

};


/*
|--------------------------------------------------------------------------
| Validate coordinates passed into this service
|--------------------------------------------------------------------------
*/

const coordinateSchema = z.object({

    lat: z
        .number()
        .min(-90)
        .max(90),

    lon: z
        .number()
        .min(-180)
        .max(180)

});


const coordinatesSchema = z
    .array(coordinateSchema)
    .min(2)
    .max(20);


/*
|--------------------------------------------------------------------------
| Validate OpenRouteService route response
|--------------------------------------------------------------------------
*/

const routeResponseSchema = z.object({

    features: z
        .array(

            z.object({

                properties: z.object({

                    summary: z.object({

                        distance: z
                            .number()
                            .nonnegative(),

                        duration: z
                            .number()
                            .nonnegative()

                    })

                }),

                geometry: z.object({

                    coordinates: z
                        .array(

                            z.tuple([
                                z.number(),
                                z.number()
                            ])

                        )
                        .min(2)

                })

            })

        )
        .min(1)

});


/*
|--------------------------------------------------------------------------
| Validate OpenRouteService matrix response
|--------------------------------------------------------------------------
*/

const matrixResponseSchema = z.object({

    distances: z.array(

        z.array(

            z
                .number()
                .nonnegative()

        )

    )

});


/*
|--------------------------------------------------------------------------
| Get API key
|--------------------------------------------------------------------------
*/

function getApiKey(): string {

    const apiKey =
        process.env.ORS_API_KEY;


    if (!apiKey) {

        throw new Error(
            'ORS_API_KEY environment variable is not configured'
        );

    }


    return apiKey;

}


/*
|--------------------------------------------------------------------------
| External service error
|--------------------------------------------------------------------------
*/

function externalServiceError(
    message: string
): Error {

    const error =
        new Error(message);


    error.name =
        'ExternalServiceError';


    return error;

}


/*
|--------------------------------------------------------------------------
| Validate coordinates
|--------------------------------------------------------------------------
*/

function validateCoordinates(
    places: Coordinate[]
): Coordinate[] {

    const validation =
        coordinatesSchema.safeParse(
            places
        );


    if (!validation.success) {

        throw new Error(
            'Invalid coordinates supplied to routing service'
        );

    }


    return validation.data;

}


/*
|--------------------------------------------------------------------------
| Get route
|--------------------------------------------------------------------------
*/

export async function getRoute(
    places: Coordinate[]
): Promise<unknown> {


    const validPlaces =
        validateCoordinates(places);


    const coordinates =
        validPlaces.map(
            place => [

                place.lon,

                place.lat

            ]
        );


    const response = await fetch(
        ORS_URL,
        {

            method: 'POST',

            headers: {

                'Authorization':
                    getApiKey(),

                'Content-Type':
                    'application/json'

            },

            body: JSON.stringify({
                coordinates
            }),

            signal:
                AbortSignal.timeout(
                    ORS_TIMEOUT_MS
                )

        }
    );


    if (!response.ok) {

        const errorText =
            await response.text();


        throw externalServiceError(

            `OpenRouteService request failed: ${
                response.status
            } ${
                errorText.slice(0, 500)
            }`

        );

    }


    const data: unknown =
        await response.json();


    /*
    |--------------------------------------------------------------------------
    | Validate the response before returning it
    |--------------------------------------------------------------------------
    */

    const validation =
        routeResponseSchema.safeParse(
            data
        );


    if (!validation.success) {

        throw externalServiceError(
            'OpenRouteService returned an unexpected route response'
        );

    }


    /*
    | Return the original response.
    |
    | We validated the parts our frontend depends on,
    | but this preserves any additional GeoJSON fields ORS returned.
    */

    return data;

}


/*
|--------------------------------------------------------------------------
| Get distance matrix
|--------------------------------------------------------------------------
*/

export async function getDistanceMatrix(
    places: Coordinate[]
): Promise<number[][]> {


    const validPlaces =
        validateCoordinates(places);


    const locations =
        validPlaces.map(
            place => [

                place.lon,

                place.lat

            ]
        );


    const response = await fetch(
        ORS_MATRIX_URL,
        {

            method: 'POST',

            headers: {

                'Authorization':
                    getApiKey(),

                'Content-Type':
                    'application/json'

            },

            body: JSON.stringify({

                locations,

                metrics: [
                    'distance'
                ]

            }),

            signal:
                AbortSignal.timeout(
                    ORS_TIMEOUT_MS
                )

        }
    );


    if (!response.ok) {

        const errorText =
            await response.text();


        throw externalServiceError(

            `OpenRouteService matrix request failed: ${
                response.status
            } ${
                errorText.slice(0, 500)
            }`

        );

    }


    const data: unknown =
        await response.json();


    const validation =
        matrixResponseSchema.safeParse(
            data
        );


    if (!validation.success) {

        throw externalServiceError(
            'OpenRouteService returned an unexpected distance matrix'
        );

    }


    const distances =
        validation.data.distances;


    /*
    |--------------------------------------------------------------------------
    | Check matrix dimensions
    |--------------------------------------------------------------------------
    |
    | 5 places should produce a 5 x 5 matrix.
    |
    */

    if (
        distances.length !==
        validPlaces.length
    ) {

        throw externalServiceError(
            'OpenRouteService returned an invalid distance matrix size'
        );

    }


    for (
        const row
        of distances
    ) {

        if (
            row.length !==
            validPlaces.length
        ) {

            throw externalServiceError(
                'OpenRouteService returned an invalid distance matrix row'
            );

        }

    }


    return distances;

}