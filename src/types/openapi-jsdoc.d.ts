declare module 'openapi-jsdoc' {
  interface OpenAPIOptions {
    definition: {
      openapi: string;
      info: {
        title: string;
        version: string;
        description?: string;
      };
      servers?: Array<{
        url: string;
        description?: string;
      }>;
    };
    apis: string[];
  }

  function openapiJsdoc(options: OpenAPIOptions): any;
  export default openapiJsdoc;
}
