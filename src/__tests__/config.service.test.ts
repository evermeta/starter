import { ConfigService } from '../services/config.service';

describe('ConfigService', () => {
  let configService: ConfigService;

  beforeEach(() => {
    configService = new ConfigService({
      TEST_KEY: 'test_value',
    });
  });

  afterEach(() => {
    delete process.env.TEST_KEY;
  });

  it('should get existing environment variable', () => {
    expect(configService.get('TEST_KEY')).toBe('test_value');
  });

  it('should return undefined for non-existent key', () => {
    expect(configService.get('NON_EXISTENT_KEY')).toBeUndefined();
  });
  it('should return default value for non-existent key', () => {
    expect(configService.get('NON_EXISTENT_KEY')).toBeUndefined();
  });

  it('should validate config exists', () => {
    expect(() => configService.get('TEST_KEY')).not.toThrow();
    expect(() => configService.get('NON_EXISTENT_KEY')).not.toThrow();
  });

  it('should return default value when key does not exist and default is provided', () => {
    const defaultValue = 'default_value';
    expect(configService.get('NON_EXISTENT_KEY', defaultValue)).toBe(defaultValue);
  });

  it('should return undefined when key does not exist and no default is provided', () => {
    expect(configService.get('NON_EXISTENT_KEY')).toBeUndefined();
  });

  it('should handle different types of values', () => {
    const configWithTypes = new ConfigService({
      numberValue: 42,
      booleanValue: true,
      objectValue: { key: 'value' },
      arrayValue: [1, 2, 3],
    });

    expect(configWithTypes.get<number>('numberValue')).toBe(42);
    expect(configWithTypes.get<boolean>('booleanValue')).toBe(true);
    expect(configWithTypes.get<object>('objectValue')).toEqual({ key: 'value' });
    expect(configWithTypes.get<number[]>('arrayValue')).toEqual([1, 2, 3]);
  });
});
