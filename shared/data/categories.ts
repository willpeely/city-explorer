export type PlaceCategory = {
    value: string;
    label: string;
    key: string;
    osmValue: string;
};

export type CategoryGroup = {
    label: string;
    places: PlaceCategory[];
};

export const categories: Record<string, CategoryGroup> = {
    food: {
        label: 'Food & Drink',
        places: [
            {
                value: 'cafe',
                label: 'Cafes',
                key: 'amenity',
                osmValue: 'cafe'
            },
            {
                value: 'restaurant',
                label: 'Restaurants',
                key: 'amenity',
                osmValue: 'restaurant'
            },
            {
                value: 'pub',
                label: 'Pubs',
                key: 'amenity',
                osmValue: 'pub'
            }
        ]
    },

    shopping: {
        label: 'Shopping',
        places: [
            {
                value: 'gift',
                label: 'Gift Shops',
                key: 'shop',
                osmValue: 'gift'
            },
            {
                value: 'clothes',
                label: 'Clothes',
                key: 'shop',
                osmValue: 'clothes'
            },
            {
                value: 'supermarket',
                label: 'Supermarkets',
                key: 'shop',
                osmValue: 'supermarket'
            },
            {
                value: 'books',
                label: 'Book Shops',
                key: 'shop',
                osmValue: 'books'
            }
        ]
    },

    thingsToDo: {
        label: 'Things To Do',
        places: [
            {
                value: 'museum',
                label: 'Museums',
                key: 'tourism',
                osmValue: 'museum'
            },
            {
                value: 'gallery',
                label: 'Galleries',
                key: 'tourism',
                osmValue: 'gallery'
            },
            {
                value: 'park',
                label: 'Parks',
                key: 'leisure',
                osmValue: 'park'
            }
        ]
    }
};