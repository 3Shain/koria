import {
  ContinuationResult,
  createMultiPromptGenerator,
  perform,
} from "./continuation";
import { ImmediateError, ImmediateValue, Value } from "./value";

class Container<T = unknown> {
  get latest() {
    return this.getValue();
  }
  constructor(
    public readonly index: number,
    private getValue: () => Value<T>
  ) {}
  subscribe(next: Function) {}
}

type Setter<T> = (value: T) => void;

type Reader = <T>(container: Container<T>) => T;

function defineState<T>(initial: T) {
  return perform<Operations>({
    type: "state",
    initial,
  }) as [Container<T>, Setter<T>];
}

function defineDerivation<T>(
  initial: T,
  formula: (reader: Reader, self: Container<T>) => T
) {
  return perform<Operations>({
    type: "derivation",
    initial,
    gen: createMultiPromptGenerator((self) => formula(read, self)),
  }) as Container<T>;
}

type Operations =
  | {
      type: "state";
      initial: any;
    }
  | {
      type: "derivation";
      initial: any;
      gen: (self: Container<any>) => any;
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
        gen: (self: Container<any>) => any;
      }
  )[] = [];
  const getLatest = (v: number) => () => chain[v].current.map((x) => x[1]);
  while (!result.done) {
    if (result.value.type === "state") {
      chain.push({
        type: "state",
        current: new ImmediateValue([[], result.value.initial]),
      });
      let iii = chain.length - 1;
      result = result.resume([
        new Container(iii, getLatest(iii)),
        (value: any) => update({ [iii]: new ImmediateValue([[], value]) }),
      ]);
    } else if (result.value.type === "derivation") {
      chain.push({
        type: "computation",
        current: new ImmediateValue([[], result.value.initial]),
        gen: result.value.gen,
      });
      let iii = chain.length - 1;
      result = result.resume(new Container(iii, getLatest(iii)));
    } else {
      throw new Error("Invalid operation");
    }
  }
  const update = (patch: { [key: number]: Value }) => {
    const currentStateList: Value<[number[], any]>[] = [];
    for (let i = 0; i < chain.length; i++) {
      const old = chain[i];
      if (old.type === "state") {
        currentStateList.push(
          (old.current = patch[i] ? patch[i] : old.current)
        );
      } else {
        currentStateList.push(
          (old.current = computeNew(old.current, currentStateList, old.gen, i))
        );
      }
    }
  };
  update({});
  return result.value;
}

const read: Reader = perform;

function computeNew(
  old: Value<[number[], any]>,
  ctx: Value<[number[], any]>[],
  gen: (self: Container) => any,
  validOffset: number
) {
  /* possible bail out */
  // if(old instanceof ImmediateValue) {
  //   const [s] = old.value;
  // }
  function cont(
    res: ContinuationResult<Container, any>
  ): Value<[number[], any]> {
    if (res.done) {
      return new ImmediateValue([[], res.value]);
    }
    const container = res.value;
    if (container.index > validOffset) {
      return new ImmediateError([[], new Error("Out of index")]);
    }
    const current =
      container.index === validOffset ? old : ctx[container.index];
    return current
      .bind((v) => cont(res.resume(v[1])))
      .map(([s, v]) => [[container.index, ...s], v]);
  }
  return cont(gen(new Container(validOffset, null as any /**fix me */)));
}

export { root, defineState, defineDerivation };
