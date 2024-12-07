import { injectable } from 'inversify';

@injectable()
export class ConfigService {
  private config: Record<string, any>;

  constructor(initialConfig: Record<string, any>) {
    this.config = initialConfig;
  }

  get<T>(key: string, defaultValue?: T): T {
    if (!(key in this.config)) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      return undefined as T;
    }
    return this.config[key] as T;
  }
}
