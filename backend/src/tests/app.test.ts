import {
    beforeEach,
    describe,
    expect,
    it,
    vi
} from 'vitest';

import request from 'supertest';


/*
|--------------------------------------------------------------------------
| Mock Overpass
|--------------------------------------------------------------------------
|
| Tests should not make real requests to Overpass.
|
*/

vi.mock(
    '../services/overpass.ts',
    () => ({

        getPlaces:
            vi.fn(),

        /*
        | For these tests we treat "cafe" as a valid category.
        */

        isValidCategory:
            vi.fn(
                (
                    value: string
                ) =>
                    value === 'cafe'
            )

    })
);


/*
|--------------------------------------------------------------------------
| Mock OpenRouteService
|--------------------------------------------------------------------------
|
| Again, tests should not consume your actual API quota.
|
*/

vi.mock(
    '../services/openroute.js',
    () => ({

        getRoute:
            vi.fn(),

        getDistanceMatrix:
            vi.fn()

    })
);


/*
|--------------------------------------------------------------------------
| Import application and mocked functions
|--------------------------------------------------------------------------
*/

import app from '../app.ts';

import {
    getPlaces
} from '../services/overpass.ts';

import {
    getRoute,
    getDistanceMatrix
} from '../services/openroute.js';


/*
|--------------------------------------------------------------------------
| Fake places
|--------------------------------------------------------------------------
*/

const placeA = {

    id: 1,

    name:
        'Cafe A',

    lat:
        51.5,

    lon:
        -0.1,

    category:
        'cafe'

};


const placeB = {

    id: 2,

    name:
        'Cafe B',

    lat:
        51.51,

    lon:
        -0.11,

    category:
        'cafe'

};


const placeC = {

    id: 3,

    name:
        'Cafe C',

    lat:
        51.52,

    lon:
        -0.12,

    category:
        'cafe'

};


/*
|--------------------------------------------------------------------------
| Fake OpenRouteService response
|--------------------------------------------------------------------------
*/

const fakeRoute = {

    features: [

        {

            properties: {

                summary: {

                    distance:
                        1500,

                    duration:
                        900

                }

            },

            geometry: {

                coordinates: [

                    [
                        -0.1,
                        51.5
                    ],

                    [
                        -0.11,
                        51.51
                    ]

                ]

            }

        }

    ]

};


/*
|--------------------------------------------------------------------------
| Reset mocks
|--------------------------------------------------------------------------
|
| Every test starts with clean mocks.
|
*/

beforeEach(
    () => {

        vi.clearAllMocks();

    }
);


/*
|--------------------------------------------------------------------------
| Health tests
|--------------------------------------------------------------------------
*/

describe(
    'GET /api/health',
    () => {

        it(
            'returns 200 and reports that the API is healthy',
            async () => {

                const response =
                    await request(app)
                        .get(
                            '/api/health'
                        );


                expect(
                    response.status
                ).toBe(200);


                expect(
                    response.body.status
                ).toBe(
                    'ok'
                );


                expect(
                    response.body
                ).toHaveProperty(
                    'uptimeSeconds'
                );


                expect(
                    response.body
                ).toHaveProperty(
                    'timestamp'
                );

            }
        );

    }
);


/*
|--------------------------------------------------------------------------
| Places tests
|--------------------------------------------------------------------------
*/

describe(
    'GET /api/places',
    () => {

        it(
            'returns places when the request is valid',
            async () => {

                vi.mocked(
                    getPlaces
                ).mockResolvedValue([
                    placeA,
                    placeB
                ]);


                const response =
                    await request(app)

                        .get(
                            '/api/places'
                        )

                        .query({

                            category:
                                'cafe',

                            south:
                                51,

                            west:
                                -1,

                            north:
                                52,

                            east:
                                0

                        });


                expect(
                    response.status
                ).toBe(200);


                expect(
                    response.body
                ).toEqual([
                    placeA,
                    placeB
                ]);


                expect(
                    getPlaces
                ).toHaveBeenCalledWith(
                    'cafe',
                    51,
                    -1,
                    52,
                    0
                );

            }
        );


        it(
            'rejects invalid coordinates',
            async () => {

                const response =
                    await request(app)

                        .get(
                            '/api/places'
                        )

                        .query({

                            category:
                                'cafe',

                            south:
                                'hello',

                            west:
                                -1,

                            north:
                                52,

                            east:
                                0

                        });


                expect(
                    response.status
                ).toBe(400);


                expect(
                    response.body.error
                ).toBe(
                    'Invalid request'
                );


                /*
                | Validation should stop the request BEFORE
                | the Overpass service is called.
                */

                expect(
                    getPlaces
                ).not.toHaveBeenCalled();

            }
        );


        it(
            'rejects an invalid latitude',
            async () => {

                const response =
                    await request(app)

                        .get(
                            '/api/places'
                        )

                        .query({

                            category:
                                'cafe',

                            south:
                                -100,

                            west:
                                -1,

                            north:
                                52,

                            east:
                                0

                        });


                expect(
                    response.status
                ).toBe(400);


                expect(
                    getPlaces
                ).not.toHaveBeenCalled();

            }
        );


        it(
            'rejects an unsupported category',
            async () => {

                const response =
                    await request(app)

                        .get(
                            '/api/places'
                        )

                        .query({

                            category:
                                'not-real',

                            south:
                                51,

                            west:
                                -1,

                            north:
                                52,

                            east:
                                0

                        });


                expect(
                    response.status
                ).toBe(400);


                expect(
                    getPlaces
                ).not.toHaveBeenCalled();

            }
        );

    }
);


/*
|--------------------------------------------------------------------------
| Route tests
|--------------------------------------------------------------------------
*/

describe(
    'POST /api/route',
    () => {

        it(
            'rejects a route containing fewer than two places',
            async () => {

                const response =
                    await request(app)

                        .post(
                            '/api/route'
                        )

                        .send({

                            places: [
                                placeA
                            ],

                            optimise:
                                false

                        });


                expect(
                    response.status
                ).toBe(400);


                expect(
                    response.body.error
                ).toBe(
                    'Invalid request'
                );


                expect(
                    getRoute
                ).not.toHaveBeenCalled();

            }
        );


        it(
            'generates a route without optimisation',
            async () => {

                vi.mocked(
                    getRoute
                ).mockResolvedValue(
                    fakeRoute
                );


                const response =
                    await request(app)

                        .post(
                            '/api/route'
                        )

                        .send({

                            places: [
                                placeA,
                                placeB
                            ],

                            optimise:
                                false

                        });


                expect(
                    response.status
                ).toBe(200);


                expect(
                    response.body
                ).toEqual(
                    fakeRoute
                );


                /*
                | If optimisation is disabled there should be
                | no distance matrix request.
                */

                expect(
                    getDistanceMatrix
                ).not.toHaveBeenCalled();


                expect(
                    getRoute
                ).toHaveBeenCalledWith([
                    placeA,
                    placeB
                ]);

            }
        );


        it(
            'optimises the order before generating the route',
            async () => {

                /*
                | Distances:
                |
                | A → B = 10
                | A → C = 2
                |
                | Therefore optimiser should choose:
                |
                | A → C → B
                */

                vi.mocked(
                    getDistanceMatrix
                ).mockResolvedValue([

                    [
                        0,
                        10,
                        2
                    ],

                    [
                        10,
                        0,
                        1
                    ],

                    [
                        2,
                        1,
                        0
                    ]

                ]);


                vi.mocked(
                    getRoute
                ).mockResolvedValue(
                    fakeRoute
                );


                const response =
                    await request(app)

                        .post(
                            '/api/route'
                        )

                        .send({

                            places: [
                                placeA,
                                placeB,
                                placeC
                            ],

                            optimise:
                                true

                        });


                expect(
                    response.status
                ).toBe(200);


                expect(
                    getDistanceMatrix
                ).toHaveBeenCalledWith([
                    placeA,
                    placeB,
                    placeC
                ]);


                expect(
                    getRoute
                ).toHaveBeenCalledWith([
                    placeA,
                    placeC,
                    placeB
                ]);

            }
        );


        it(
            'rejects invalid place coordinates',
            async () => {

                const response =
                    await request(app)

                        .post(
                            '/api/route'
                        )

                        .send({

                            places: [

                                placeA,

                                {
                                    ...placeB,

                                    lat:
                                        200
                                }

                            ],

                            optimise:
                                false

                        });


                expect(
                    response.status
                ).toBe(400);


                expect(
                    getRoute
                ).not.toHaveBeenCalled();

            }
        );


        it(
            'returns 502 when the routing service fails',
            async () => {

                const error =
                    new Error(
                        'OpenRouteService failed'
                    );


                error.name =
                    'ExternalServiceError';


                vi.mocked(
                    getRoute
                ).mockRejectedValue(
                    error
                );


                const response =
                    await request(app)

                        .post(
                            '/api/route'
                        )

                        .send({

                            places: [
                                placeA,
                                placeB
                            ],

                            optimise:
                                false

                        });


                expect(
                    response.status
                ).toBe(502);


                expect(
                    response.body
                ).toEqual({

                    error:
                        'External service unavailable'

                });

            }
        );


        it(
            'returns 504 when the routing service times out',
            async () => {

                const error =
                    new Error(
                        'Request timed out'
                    );


                error.name =
                    'TimeoutError';


                vi.mocked(
                    getRoute
                ).mockRejectedValue(
                    error
                );


                const response =
                    await request(app)

                        .post(
                            '/api/route'
                        )

                        .send({

                            places: [
                                placeA,
                                placeB
                            ],

                            optimise:
                                false

                        });


                expect(
                    response.status
                ).toBe(504);


                expect(
                    response.body
                ).toEqual({

                    error:
                        'External service timed out'

                });

            }
        );

    }
);


/*
|--------------------------------------------------------------------------
| 404
|--------------------------------------------------------------------------
*/

describe(
    'Unknown routes',
    () => {

        it(
            'returns 404 for an endpoint that does not exist',
            async () => {

                const response =
                    await request(app)
                        .get(
                            '/this-does-not-exist'
                        );


                expect(
                    response.status
                ).toBe(404);


                expect(
                    response.body
                ).toEqual({

                    error:
                        'Endpoint not found'

                });

            }
        );

    }
);