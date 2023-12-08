class Op {
  constructor(type, payload, cont) {
    if (type === "op") {
      console.log(type);
      throw new Error("wtf?");
    }
    this.type = type;
    this.payload = payload;
    this.cont = cont;
  }
}

class Ret {
  constructor(value) {
    this.value = value;
  }
}

function seq(cp, then) {
  if (cp instanceof Op) {
    return new Op(cp.type, cp.payload, (x) => seq(cp.cont(x), then));
  }
  if (cp instanceof Ret) {
    return then(cp.value);
  }
  throw new Error("panic");
}

function op(type, payload, then) {
  return new Op(type, payload, then);
}

function g_op(type, payload) {
  return op(type, payload, ret);
}

function ret(value) {
  return new Ret(value);
}

function handle(cp, type, handler) {
  if (cp instanceof Op) {
    if (cp.type === type) {
      return handler(cp.payload, (x) => handle(cp.cont(x), type, handler));
    } else {
      return new Op(cp.type, cp.payload, (x) =>
        handle(cp.cont(x), type, handler)
      );
    }
  }
  if (cp instanceof Ret) {
    return cp;
  }
  console.log(cp);
  throw new Error("panic");
}

function handle_1(cp, type, handlers) {
  if (cp instanceof Op) {
    if (cp.type in handlers) {
      return handlers[cp.type](cp.payload, (x) =>
        handle_1(cp.cont(x), type, handlers)
      );
    } else {
      return new Op(cp.type, cp.payload, (x) =>
        handle_1(cp.cont(x), type, handlers)
      );
    }
  }
  if (cp instanceof Ret) {
    return cp;
  }
  console.log(cp);
  throw new Error("panic");
}

const fix = (x) => (x.length > 0 ? seq(g_op("iter", x), fix) : ret(void 0));
function iter_array(array, then) {
  return handle(fix(array), "iter", (array, cont) => {
    return seq(then(array[0]), (_) => cont(array.slice(1)));
  });
}

export function iter_array_reverse(array, then) {
  return handle(fix(array), "iter", (array, cont) => {
    // return seq(then(array[0]), (_) => cont(array.slice(1)));
    return seq(cont(array.slice(1)), (_) => then(array[0]));
  });
}

function step(cc) {
  while (true) {
    if (cc instanceof Ret) {
      return cc.value;
    } else if (cc instanceof Op) {
      if (cc.type === "io") {
        cc = cc.cont(cc.payload());
      } else if (cc.type === "throw") {
        throw cc.payload;
      } else {
        console.log(cc.type);
        throw new Error(`undefined operation --${cc.type.toString()}`);
      }
    } else {
      throw new Error("undefined computation");
    }
  }
}
export function state_1(init, program) {
  const getSymbol = Symbol("get"),
    setSymbol = Symbol("set");
  const get = (v) => g_op(getSymbol, v);
  const set = (v) => g_op(setSymbol, v);
  return seq(
    handle_1(
      seq(program(get, set), (value) => ret((_) => ret(value))),
      {
        [getSymbol]: (_, cont) => ret((s) => seq(cont(s), (f) => f(s))),
        [setSymbol]: (value, cont) =>
          ret((_) => seq(cont(void 0), (f) => f(value))),
      }
    ),
    (f) => f(init)
  );
}
export function state(init, program) {
  const getSymbol = Symbol("get"),
    setSymbol = Symbol("set");
  const get = (v) => g_op(getSymbol, v);
  const set = (v) => g_op(setSymbol, v);

  // otherwise the get closure fn doesn't know about set handler
  // or define handler object

  // root cause: inner handler can not invoke outer handler
  // how handler object solve: convert to self invoke (handler can invoke itself).
  const recursiveHandling = (pg) => {
    return handle(
      handle(
        pg,
        getSymbol,
        (_, cont) => ret((s) => seq(recursiveHandling(cont(s)), (f) => f(s)))
      ),
      setSymbol,
      (value, cont) => ret((_) => seq(cont(void 0), (f) => f(value)))
    )
  }

  return seq(
    recursiveHandling(seq(program(get, set), (value) => ret((_) => ret(value)))),
    (f) => f(init)
  );
}

export { g_op as op, seq, handle, iter_array, ret, step };
