import { ApiProperty } from '@nestjs/swagger';
import { IErrorReturnType, ErrorReturnType } from 'src/types/ErrorReturnType';
import { AuthSessionDto } from './auth.dto';

export class AuthResponse {
  @ApiProperty() status: number;
  @ApiProperty({ type: ErrorReturnType, required: false }) error: IErrorReturnType | null;
  @ApiProperty({ type: AuthSessionDto, required: false }) data: AuthSessionDto | null;
}
