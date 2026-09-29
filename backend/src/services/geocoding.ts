import { z } from 'zod';


const GEOAPIFY_GEOCODING_URL =
    'https://api.geoapify.com/v1/geocode/search';

const GEOAPIFY_TIMEOUT_MS =
    8_000;


export type CityResult = {
    name: string;
    lat: number;
    lon: number;
};


const geoapifyGeocodingSchema =
    z.object({

        results:
            z.array(

                z.object({

                    formatted:
                        z.string(),

                    lat:
                        z.number()
                            .min(-90)
                            .max(90),

                    lon:
                        z.number()
                            .min(-180)
                            .max(180)

                })

            )

    });


function externalServiceError(
    message: string
): Error {

    const error =
        new Error(message);

    error.name =
        'ExternalServiceError';

    return error;

}


export async function searchCity(
    query: string
): Promise<CityResult | null> {

    const apiKey =
        process.env.GEOAPIFY_API_KEY
            ?.trim();


    if (!apiKey) {

        throw new Error(
            'GEOAPIFY_API_KEY is not configured'
        );

    }


    const params =
        new URLSearchParams({

            text:
                query,

            type:
                'city',

            limit:
                '1',

            format:
                'json',

            apiKey

        });


    let response: Response;


    try {

        response =
            await fetch(
                `${GEOAPIFY_GEOCODING_URL}?${params}`,
                {
                    signal:
                        AbortSignal.timeout(
                            GEOAPIFY_TIMEOUT_MS
                        )
                }
            );

    } catch (error) {

        if (
            error instanceof Error
            &&
            (
                error.name === 'TimeoutError'
                ||
                error.name === 'AbortError'
            )
        ) {

            throw error;

        }


        throw externalServiceError(
            'Geoapify geocoding request failed'
        );

    }


    if (!response.ok) {

        throw externalServiceError(
            `Geoapify geocoding failed: ${response.status}`
        );

    }


    const data: unknown =
        await response.json();


    const validation =
        geoapifyGeocodingSchema
            .safeParse(data);


    if (!validation.success) {

        throw externalServiceError(
            'Geoapify returned an unexpected geocoding response'
        );

    }


    const result =
        validation.data.results[0];


    if (!result) {

        return null;

    }


    return {

        name:
            result.formatted,

        lat:
            result.lat,

        lon:
            result.lon

    };

}