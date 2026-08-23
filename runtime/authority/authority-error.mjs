export class RuntimeAuthorityError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "RuntimeAuthorityError";
    this.code = code;
    this.details = details;
  }
}

export function isRuntimeAuthorityError(error) {
  return error instanceof RuntimeAuthorityError;
}
