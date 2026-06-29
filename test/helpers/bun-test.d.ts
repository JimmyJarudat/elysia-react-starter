declare module "bun:test" {
  type TestCallback = () => void | Promise<void>;

  type MockSpy = {
    mockImplementation(implementation: (...args: never[]) => unknown): MockSpy;
    mockRestore(): void;
  };

  type Matchers<T = unknown> = {
    not: Matchers<T>;
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toContain(expected: unknown): void;
    toHaveLength(expected: number): void;
    toHaveBeenCalled(): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toThrow(expected?: string | RegExp): void;
  };

  export function describe(name: string, callback: TestCallback): void;
  export function test(name: string, callback: TestCallback): void;
  export function beforeAll(callback: TestCallback): void;
  export function afterAll(callback: TestCallback): void;
  export function beforeEach(callback: TestCallback): void;
  export function afterEach(callback: TestCallback): void;
  export function spyOn<T extends object, K extends keyof T>(object: T, method: K): MockSpy;
  export function expect<T = unknown>(actual: T): Matchers<T>;
}
