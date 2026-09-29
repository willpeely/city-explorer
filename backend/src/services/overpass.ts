import { z } from 'zod';

import {
    categories,
    type PlaceCategory
} from '../../../shared/data/categories';


const OVERPASS_URLS = [
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass-api.de/api/interpreter'
];

const OVERPASS_TIMEOUT_MS = 6_000;

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
| Validate responses received from Overpass
|--------------------------------------------------------------------------
|
| TypeScript types disappear at runtime.
|
| Zod makes sure the external API actually returned the structure
| our application expects.
|
*/

const overpassResponseSchema = z.object({

    elements: z.array(

        z.object({

            id: z
                .number()
                .int()
                .positive(),

            lat: z
                .number()
                .min(-90)
                .max(90),

            lon: z
                .number()
                .min(-180)
                .max(180),

            tags: z
                .record(
                    z.string(),
                    z.string()
                )
                .optional()

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
| Used by the request validation in the Express server
|--------------------------------------------------------------------------
*/

export function isValidCategory(
    value: string
): boolean {

    return findCategory(value) !== undefined;

}


/*
|--------------------------------------------------------------------------
| External service error helper
|--------------------------------------------------------------------------
|
| The central Express error handler recognises this error name
| and returns HTTP 502.
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


    const categoryInfo =
        findCategory(category);


    if (!categoryInfo) {

        throw new Error(
            `Unknown category: ${category}`
        );

    }


    const query = `
        [out:json][timeout:10];

        node
            ["${categoryInfo.key}"="${categoryInfo.osmValue}"]
            (${south},${west},${north},${east});

        out;
    `;


    /*
    |--------------------------------------------------------------------------
    | AbortSignal.timeout
    |--------------------------------------------------------------------------
    |
    | If Overpass takes more than 15 seconds the request is cancelled.
    |
    */

    let lastError: unknown;


    for (const url of OVERPASS_URLS) {

        try {

            const response = await fetch(
                url,
                {
                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'text/plain',

                        'User-Agent':
                            'CityExplorer/1.0'
                    },

                    body: query,

                    signal:
                        AbortSignal.timeout(
                            OVERPASS_TIMEOUT_MS
                        )
                }
            );


            if (!response.ok) {

                const errorText =
                    await response.text();

                console.error(
                    'Overpass returned non-OK response',
                    {
                        url,
                        status: response.status,
                        body: errorText.slice(0, 200)
                    }
                );

                lastError =
                    externalServiceError(
                        `Overpass request failed: ${response.status}`
                    );

                continue;
            }


            const data: unknown =
                await response.json();


            const validation =
                overpassResponseSchema.safeParse(
                    data
                );


            if (!validation.success) {

                lastError =
                    externalServiceError(
                        'Overpass returned an unexpected response'
                    );


                continue;

            }


            return validation.data.elements.map(
                place => ({

                    id: place.id,

                    name:
                        place.tags?.name
                        ?? 'Unnamed place',

                    lat: place.lat,

                    lon: place.lon,

                    category

                })
            );

        } catch (error) {

            console.error(
                'Overpass request failed',
                {
                    url,
                    error:
                        error instanceof Error
                            ? {
                                name: error.name,
                                message: error.message,
                                cause: error.cause
                            }
                            : error
                }
            );

            lastError = error;

        }

    }


    /*
    |--------------------------------------------------------------------------
    | Both Overpass instances failed
    |--------------------------------------------------------------------------
    */

    if (
        lastError instanceof Error
        && lastError.name === 'TimeoutError'
    ) {

        throw lastError;

    }


    throw externalServiceError(
        'All Overpass API instances failed'
    );

}