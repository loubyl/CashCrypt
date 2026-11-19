// Typed errors thrown by the data layer.
import type { FieldError } from "@/lib/validation/inputs";

/** Thrown when input fails validation before any write. */
export class DbValidationError extends Error {
  readonly errors: FieldError[];

  constructor(errors: FieldError[]) {
    super(errors.map((e) => `${e.field}: ${e.message}`).join("; ") || "Invalid input.");
    this.name = "DbValidationError";
    this.errors = errors;
  }
}

/** Thrown when a row id does not exist. */
export class DbNotFoundError extends Error {
  readonly id: string;

  constructor(id: string) {
    super(`Record not found: ${id}`);
    this.name = "DbNotFoundError";
    this.id = id;
  }
}
