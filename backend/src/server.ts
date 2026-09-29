import 'dotenv/config';

import app, {
    logger
} from './app.ts';


const PORT =
    Number(
        process.env.PORT
        ?? 3000
    );


/*
|--------------------------------------------------------------------------
| Validate port
|--------------------------------------------------------------------------
*/

if (
    !Number.isInteger(PORT)
    ||
    PORT < 1
    ||
    PORT > 65535
) {

    throw new Error(
        'PORT must be a valid port number'
    );

}


/*
|--------------------------------------------------------------------------
| Start server
|--------------------------------------------------------------------------
*/

app.listen(
    PORT,
    () => {

        logger.info(
            {
                port:
                    PORT,

                frontendUrl:
                    process.env.FRONTEND_URL
                    ?? 'http://localhost:5173'
            },
            'City Explorer API started'
        );

    }
);