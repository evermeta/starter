/**
 * @swagger
 * components:
 *   schemas:
 *     CreateExampleDto:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: The name of the example
 *           example: Test Example
 *         description:
 *           type: string
 *           description: The description of the example
 *           example: This is a test example
 *       required:
 *         - name
 *         - description
 */
export class CreateExampleDto {
  name!: string;
  description!: string;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     ExampleResponseDto:
 *       type: object
 *       properties:
 *         id:
 *           type: number
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 */
export class ExampleResponseDto {
  id!: number;
  name!: string;
  description!: string;
  createdAt!: Date;
}
