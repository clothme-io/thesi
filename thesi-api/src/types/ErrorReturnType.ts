import { ApiProperty } from '@nestjs/swagger';

export interface IErrorReturnType {
  status: number;
  message: string;
}

export class ErrorReturnType implements IErrorReturnType {
  @ApiProperty() status: number;
  @ApiProperty() message: string;
}
