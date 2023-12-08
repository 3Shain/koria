export function* cc(payload) {
  return yield {
    type: "continue",
    payload,
  };
}

export function* op(type, payload) {
  return yield {
    type,
    payload,
  };
}

export function* handle(gen, handler) {
  const stack = [];
  let cont_v = undefined;
  let final = undefined;
  exit:while (true) {
    const p = gen.next(cont_v);
    if (p.done) {
      final = p.value;
      break exit;
    }
    if (p.value.type in handler) {
      const handlerGen = handler[p.value.type](p.value.payload);
      let cont_s = undefined;
      while (true) {
        const v = handlerGen.next(cont_s);
        if (v.done) {
          // 说明没有cc就提前返回了
          final = v.value;
          break exit;
        }
        if (v.value.type === "continue") {
          cont_v = v.value.payload;
          stack.push(handlerGen);
          break;
        } else {
          console.log('dont know '+ v.value.type)
          cont_s = yield v.value; //forward
        }
      }
    } else {
      cont_v = yield p.value; //forward
    }
  }
  let cont_d = yield* handler.return(final);
  while (stack.length > 0) {
    const last = stack.pop();
    let cont_l = cont_d;
    while (true) {
      const y = last.next(cont_l);
      if (y.done) {
        cont_d = y.value;
        break;
      } else {
        if (y.type === "continue") {
          throw new Error("Multi prompt is not allowed");
        }
        cont_l = yield y.value;
      }
    }
  }
  return cont_d;
}

export function* handleFn(fn, handler) {
  return handle(fn(), handler)
}

export function step(gen) {
  let cont_v = undefined;
  while (true) {
    const p = gen.next(cont_v);
    if (p.done) {
      return p.value;
    }
    if (p.value.type === "io") {
      cont_v = p.value.payload();
    } else if (p.value.type === "throw") {
      throw p.value.payload;
    } else {
      throw new Error("Unknown operation " + p.value.type);
    }
  }
}
