type ContinuationResult<Yields, Result> =
  | {
      done: true;
      value: Result;
    }
  | {
      done: false;
      value: Yields;
      resume: (value: any) => ContinuationResult<Yields, Result>;
    };

let currentCtx: any[] | null = [];

function perform<T = any>(value: T) {
  if (currentCtx === null) {
    throw new Error("Invalid operation.");
  }
  if (currentCtx.length) {
    return currentCtx.pop();
  }
  throw new Perform(value);
}

function createMultiPromptGenerator<T extends (...args: any[]) => any>(fn: T) {
  // multi prompt delimited continuation
  function step<Yields>(
    args: any[],
    context: any[]
  ): ContinuationResult<Yields, ReturnType<T>> {
    try {
      currentCtx = [...context]; // clone
      return {
        done: true,
        value: fn(...args),
      };
    } catch (e) {
      if (e instanceof Perform) {
        return {
          done: false,
          value: e.value,
          resume: (value: any) => step(args, [value, ...context]),
        };
      }
      throw e;
    } finally {
      if (currentCtx!.length) {
        throw new Error(
          "Referential transparency breaks. This should be never expected and can't be recovered."
        );
      }
      currentCtx = null;
    }
  }

  return function <Yields>(
    ...args: Parameters<T>
  ): ContinuationResult<Yields, ReturnType<T>> {
    return step(args, []);
  };
}

class Perform {
  readonly message =
    "You are never expected to capture this, unless you break some rules";

  constructor(public readonly value: any) {}
}

export type { ContinuationResult };

export { perform, createMultiPromptGenerator };
