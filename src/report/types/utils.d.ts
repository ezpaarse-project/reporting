type Promisify<F extends (...args: any) => any> = (
  ...args: Parameters<F>
) => Promise<ReturnType<F>>;

// https://stackoverflow.com/a/61132308
type DeepPartial<T> = T extends object
  ? {
    [P in keyof T]?: DeepPartial<T[P]>;
  }
  : T;