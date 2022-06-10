type Value<T = unknown> = ImmediateError | ImmediateValue<T> | Promised<T>;

const TYPE_IMMEDIATE = 0,
  TYPE_ERROR = 1,
  TYPE_PROMISED = 2;
type ValueType =
  | typeof TYPE_IMMEDIATE
  | typeof TYPE_ERROR
  | typeof TYPE_PROMISED;

class ImmediateValue<T> {
  type: typeof TYPE_IMMEDIATE = TYPE_IMMEDIATE;
  constructor(public readonly value: T) {}

  map<R>(fn: (source: T) => R): Value<R> {
    return new ImmediateValue(fn(this.value));
  }

  bind<R>(fn: (source: T) => Value<R>): Value<R> {
    return fn(this.value);
  }
}

class ImmediateError {
  type: typeof TYPE_ERROR = TYPE_ERROR;
  constructor(public readonly error: any) {}

  map<R>() {
    return this as Value<R>;
  }

  bind<R>(): Value<R> {
    return this as Value<R>
  }
}

class Promised<T> {
  type: typeof TYPE_PROMISED = TYPE_PROMISED;
  constructor(public readonly promise: Promise<T>) {}

  map<R>(fn: (source: T) => R): Value<R> {
    return new Promised(this.promise.then(fn));
  }

  bind<R>(fn: (source: T) => Value<R>): Value<R> {
    return new Promised(this.promise.then(v => {
      const s = fn(v);
      if(s.type === TYPE_PROMISED) { return s.promise };
      if(s.type === TYPE_ERROR) { return Promise.reject(s.error);  };
      return s.value;
    }))
  }
}

export {
  Promised, ImmediateError, ImmediateValue
};
export type { Value };
