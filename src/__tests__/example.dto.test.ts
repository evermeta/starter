import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateExampleDto, UpdateExampleDto } from '../dto/example.dto';

describe('Example DTOs', () => {
  describe('CreateExampleDto', () => {
    it('should validate a valid DTO', async () => {
      const dto = plainToInstance(CreateExampleDto, {
        name: 'Test Name',
        description: 'Test Description',
        status: 'active',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation with invalid data', async () => {
      const dto = plainToInstance(CreateExampleDto, {
        name: '', // empty string
        description: 123, // wrong type
        status: 'invalid', // invalid enum value
      });

      const errors = await validate(dto);
      console.log('Validation errors:', errors);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('UpdateExampleDto', () => {
    it('should validate a valid partial DTO', async () => {
      const dto = plainToInstance(UpdateExampleDto, {
        name: 'Updated Name',
      });

      const errors = await validate(dto, { skipMissingProperties: true });
      expect(errors.length).toBe(0);
    });

    it('should validate with all fields', async () => {
      const dto = plainToInstance(UpdateExampleDto, {
        name: 'Updated Name',
        description: 'Updated Description',
        status: 'inactive',
      });

      const errors = await validate(dto, { skipMissingProperties: true });
      expect(errors.length).toBe(0);
    });
  });
});
