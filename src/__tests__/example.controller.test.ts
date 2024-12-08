import { ExampleController } from '../controllers/example.controller';

describe('ExampleController', () => {
  let controller: ExampleController;

  beforeEach(() => {
    controller = new ExampleController();
  });

  it('should handle valid data', async () => {
    const data = { name: 'test' };
    const result = await controller.createData(data);
    expect(result).toEqual(data);
  });

  it('should handle invalid data', async () => {
    const data = { test: 'string' } as any;
    await expect(async () => {
      await controller.createData(data);
    }).rejects.toMatchObject({
      status: 400,
      message: 'Validation failed',
    });
  });
});
