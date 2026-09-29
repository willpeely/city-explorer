import {
    describe,
    expect,
    it
} from 'vitest';

import {
    optimiseRoute
} from '../services/routeOptimiser.ts';

import type {
    Place
} from '../services/overpass.ts';

const placeA: Place = {
    id: 1,
    name: 'Place A',
    lat: 51.5,
    lon: -0.1,
    category: 'cafe'
};

const placeB: Place = {
    id: 2,
    name: 'Place B',
    lat: 51.51,
    lon: -0.11,
    category: 'cafe'
};

const placeC: Place = {
    id: 3,
    name: 'Place C',
    lat: 51.52,
    lon: -0.12,
    category: 'cafe'
};

const placeD: Place = {
    id: 4,
    name: 'Place D',
    lat: 51.53,
    lon: -0.13,
    category: 'cafe'
};


describe('optimiseRoute', () => {

    it('keeps a two-place route unchanged', () => {

        const places = [
            placeA,
            placeB
        ];

        const distances = [
            [0, 10],
            [10, 0]
        ];

        const result =
            optimiseRoute(
                places,
                distances
            );

        expect(result)
            .toEqual(places);

    });


    it('chooses the nearest next place', () => {

        const places = [
            placeA,
            placeB,
            placeC
        ];

        const distances = [
            [0, 10, 2],
            [10, 0, 1],
            [2, 1, 0]
        ];

        const result =
            optimiseRoute(
                places,
                distances
            );

        expect(
            result.map(
                place => place.id
            )
        ).toEqual([
            1,
            3,
            2
        ]);

    });


    it('uses 2-opt to improve the route', () => {

        const places = [
            placeA,
            placeB,
            placeC,
            placeD
        ];

        const distances = [
            [0, 5, 6, 50],
            [5, 0, 1, 2],
            [6, 1, 0, 20],
            [50, 2, 20, 0]
        ];

        const result =
            optimiseRoute(
                places,
                distances
            );

        expect(
            result.map(
                place => place.id
            )
        ).toEqual([
            1,
            3,
            2,
            4
        ]);

    });


    it('throws for an invalid distance matrix', () => {

        const places = [
            placeA,
            placeB,
            placeC
        ];

        const invalidDistances = [
            [0, 10],
            [10, 0]
        ];

        expect(
            () =>
                optimiseRoute(
                    places,
                    invalidDistances
                )
        ).toThrow();

    });

});