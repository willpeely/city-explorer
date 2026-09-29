import 'dotenv/config';

import express, {
    type NextFunction,
    type Request,
    type Response
} from 'express';

import cors from 'cors';

import {
    rateLimit
} from 'express-rate-limit';

import pinoHttp from 'pino-http';

import { z } from 'zod';


import {
    getPlaces,
    isValidCategory
} from './services/places.ts';


import {
    getRoute,
    getDistanceMatrix
} from './services/openroute.js';


import {
    optimiseRoute
} from './services/routeOptimiser.ts';


/*
|--------------------------------------------------------------------------
| Application
|--------------------------------------------------------------------------
*/

const app =
    express();


/*
|--------------------------------------------------------------------------
| Reverse proxy
|--------------------------------------------------------------------------
|
| Render places the Express application behind a reverse proxy.
|
| Trusting the first proxy allows Express and express-rate-limit to use
| forwarded client information correctly.
|
*/

app.set(
    'trust proxy',
    1
);


/*
|--------------------------------------------------------------------------
| Remove unnecessary Express header
|--------------------------------------------------------------------------
*/

app.disable(
    'x-powered-by'
);


/*
|--------------------------------------------------------------------------
| Configuration
|--------------------------------------------------------------------------
*/

const FRONTEND_URL =
    (
        process.env.FRONTEND_URL
        ??
        'http://localhost:5173'
    )
        .replace(
            /\/$/,
            ''
        );


/*
|--------------------------------------------------------------------------
| Logging
|--------------------------------------------------------------------------
*/

const httpLogger =
    pinoHttp({

        level:

            process.env.NODE_ENV ===
                'test'

                ? 'silent'

                : process.env.LOG_LEVEL
                    ?? 'info',

        redact: [

            'req.headers.authorization'

        ]

    });


export const logger =
    httpLogger.logger;


app.use(
    httpLogger
);


/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

app.use(

    cors({

        origin:
            FRONTEND_URL

    })

);


/*
|--------------------------------------------------------------------------
| JSON parsing
|--------------------------------------------------------------------------
*/

app.use(

    express.json({

        limit:
            '100kb'

    })

);


/*
|--------------------------------------------------------------------------
| Health endpoint
|--------------------------------------------------------------------------
*/

app.get(

    '/api/health',

    (
        _req,
        res
    ) => {

        res.status(
            200
        )
            .json({

                status:
                    'ok',

                uptimeSeconds:
                    Math.round(
                        process.uptime()
                    ),

                timestamp:
                    new Date()
                        .toISOString()

            });

    }

);


/*
|--------------------------------------------------------------------------
| Rate limiting
|--------------------------------------------------------------------------
*/

const apiLimiter =
    rateLimit({

        windowMs:
            60 * 1000,

        limit:
            100,

        standardHeaders:
            'draft-8',

        legacyHeaders:
            false,

        message: {

            error:
                'Too many requests. Please try again later.'

        }

    });


const routeLimiter =
    rateLimit({

        windowMs:
            60 * 1000,

        limit:
            20,

        standardHeaders:
            'draft-8',

        legacyHeaders:
            false,

        message: {

            error:
                'Too many route requests. Please try again later.'

        }

    });


app.use(
    '/api',
    apiLimiter
);


app.use(
    '/api/route',
    routeLimiter
);


/*
|--------------------------------------------------------------------------
| Request validation
|--------------------------------------------------------------------------
*/

const placesQuerySchema =
    z
        .object({

            category:
                z.string()
                    .trim()
                    .min(1)
                    .max(100)
                    .refine(

                        isValidCategory,

                        {

                            error:
                                'Unsupported category'

                        }

                    ),

            south:
                z.coerce
                    .number()
                    .min(-90)
                    .max(90),

            west:
                z.coerce
                    .number()
                    .min(-180)
                    .max(180),

            north:
                z.coerce
                    .number()
                    .min(-90)
                    .max(90),

            east:
                z.coerce
                    .number()
                    .min(-180)
                    .max(180)

        })
        .strict()

        .refine(

            data =>
                data.south <
                data.north,

            {

                error:
                    'south must be less than north',

                path: [
                    'south'
                ]

            }

        )

        .refine(

            data =>
                data.west <
                data.east,

            {

                error:
                    'west must be less than east',

                path: [
                    'west'
                ]

            }

        );


const placeSchema =
    z
        .object({

            id:
                z.number()
                    .int()
                    .positive(),

            name:
                z.string()
                    .trim()
                    .min(1)
                    .max(200),

            lat:
                z.number()
                    .min(-90)
                    .max(90),

            lon:
                z.number()
                    .min(-180)
                    .max(180),

            category:
                z.string()
                    .trim()
                    .min(1)
                    .max(100)

        })
        .strict();


const routeRequestSchema =
    z
        .object({

            places:
                z.array(
                    placeSchema
                )
                    .min(2)
                    .max(20),

            optimise:
                z.boolean()
                    .default(false)

        })
        .strict();


/*
|--------------------------------------------------------------------------
| Async route wrapper
|--------------------------------------------------------------------------
|
| Rejected promises are forwarded to the central Express error handler.
|
*/

type AsyncRequestHandler = (

    req: Request,

    res: Response,

    next: NextFunction

) => Promise<void>;


function asyncHandler(
    handler: AsyncRequestHandler
) {

    return (

        req: Request,

        res: Response,

        next: NextFunction

    ) => {

        void handler(
            req,
            res,
            next
        )
            .catch(
                next
            );

    };

}


/*
|--------------------------------------------------------------------------
| Validation error response
|--------------------------------------------------------------------------
*/

function sendValidationError(

    res: Response,

    error: z.ZodError

) {

    res
        .status(
            400
        )
        .json({

            error:
                'Invalid request',

            details:
                z.flattenError(
                    error
                )

        });

}


/*
|--------------------------------------------------------------------------
| Root endpoint
|--------------------------------------------------------------------------
*/

app.get(

    '/',

    (
        _req,
        res
    ) => {

        res.send(
            'City Explorer API'
        );

    }

);


/*
|--------------------------------------------------------------------------
| Places endpoint
|--------------------------------------------------------------------------
*/

app.get(

    '/api/places',

    asyncHandler(

        async (
            req,
            res
        ) => {


            /*
            |--------------------------------------------------------------------------
            | Validate query
            |--------------------------------------------------------------------------
            */

            const validation =
                placesQuerySchema
                    .safeParse(
                        req.query
                    );


            if (
                !validation.success
            ) {

                sendValidationError(

                    res,

                    validation.error

                );


                return;

            }


            const {

                category,

                south,

                west,

                north,

                east

            } =
                validation.data;


            req.log.info(

                {

                    category,

                    bounds: {

                        south,

                        west,

                        north,

                        east

                    }

                },

                'Searching for places'

            );


            /*
            |--------------------------------------------------------------------------
            | Fetch places
            |--------------------------------------------------------------------------
            */

            const places =
                await getPlaces(

                    category,

                    south,

                    west,

                    north,

                    east

                );


            req.log.info(

                {

                    category,

                    placeCount:
                        places.length

                },

                'Places found'

            );


            res.json(
                places
            );

        }

    )

);


/*
|--------------------------------------------------------------------------
| Route endpoint
|--------------------------------------------------------------------------
*/

app.post(

    '/api/route',

    asyncHandler(

        async (
            req,
            res
        ) => {


            /*
            |--------------------------------------------------------------------------
            | Validate request body
            |--------------------------------------------------------------------------
            */

            const validation =
                routeRequestSchema
                    .safeParse(
                        req.body
                    );


            if (
                !validation.success
            ) {

                sendValidationError(

                    res,

                    validation.error

                );


                return;

            }


            const {

                places,

                optimise

            } =
                validation.data;


            req.log.info(

                {

                    placeCount:
                        places.length,

                    optimise

                },

                'Planning route'

            );


            /*
            |--------------------------------------------------------------------------
            | Determine route order
            |--------------------------------------------------------------------------
            */

            let routePlaces =
                places;


            if (optimise) {

                const distances =
                    await getDistanceMatrix(
                        places
                    );


                routePlaces =
                    optimiseRoute(

                        places,

                        distances

                    );


                req.log.info(

                    {

                        placeOrder:
                            routePlaces.map(
                                place =>
                                    place.id
                            )

                    },

                    'Route optimised'

                );

            }


            /*
            |--------------------------------------------------------------------------
            | Request route geometry
            |--------------------------------------------------------------------------
            */

            const route =
                await getRoute(
                    routePlaces
                );


            res.json(
                route
            );

        }

    )

);


/*
|--------------------------------------------------------------------------
| 404
|--------------------------------------------------------------------------
*/

app.use(

    (
        _req,
        res
    ) => {

        res
            .status(
                404
            )
            .json({

                error:
                    'Endpoint not found'

            });

    }

);


/*
|--------------------------------------------------------------------------
| Central error handler
|--------------------------------------------------------------------------
*/

app.use(

    (

        error: unknown,

        req: Request,

        res: Response,

        _next: NextFunction

    ) => {


        req.log.error(

            {

                err:
                    error

            },

            'Request failed'

        );


        /*
        |--------------------------------------------------------------------------
        | Invalid JSON
        |--------------------------------------------------------------------------
        */

        if (

            error instanceof SyntaxError

            &&

            (
                error as {
                    status?: number
                }
            ).status === 400

        ) {

            res
                .status(
                    400
                )
                .json({

                    error:
                        'Invalid JSON body'

                });


            return;

        }


        /*
        |--------------------------------------------------------------------------
        | External API timeout
        |--------------------------------------------------------------------------
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

            res
                .status(
                    504
                )
                .json({

                    error:
                        'External service timed out'

                });


            return;

        }


        /*
        |--------------------------------------------------------------------------
        | External API failure
        |--------------------------------------------------------------------------
        */

        if (

            error instanceof Error

            &&

            error.name ===
                'ExternalServiceError'

        ) {

            res
                .status(
                    502
                )
                .json({

                    error:
                        'External service unavailable'

                });


            return;

        }


        /*
        |--------------------------------------------------------------------------
        | Unexpected error
        |--------------------------------------------------------------------------
        */

        res
            .status(
                500
            )
            .json({

                error:
                    'Internal server error'

            });

    }

);


export default app;