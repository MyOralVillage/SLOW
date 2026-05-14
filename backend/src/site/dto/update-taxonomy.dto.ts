import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, MaxLength } from "class-validator";

const maxItemLen = 200;
const maxListLen = 500;

export class UpdateTaxonomyDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(maxListLen)
  @IsString({ each: true })
  @MaxLength(maxItemLen, { each: true })
  countries!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(maxListLen)
  @IsString({ each: true })
  @MaxLength(maxItemLen, { each: true })
  mainCategories!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(maxListLen)
  @IsString({ each: true })
  @MaxLength(maxItemLen, { each: true })
  crossCuttingCategories!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(maxListLen)
  @IsString({ each: true })
  @MaxLength(maxItemLen, { each: true })
  productDetails!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(maxListLen)
  @IsString({ each: true })
  @MaxLength(maxItemLen, { each: true })
  institutions!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(maxListLen)
  @IsString({ each: true })
  @MaxLength(maxItemLen, { each: true })
  keywordOptions!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(maxListLen)
  @IsString({ each: true })
  @MaxLength(maxItemLen, { each: true })
  types!: string[];
}
