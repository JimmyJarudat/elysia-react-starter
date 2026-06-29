declare module "bun:test" {
  type TestCallback = () => void | Promise<void>;

  type MockSpy = {
    mockImplementation(implementation: (...args: never[]) => unknown): MockSpy;
    mockRestore(): void;
  };

  export function describe(name: string, callback: TestCallback): void;
  export function test(name: string, callback: TestCallback): void;
  export function afterAll(callback: TestCallback): void;
  export function spyOn<T extends object, K extends keyof T>(object: T, method: K): MockSpy;
  export function expect(actual: unknown): {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toContain(expected: unknown): void;
    toHaveLength(expected: number): void;
    toHaveBeenCalled(): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
  };
}
