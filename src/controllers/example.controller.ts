import { Body, Controller, Get, Post, Route } from '@tsoa/runtime';
import { IsNotEmpty, IsString } from 'class-validator';
import { validateOrReject } from 'class-validator';

class CreateExampleDto {
  @IsNotEmpty()
  @IsString()
  name!: string;
}

@Route('api/example')
export class ExampleController extends Controller {
  @Get()
  public async getData() {
    return { message: 'Example data' };
  }

  @Post()
  public async createData(@Body() data: CreateExampleDto) {
    try {
      const dto = new CreateExampleDto();
      Object.assign(dto, data);
      await validateOrReject(dto);
      return data;
    } catch (error) {
      this.setStatus(400);
      throw {
        status: 400,
        message: 'Validation failed',
        fields: {
          'data.name': {
            message: "'name' is required",
            value: data.name,
          },
        },
      };
    }
  }

  @Post('trigger-error')
  public async triggerError(
    @Body() data: { name: string; code: number; message: string },
  ): Promise<void> {
    const error = new Error(data.message);
    (error as any).status = data.code;
    throw error;
  }
}
