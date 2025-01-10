declare module '@semantic-release/error' {
  export default class SemanticReleaseError {
    private message: any;
    private code: any;
    private details: any;

    constructor(message?: any, code?: any, details?: any);
  }
}
