import 'dotenv/config';

import express, {
    type NextFunction,
    type Request,
    type Response
} from 'express';

import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { z } from 'zod';

import {
    getPlaces,
    isValidCategory
} from './services/overpass.ts';

import {
    getRoute,
    getDistanceMatrix
} from './services/openroute.js';

import { optimiseRoute } from './services/routeOptimiser.ts';


const app = express();

const PORT = Number(process.env.PORT ?? 3000);

const FRONTEND_URL =
    process.env.FRONTEND_URL ?? 'http://localhost:5173';


/*
|--------------------------------------------------------------------------
| Basic configuration validation
|--------------------------------------------------------------------------
*/

if (
    !Number.isInteger(PORT) ||
    PORT < 1 ||
    PORT > 65535
) {
    throw new Error('PORT must be a valid port number');
}


/*
|--------------------------------------------------------------------------
| Logging
|--------------------------------------------------------------------------
|
| pino-http automatically logs incoming HTTP requests and responses.
|
*/

const httpLogger = pinoHttp({
    level: process.env.LOG_LEVEL ?? 'info',

    // Prevent sensitive auth information appearing in logs.
    redact: [
        'req.headers.authorization'
    ]
});

app.use(httpLogger);


/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
|
| Only allow requests from the frontend we configure.
|
*/

app.use(cors({
    origin: FRONTEND_URL
}));


/*
|--------------------------------------------------------------------------
| JSON parsing
|--------------------------------------------------------------------------
|
| Limit JSON bodies so someone cannot send an enormous request body.
|
*/

app.use(express.json({
    limit: '100kb'
}));


/*
|--------------------------------------------------------------------------
| Health endpoint
|--------------------------------------------------------------------------
|
| Can be used by hosting platforms to check whether the server is alive.
|
*/

app.get('/api/health', (req, res) => {

    res.status(200).json({
        status: 'ok',
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString()
    });

});


/*
|--------------------------------------------------------------------------
| Rate limiting
|--------------------------------------------------------------------------
|
| General API limit:
| 100 requests per minute per IP.
|
*/

const apiLimiter = rateLimit({

    windowMs: 60 * 1000,

    limit: 100,

    standardHeaders: 'draft-8',

    legacyHeaders: false,

    message: {
        error: 'Too many requests. Please try again later.'
    }
});


/*
| Route generation is more expensive because it calls
| OpenRouteService, so it gets a stricter limit.
*/

const routeLimiter = rateLimit({

    windowMs: 60 * 1000,

    limit: 20,

    standardHeaders: 'draft-8',

    legacyHeaders: false,

    message: {
        error: 'Too many route requests. Please try again later.'
    }
});


app.use('/api', apiLimiter);

app.use('/api/route', routeLimiter);


/*
|--------------------------------------------------------------------------
| Request validation schemas
|--------------------------------------------------------------------------
*/


const placesQuerySchema = z.object({

    category: z
        .string()
        .trim()
        .min(1)
        .max(100)
        .refine(
            isValidCategory,
            {
                error: 'Unsupported category'
            }
        ),

    south: z
        .coerce
        .number()
        .min(-90)
        .max(90),

    west: z
        .coerce
        .number()
        .min(-180)
        .max(180),

    north: z
        .coerce
        .number()
        .min(-90)
        .max(90),

    east: z
        .coerce
        .number()
        .min(-180)
        .max(180)

})
.strict()

.refine(
    data => data.south < data.north,
    {
        error: 'south must be less than north',
        path: ['south']
    }
)

.refine(
    data => data.west < data.east,
    {
        error: 'west must be less than east',
        path: ['west']
    }
);


const placeSchema = z.object({

    id: z
        .number()
        .int()
        .positive(),

    name: z
        .string()
        .trim()
        .min(1)
        .max(200),

    lat: z
        .number()
        .min(-90)
        .max(90),

    lon: z
        .number()
        .min(-180)
        .max(180),

    category: z
        .string()
        .trim()
        .min(1)
        .max(100)

}).strict();


const routeRequestSchema = z.object({

    places: z
        .array(placeSchema)
        .min(2)
        .max(20),

    optimise: z
        .boolean()
        .default(false)

}).strict();


/*
|--------------------------------------------------------------------------
| Helper for async Express routes
|--------------------------------------------------------------------------
|
| Any rejected Promise gets forwarded to the central error handler.
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

        handler(req, res, next)
            .catch(next);

    };
}


/*
|--------------------------------------------------------------------------
| Validation error helper
|--------------------------------------------------------------------------
*/

function sendValidationError(
    res: Response,
    error: z.ZodError
) {

    res.status(400).json({

        error: 'Invalid request',

        details: z.flattenError(error)

    });

}


/*
|--------------------------------------------------------------------------
| Root route
|--------------------------------------------------------------------------
*/

app.get('/', (req, res) => {

    res.send('City Explorer API');

});


/*
|--------------------------------------------------------------------------
| Places endpoint
|--------------------------------------------------------------------------
*/

app.get(
    '/api/places',

    asyncHandler(async (req, res) => {

        const validation =
            placesQuerySchema.safeParse(req.query);


        if (!validation.success) {

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
        } = validation.data;


        req.log.info(
            {
                category
            },
            'Searching for places'
        );


        const places = await getPlaces(
            category,
            south,
            west,
            north,
            east
        );


        res.json(places);

    })
);


/*
|--------------------------------------------------------------------------
| Route endpoint
|--------------------------------------------------------------------------
*/

app.post(
    '/api/route',

    asyncHandler(async (req, res) => {

        const validation =
            routeRequestSchema.safeParse(req.body);


        if (!validation.success) {

            sendValidationError(
                res,
                validation.error
            );

            return;
        }


        const {
            places,
            optimise
        } = validation.data;


        req.log.info(
            {
                placeCount: places.length,
                optimise
            },
            'Planning route'
        );


        let routePlaces = places;


        if (optimise) {

            const distances =
                await getDistanceMatrix(places);


            routePlaces = optimiseRoute(
                places,
                distances
            );


            req.log.info(
                {
                    placeOrder:
                        routePlaces.map(
                            place => place.id
                        )
                },
                'Route optimised'
            );
        }


        const route =
            await getRoute(routePlaces);


        res.json(route);

    })
);


/*
|--------------------------------------------------------------------------
| 404 handler
|--------------------------------------------------------------------------
|
| Runs if no route above matched.
|
*/

app.use((req, res) => {

    res.status(404).json({
        error: 'Endpoint not found'
    });

});


/*
|--------------------------------------------------------------------------
| Centralised error handler
|--------------------------------------------------------------------------
|
| Every unexpected application error eventually reaches here.
|
*/

app.use((
    error: unknown,
    req: Request,
    res: Response,
    _next: NextFunction
) => {

    req.log.error(
        {
            err: error
        },
        'Request failed'
    );


    /*
    | Invalid JSON sent by the client.
    */

    if (
        error instanceof SyntaxError &&
        (error as { status?: number }).status === 400
    ) {

        res.status(400).json({
            error: 'Invalid JSON body'
        });

        return;
    }


    /*
    | fetch() timed out while contacting an external API.
    */

    if (
        error instanceof Error &&
        (
            error.name === 'TimeoutError' ||
            error.name === 'AbortError'
        )
    ) {

        res.status(504).json({
            error: 'External service timed out'
        });

        return;
    }


    /*
    | Overpass or OpenRouteService failed.
    */

    if (
        error instanceof Error &&
        error.name === 'ExternalServiceError'
    ) {

        res.status(502).json({
            error: 'External service unavailable'
        });

        return;
    }


    /*
    | Anything else is an unexpected server error.
    */

    res.status(500).json({
        error: 'Internal server error'
    });

});


/*
|--------------------------------------------------------------------------
| Start server
|--------------------------------------------------------------------------
*/

app.listen(PORT, () => {

    httpLogger.logger.info(
        {
            port: PORT,
            frontendUrl: FRONTEND_URL
        },
        'City Explorer API started'
    );

});