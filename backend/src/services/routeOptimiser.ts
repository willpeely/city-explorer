import type { Place } from './places.ts';


export function optimiseRoute(
    places: Place[],
    distances: number[][]
): Place[] {

    validateDistanceMatrix(
        places,
        distances
    );


    if (places.length <= 2) {

        return [...places];

    }


    const remaining =
        places.map((_, index) => index);


    const route: number[] = [];


    /*
    | Start with the first place selected by the user.
    */

    let currentIndex =
        remaining.shift()!;


    route.push(currentIndex);


    /*
    |--------------------------------------------------------------------------
    | Nearest-neighbour optimisation
    |--------------------------------------------------------------------------
    */

    while (remaining.length > 0) {

        let closestIndex = 0;

        let closestDistance = Infinity;


        for (
            let i = 0;
            i < remaining.length;
            i++
        ) {

            const candidateIndex =
                remaining[i];


            const distance =
                distances[currentIndex][candidateIndex];


            if (distance < closestDistance) {

                closestDistance = distance;

                closestIndex = i;

            }
        }


        currentIndex =
            remaining.splice(
                closestIndex,
                1
            )[0];


        route.push(currentIndex);

    }


    /*
    |--------------------------------------------------------------------------
    | Improve nearest-neighbour route using 2-opt
    |--------------------------------------------------------------------------
    */

    const improvedRoute =
        improveRoute(
            route,
            distances
        );


    return improvedRoute.map(
        index => places[index]
    );

}


/*
|--------------------------------------------------------------------------
| Validate distance matrix
|--------------------------------------------------------------------------
*/

function validateDistanceMatrix(
    places: Place[],
    distances: number[][]
): void {

    if (
        distances.length !== places.length
    ) {

        throw new Error(
            'Distance matrix does not match number of places'
        );

    }


    for (
        let rowIndex = 0;
        rowIndex < distances.length;
        rowIndex++
    ) {

        const row =
            distances[rowIndex];


        if (
            row.length !== places.length
        ) {

            throw new Error(
                `Distance matrix row ${rowIndex} has invalid length`
            );

        }


        for (const distance of row) {

            if (
                !Number.isFinite(distance) ||
                distance < 0
            ) {

                throw new Error(
                    'Distance matrix contains an invalid distance'
                );

            }

        }

    }

}


/*
|--------------------------------------------------------------------------
| 2-opt route improvement
|--------------------------------------------------------------------------
*/

function improveRoute(
    route: number[],
    distances: number[][]
): number[] {

    const improvedRoute =
        [...route];


    let improved = true;


    while (improved) {

        improved = false;


        for (
            let i = 1;
            i < improvedRoute.length - 2;
            i++
        ) {

            for (
                let j = i + 1;
                j < improvedRoute.length - 1;
                j++
            ) {

                const currentDistance =

                    distances[
                        improvedRoute[i - 1]
                    ][
                        improvedRoute[i]
                    ]

                    +

                    distances[
                        improvedRoute[j]
                    ][
                        improvedRoute[j + 1]
                    ];


                const newDistance =

                    distances[
                        improvedRoute[i - 1]
                    ][
                        improvedRoute[j]
                    ]

                    +

                    distances[
                        improvedRoute[i]
                    ][
                        improvedRoute[j + 1]
                    ];


                if (
                    newDistance <
                    currentDistance
                ) {

                    const reversedSection =

                        improvedRoute
                            .slice(
                                i,
                                j + 1
                            )
                            .reverse();


                    improvedRoute.splice(
                        i,
                        j - i + 1,
                        ...reversedSection
                    );


                    improved = true;

                }

            }

        }

    }


    return improvedRoute;

}