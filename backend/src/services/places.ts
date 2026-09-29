import { z } from 'zod';

import {
    categories,
    type PlaceCategory
} from '../../../shared/data/categories';


const GEOAPIFY_URL =
    'https://api.geoapify.com/v2/places';

const GEOAPIFY_TIMEOUT_MS =
    8_000;


/*
|--------------------------------------------------------------------------
| Map our application categories to Geoapify categories
|--------------------------------------------------------------------------
|
| Keep the frontend/API category names unchanged.
| Only the external provider-specific value lives here.
|
*/

const GEOAPIFY_CATEGORIES:
    Record<string, string> = {

    /*
    |--------------------------------------------------------------------------
    | Food & Drink
    |--------------------------------------------------------------------------
    */

    cafe:
        'catering.cafe',

    restaurant:
        'catering.restaurant',

    pub:
        'catering.pub',


    /*
    |--------------------------------------------------------------------------
    | Shopping
    |--------------------------------------------------------------------------
    */

    gift:
        'commercial.gift_and_souvenir',

    clothes:
        'commercial.clothing.clothes',

    supermarket:
        'commercial.supermarket',

    books:
        'commercial.books',


    /*
    |--------------------------------------------------------------------------
    | Things To Do
    |--------------------------------------------------------------------------
    */

    museum:
        'entertainment.museum',

    gallery:
        'entertainment.culture.gallery',

    park:
        'leisure.park'

};


/*
|--------------------------------------------------------------------------
| Types
|--------------------------------------------------------------------------
*/

export type Place = {

    id: number;

    name: string;

    lat: number;

    lon: number;

    category: string;

};


/*
|--------------------------------------------------------------------------
| Validate responses received from Geoapify
|--------------------------------------------------------------------------
|
| External API responses cannot be trusted just because TypeScript says
| what we expect them to look like.
|
| Zod validates the data at runtime before our application uses it.
|
*/

const geoapifyResponseSchema =
    z.object({

        features: z.array(

            z.object({

                properties:
                    z.object({

                        place_id:
                            z.string()
                                .min(1),

                        name:
                            z.string()
                                .nullish(),

                        address_line1:
                            z.string()
                                .nullish(),

                        formatted:
                            z.string()
                                .nullish(),

                        lat:
                            z.number()
                                .min(-90)
                                .max(90),

                        lon:
                            z.number()
                                .min(-180)
                                .max(180)

                    })

            })

        )

    });


/*
|--------------------------------------------------------------------------
| Category lookup
|--------------------------------------------------------------------------
*/

function findCategory(
    value: string
): PlaceCategory | undefined {

    for (
        const group
        of Object.values(categories)
    ) {

        const place =
            group.places.find(
                place =>
                    place.value === value
            );


        if (place) {

            return place;

        }

    }


    return undefined;

}


/*
|--------------------------------------------------------------------------
| Used by Express request validation
|--------------------------------------------------------------------------
|
| A category must exist in our shared category configuration AND have a
| Geoapify mapping.
|
*/

export function isValidCategory(
    value: string
): boolean {

    return (
        findCategory(value) !== undefined
        &&
        GEOAPIFY_CATEGORIES[value] !== undefined
    );

}


/*
|--------------------------------------------------------------------------
| External service error helper
|--------------------------------------------------------------------------
|
| app.ts recognises this error name and converts it to HTTP 502.
|
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
| Stable numeric ID
|--------------------------------------------------------------------------
|
| Geoapify provides string place IDs, while the rest of City Explorer
| currently uses numeric IDs.
|
| This creates a deterministic positive 32-bit integer from the provider ID,
| avoiding a larger frontend/routing refactor.
|
*/

function createNumericId(
    value: string
): number {

    let hash =
        2166136261;


    for (
        let index = 0;
        index < value.length;
        index++
    ) {

        hash ^=
            value.charCodeAt(index);


        hash =
            Math.imul(
                hash,
                16777619
            );

    }


    const id =
        hash >>> 0;


    return id === 0
        ? 1
        : id;

}


/*
|--------------------------------------------------------------------------
| Fetch places
|--------------------------------------------------------------------------
*/

export async function getPlaces(

    category: string,

    south: number,

    west: number,

    north: number,

    east: number

): Promise<Place[]> {


    /*
    |--------------------------------------------------------------------------
    | Validate category
    |--------------------------------------------------------------------------
    */

    const categoryInfo =
        findCategory(category);


    if (!categoryInfo) {

        throw new Error(
            `Unknown category: ${category}`
        );

    }


    const geoapifyCategory =
        GEOAPIFY_CATEGORIES[category];


    if (!geoapifyCategory) {

        throw new Error(
            `No Geoapify mapping for category: ${category}`
        );

    }


    /*
    |--------------------------------------------------------------------------
    | API key
    |--------------------------------------------------------------------------
    */

    const apiKey =
        process.env.GEOAPIFY_API_KEY
            ?.trim();


    if (!apiKey) {

        throw new Error(
            'GEOAPIFY_API_KEY is not configured'
        );

    }


    /*
    |--------------------------------------------------------------------------
    | Call Geoapify
    |--------------------------------------------------------------------------
    */

    let response: Response;


    try {

        response =
            await fetch(
                GEOAPIFY_URL,
                {

                    method:
                        'POST',

                    headers: {

                        'Content-Type':
                            'application/json',

                        'x-api-key':
                            apiKey

                    },

                    body:
                        JSON.stringify({

                            categories: [
                                geoapifyCategory
                            ],

                            filter: {

                                type:
                                    'rect',

                                lon1:
                                    west,

                                lat1:
                                    south,

                                lon2:
                                    east,

                                lat2:
                                    north

                            },

                            limit:
                                50,

                            lang:
                                'en'

                        }),

                    signal:
                        AbortSignal.timeout(
                            GEOAPIFY_TIMEOUT_MS
                        )

                }
            );

    } catch (error) {


        /*
        |--------------------------------------------------------------------------
        | Preserve timeout errors
        |--------------------------------------------------------------------------
        |
        | The central Express error handler converts these into HTTP 504.
        |
        */

        if (
            error instanceof Error
            &&
            (
                error.name ===
                    'TimeoutError'
                ||
                error.name ===
                    'AbortError'
            )
        ) {

            throw error;

        }


        throw externalServiceError(

            error instanceof Error
                ? `Geoapify request failed: ${error.message}`
                : 'Geoapify request failed'

        );

    }


    /*
    |--------------------------------------------------------------------------
    | Handle non-successful Geoapify responses
    |--------------------------------------------------------------------------
    */

    if (!response.ok) {

        const errorText =
            await response.text();


        throw externalServiceError(

            `Geoapify request failed: ${
                response.status
            } ${
                errorText.slice(
                    0,
                    500
                )
            }`

        );

    }


    /*
    |--------------------------------------------------------------------------
    | Parse response
    |--------------------------------------------------------------------------
    */

    let data: unknown;


    try {

        data =
            await response.json();

    } catch {

        throw externalServiceError(
            'Geoapify returned invalid JSON'
        );

    }


    /*
    |--------------------------------------------------------------------------
    | Runtime response validation
    |--------------------------------------------------------------------------
    */

    const validation =
        geoapifyResponseSchema.safeParse(
            data
        );


    if (!validation.success) {

        throw externalServiceError(
            'Geoapify returned an unexpected response'
        );

    }


    /*
    |--------------------------------------------------------------------------
    | Convert Geoapify objects into our own Place objects
    |--------------------------------------------------------------------------
    |
    | The rest of the application does not need to know which external
    | service supplied these places.
    |
    */

    return validation.data.features.map(
        feature => {

            const place =
                feature.properties;


            return {

                id:
                    createNumericId(
                        place.place_id
                    ),

                name:
                    place.name
                    ??
                    place.address_line1
                    ??
                    place.formatted
                    ??
                    'Unnamed place',

                lat:
                    place.lat,

                lon:
                    place.lon,

                category

            };

        }
    );

}