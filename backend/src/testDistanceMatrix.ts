import { getDistanceMatrix } from './services/openroute.ts';

const places = [
    { lat: 54.0720, lon: -1.9970 },
    { lat: 54.0720, lon: -1.9900 },
    { lat: 54.0720, lon: -2.0050 },
    { lat: 54.0800, lon: -2.0050 }
];

const distances = await getDistanceMatrix(places);

console.log('Distance matrix:');
console.log(distances);