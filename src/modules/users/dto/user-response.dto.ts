import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'User ID',
  })
  id: string;

  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Email of the user',
  })
  email: string;

  @ApiProperty({
    example: 'John',
    description: 'First name of the user',
    nullable: true,
  })
  firstName: string | null;

  @ApiProperty({
    example: 'Doe',
    description: 'Last name of the user',
    nullable: true,
  })
  lastName: string | null;

  @ApiProperty({
    description: 'Role of the user',
    enum: Role,
  })
  role: Role;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Date and time when the user was created',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-02T00:00:00.000Z',
    description: 'Date and time when the user was last updated',
  })
  updatedAt: Date;
}
