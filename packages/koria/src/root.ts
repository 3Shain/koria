import {
  ContinuationResult,
  createMultiPromptGenerator,
  perform,
} from "./continuation";
import { ImmediateError, ImmediateValue, Promised, Value } from "./value";

interface State<T> {
  readonly latest: Value<T>;
  subscribe(next: Function): Function;
}

class ContainerInternal<T = unknown> {
  get latest() {
    return this.getValue();
  }
  constructor(
    public readonly index: number,
    private getValue: () => Value<T>
  ) {}
  subscribe(next: Function) {}
}

const Self = new ContainerInternal(-1, () => {
  throw new Error("Unexpected");
});

type Setter<T> = (value: T) => void;

type Reader = <T>(container: State<T> | Value<T>) => T;

type ComputeDerivation<T> = () => ContinuationResult<State<any> | Value, T>;

type DerivationDefinition<T> = {
  initial: Value<T>;
  fn: ComputeDerivation<T>;
};

const state = (()=>{
  function state<T>(initial: Value<T>) {
    return perform<Operations>({
      type: "state",
      initial,
    }) as [State<T>, Setter<T>];
  }

  state.fromValue = <T>(value:T) => state(fromValue(value))
  state.fromError = (error: any) => state(fromError(error))
  state.fromPromise = <T>(promise:Promise<T>) => state(fromPromise(promise));

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

function root<T>(program: () => T) {
  const gen = createMultiPromptGenerator(program);
  let result = gen<Operations>();
  let chain: (
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
  const getLatest = (v: number) => () => chain[v].current.map((x) => x[1]);
  while (!result.done) {
    let offset = chain.length - 1;
    if (result.value.type === "state") {
      chain.push({
        type: "state",
        current: new ImmediateValue([[], result.value.initial]),
      });
      result = result.resume([
        new ContainerInternal(offset, getLatest(offset)),
        (value: any) => update({ [offset]: new ImmediateValue([[], value]) }),
      ]);
    } else if (result.value.type === "derivation") {
      chain.push({
        type: "computation",
        current: new ImmediateValue([[], result.value.initial]),
        fn: result.value.gen,
      });
      result = result.resume(new ContainerInternal(offset, getLatest(offset)));
    } else {
      throw new Error("Invalid operation");
    }
  }
  const update = (patch: { [key: number]: Value }) => {
    const currentStateList: Value<[number[], any]>[] = [];
    for (let i = 0; i < chain.length; i++) {
      const old = chain[i];

      /* possible bail out */
      // if(old instanceof ImmediateValue) {
      //   const [s] = old.value;
      // }
      if (old.type === "state") {
        currentStateList.push(
          (old.current = patch[i] ? patch[i].map((x) => [[], x]) : old.current)
        );
      } else {
        currentStateList.push(
          (old.current = computeNew(old.current, currentStateList, old.fn, i))
        );
      }
    }
  };
  update({});
  return result.value;
}

const read: Reader = perform;

function computeNew<T>(
  previous: Value<[number[], T]>,
  context: Value<[number[], any]>[],
  computation: ComputeDerivation<T>,
  validOffset: number
) {
  function cont<T>(
    res: ContinuationResult<State<any> | Value, T>
  ): Value<[number[], T]> {
    if (res.done) {
      return new ImmediateValue([[], res.value]);
    }
    const container = res.value as ContainerInternal | Value;
    if (container instanceof ContainerInternal) {
      // if(container instanceof )
      // todo: might be just a value
      if (container.index > validOffset) {
        return new ImmediateError([[], new Error("Out of index")]);
      }
      const current =
        container.index === -1 ? previous : context[container.index];
      return current
        .bind((v) => cont(res.resume(v[1])))
        .map(([s, v]) => [[container.index, ...s], v]);
    } else {
      return container.bind((v) => cont(res.resume(v)));
    }
  }
  return cont(computation());
}

class InconsistencyError extends Error {}

function getSyncConsistentValue<T>(value: Value<T>) {
  if (value instanceof ImmediateValue) {
    return value.value;
  }
  if (value instanceof ImmediateError) {
    throw value.error;
  }
  throw new InconsistencyError();
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
