import {
  ContinuationResult,
  createMultiPromptGenerator,
  perform,
} from "./continuation";
import { HierarchicalId } from "./hierarchy";
import { ImmediateError, ImmediateValue, Promised, Value } from "./value";

interface State<T> {
  readonly latest: Value<T>;
  subscribe(next: Function): Function;
}

class ContainerInternal<T = unknown> {

  constructor(
    public readonly hid: HierarchicalId
  ) {}
  subscribe(next: Function) {}
}

type Setter<T> = (value: Value<T>) => void;

type Reader = <T>(container: State<T> | Value<T>) => T;

type ComputeDerivation<T> = () => ContinuationResult<State<any> | Value, T>;

type DerivationDefinition<T> = {
  initial: Value<T>;
  fn: ComputeDerivation<T>;
};

const state = (() => {
  function state<T>(initial: Value<T>) {
    return perform<Operations>({
      type: "state",
      initial,
    }) as [State<T>, Setter<T>];
  }

  state.of = <T>(value: T) => state(fromValue(value));
  state.ofError = (error: any) => state(fromError(error));
  state.fromPromise = <T>(promise: Promise<T>) => state(fromPromise(promise));

  return state;
})();

const derive = (() => {
  function derive<T>(definition: DerivationDefinition<T>) {
    return perform<Operations>({
      type: "derivation",
      initial: definition.initial,
      gen: definition.fn,
    }) as State<T>;
  }

  derive.fromFormula = <R>(formula: (read: Reader) => R) =>
    derive(fromFormula(formula));
  derive.fromLifting = <Inputs extends readonly unknown[], Return>(
    inputs: [...InputTuple<Inputs>],
    liftFn: (...args: Inputs) => Value<Return>
  ) => derive(fromLifting(inputs, liftFn));

  // derive.fromFormula = <X>(formula:X) => {
  //   return derive(fromFormula(formula));
  // }

  // derive.fromLifting =

  return derive;
})();

type Operations<T = unknown> =
  | {
      type: "state";
      initial: Value<T>;
    }
  | {
      type: "derivation";
      initial: Value<T>;
      gen: ComputeDerivation<T>;
    };

function createUpdate(hid: HierarchicalId) {
  return function update(value:Value) {

  }
}

function root<T>(program: () => T, r: HierarchicalId) {
  const gen = createMultiPromptGenerator(program);
  let result = gen<Operations>();
  let stateGraph: (
    | {
        type: "state";
        current: Value<any>;
      }
    | {
        type: "computation";
        current: Value<any>;
        fn: ComputeDerivation<any>;
      }
  )[] = [];
  while (!result.done) {
    const offset = r.next();
    r = offset;
    if (result.value.type === "state") {
      stateGraph.push({
        type: "state",
        current: result.value.initial,
      });
      result = result.resume([
        new ContainerInternal(offset),
        (v: Value) => {
          //TODO:
        },
      ]);
    } else {
      stateGraph.push({
        type: "computation",
        current: result.value.initial,
        fn: result.value.gen,
      });
      result = result.resume(new ContainerInternal(offset));
    }
  }
  const update = (patch: { [key: number]: Value }) => {
    const currentStateList: Value<any>[] = [];
  };
  update({});
  return result.value;
}

const read: Reader = perform;

function computeNew<T>(
  previous: Value<T>,
  context: Value<any>[],
  computation: ComputeDerivation<T>,
  self: HierarchicalId
) {
  function cont<T>(
    res: ContinuationResult<State<any> | Value, T>
  ): Value<T> {
    if (res.done) {
      return new ImmediateValue(res.value);
    }
    const container = res.value as ContainerInternal | Value;
    if (container instanceof ContainerInternal) {
      if (!self.checkReachability(container.hid)) {
        return new ImmediateError(new ReferenceError("Out of range"));
      }
      const current:Value<T> = ;
      return current
        .bind((v) => cont(res.resume(v)));
    } else {
      return container.bind((v) => cont(res.resume(v)));
    }
  }
  return cont(computation());
}

class InconsistencyError extends Error {}

function getSyncConsistentValue<T>(value: Value<T>) {
  try {
    if (value instanceof ImmediateValue) {
      return value.value;
    }
    if (value instanceof ImmediateError) {
      throw value.error;
    }
    throw new InconsistencyError("Inconsistency occurred");
  } catch (error) {
    ((Error as any)["captureStackTrace"] as any)(error, getSyncConsistentValue);
    throw error;
  }
}

function getConsistentValue<T>(value: Value<T>) {
  if (value instanceof ImmediateValue) {
    return value.value;
  }
  if (value instanceof ImmediateError) {
    throw value.error;
  }
  return value.promise;
}

function getAsyncLatestValue() {
  return new Promise((resolve, reject) => {});
}

/** */

function fromValue<T>(value: T): Value<T> {
  return new ImmediateValue(value);
}

function fromError(error: any): Value<any> {
  return new ImmediateError(error);
}

function fromPromise<T>(promise: Promise<T>): Value<T> {
  return new Promised(promise);
}

function fromFormula<R>(formula: (read: Reader) => R): DerivationDefinition<R> {
  return {
    initial: fromError("Not expect to read"),
    fn: createMultiPromptGenerator(() => formula(read)),
  };
}

type InputTuple<T> = { [K in keyof T]: State<T[K]> };

function fromLifting<Inputs extends readonly unknown[], Return>(
  inputs: [...InputTuple<Inputs>],
  liftFn: (...args: Inputs) => Value<Return>
): DerivationDefinition<Return> {
  function reduce(
    remainInputs: any[],
    collectedData: any
  ): ContinuationResult<State<any> | Value, Return> {
    if (remainInputs.length === 0) {
      return {
        done: false,
        value: liftFn(...collectedData),
        resume: (value: any) => {
          return {
            done: true,
            value,
          };
        },
      };
    }
    return {
      done: false,
      value: remainInputs[0],
      resume: (x: any) => reduce(remainInputs.slice(1), [...collectedData, x]),
    };
  }
  return {
    initial: fromError("not expected to read"),
    fn: () => reduce(inputs, []),
  };
}

export {
  root,
  state,
  derive,
  fromError,
  fromValue,
  fromPromise,
  fromFormula,
  fromLifting,
  getSyncConsistentValue,
  getConsistentValue,
};
export type { State };
