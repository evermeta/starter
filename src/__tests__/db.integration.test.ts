import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { beforeAll, afterAll, describe, it, expect } from '@jest/globals';
import { Client } from 'pg';
import { DockerComposeEnvironment } from 'testcontainers';

describe('Database Integration Tests', () => {
    let container: StartedPostgreSqlContainer;
    let client: Client;

    beforeAll(async () => {
        try {
            console.log('Starting PostgreSQL container...');
            
            // Create PostgreSQL container with explicit configuration
            container = await new PostgreSqlContainer()
                .withDatabase('testdb')
                .withUsername('test')
                .withPassword('test')
                .withExposedPorts(5432)
                .withStartupTimeout(120000) // 2 minutes timeout
                .start();

            console.log('Container started successfully');
            console.log('Host:', container.getHost());
            console.log('Port:', container.getMappedPort(5432));

            // Create a PostgreSQL client
            client = new Client({
                host: container.getHost(),
                port: container.getMappedPort(5432),
                database: 'testdb',
                user: 'test',
                password: 'test'
            });
            
            console.log('Connecting to database...');
            await client.connect();
            console.log('Database connection established');
            
        } catch (error) {
            console.error('Error during setup:', error);
            throw error;
        }
    }, 120000); // Increased timeout to 2 minutes

    afterAll(async () => {
        try {
            await client?.end();
            if (container) {
                await container.stop();
            }
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    });

    it('should connect and execute a simple query', async () => {
        const result = await client.query('SELECT 1 as number');
        expect(result.rows[0].number).toBe(1);
    });
}); 