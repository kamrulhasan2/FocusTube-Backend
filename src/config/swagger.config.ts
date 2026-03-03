import path from 'path';
import fs from 'fs';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import * as OpenApiValidator from 'express-openapi-validator';
import { configEnv } from './env.config';
import { logger } from '../shared/utils';



export const swaggerDocSetup =  (app: any) => {
    try {
        const distSpec = path.join(__dirname, '../docs/swagger.yaml');
        const srcSpec = path.join(process.cwd(), 'src', 'docs', 'swagger.yaml');
        const apiSpec = fs.existsSync(distSpec) ? distSpec : srcSpec;
        const swaggerDocument = YAML.load(apiSpec);

        // Serve Swagger UI at the /api-docs endpoint
        app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

        app.use(
            OpenApiValidator.middleware({
                apiSpec: apiSpec,
                validateRequests: true, // Validate request bodies, parameters, and headers
                validateResponses: true, // Optional: Validate responses
            }),
        );

        logger.info(`Swagger doc is connect on: http://localhost:${configEnv.port}/api-docs`);

    } catch (error) {
        logger.error('Swagger Doc connection Error: ', error)
        throw error;
    }
}

