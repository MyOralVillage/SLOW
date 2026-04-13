import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { Type } from "class-transformer";

export class SearchResourcesDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  type?: string;

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

  @IsOptional()
  @IsString()
  @MaxLength(200)
  keywords?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  query?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 24;
}
