export class IntegrationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "IntegrationError";
    this.code = code;
  }
}
