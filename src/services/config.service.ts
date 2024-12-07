import { injectable } from 'inversify';

@injectable()
export class ConfigService {
  private config: Record<string, any>;

  constructor(initialConfig: Record<string, any>) {
    this.config = initialConfig;
  }

  get<T>(key: string): T {
    if (!(key in this.config)) {
      throw new Error(`Configuration key "${key}" not found`);
    }
    return this.config[key] as T;
  }
}
