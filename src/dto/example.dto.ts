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
import { IsNotEmpty, IsString, IsEnum } from 'class-validator';

export enum ExampleStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export class CreateExampleDto {
  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsNotEmpty()
  @IsString()
  description!: string;

  @IsEnum(ExampleStatus)
  status!: ExampleStatus;
}

export class UpdateExampleDto {
  @IsString()
  @IsNotEmpty({
    message: 'name should not be empty when provided',
  })
  name?: string;

  @IsString()
  @IsNotEmpty({
    message: 'description should not be empty when provided',
  })
  description?: string;

  @IsEnum(ExampleStatus)
  status?: ExampleStatus;
}
/**
 */
