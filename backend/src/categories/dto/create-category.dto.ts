import { IsIn, IsString, MaxLength, MinLength } from "class-validator";

export class CreateCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsIn(["main", "cross_cutting"])
  group_type!: "main" | "cross_cutting";
}
