import type { Place } from './overpass.ts';

export function optimiseRoute(
    places: Place[],
    distances: number[][]
): Place[] {

    if (places.length <= 2) {
        return places;
    }

    const remaining = places.map((_, index) => index);
    const route: number[] = [];

    // Start with the first place selected by the user.
    let currentIndex = remaining.shift()!;
    route.push(currentIndex);

    while (remaining.length > 0) {

        let closestIndex = 0;
        let closestDistance = Infinity;

        for (let i = 0; i < remaining.length; i++) {

            const candidateIndex = remaining[i];

            const distance =
                distances[currentIndex][candidateIndex];

            if (distance < closestDistance) {
                closestDistance = distance;
                closestIndex = i;
            }
        }

        currentIndex =
            remaining.splice(closestIndex, 1)[0];

        route.push(currentIndex);
    }

    const improvedRoute = improveRoute(route, distances);

    return improvedRoute.map(index => places[index]);
}

function improveRoute(
    route: number[],
    distances: number[][]
): number[] {

    let improved = true;

    while (improved) {
        improved = false;

        for (let i = 1; i < route.length - 2; i++) {

            for (let j = i + 1; j < route.length - 1; j++) {

                const currentDistance =
                    distances[route[i - 1]][route[i]] +
                    distances[route[j]][route[j + 1]];

                const newDistance =
                    distances[route[i - 1]][route[j]] +
                    distances[route[i]][route[j + 1]];

                if (newDistance < currentDistance) {

                    const reversedSection =
                        route
                            .slice(i, j + 1)
                            .reverse();

                    route.splice(
                        i,
                        j - i + 1,
                        ...reversedSection
                    );

                    improved = true;
                }
            }
        }
    }

    return route;
}