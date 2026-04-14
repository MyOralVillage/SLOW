import { IsArray, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateResourceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  country!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  category!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  productDetail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  crossCuttingCategory?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  institution?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  type!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(220)
  originalFilename?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  externalUrl?: string;
}
