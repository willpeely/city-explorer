import { optimiseRoute } from './services/routeOptimiser.ts';

const places = [
    { id: 1, name: 'A', lat: 54.0720, lon: -1.9970, category: 'test' },
    { id: 2, name: 'B', lat: 54.0720, lon: -1.9900, category: 'test' },
    { id: 3, name: 'C', lat: 54.0720, lon: -2.0050, category: 'test' },
    { id: 4, name: 'D', lat: 54.0800, lon: -2.0050, category: 'test' }
];

const distances = [
    [0, 686.52, 674.48, 1340],
    [686.52, 0, 1242.68, 1537.69],
    [674.48, 1242.68, 0, 1364.42],
    [1340, 1537.69, 1364.42, 0]
];

console.log('Original:');
console.log(places.map(place => place.name));

const optimisedRoute = optimiseRoute(
    places,
    distances
);

console.log('Optimised:');
console.log(optimisedRoute.map(place => place.name));

console.log('Objects:');
console.log(optimisedRoute);