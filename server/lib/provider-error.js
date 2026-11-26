export class ProviderError extends Error {
  constructor(message, definitive = false) {
    super(message);
    this.definitive = definitive;
  }
}
