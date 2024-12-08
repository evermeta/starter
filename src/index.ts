import express from 'express';
import { RegisterRoutes } from './routes/routes';

const app = express();
app.use(express.json());

RegisterRoutes(app);

export { app };
