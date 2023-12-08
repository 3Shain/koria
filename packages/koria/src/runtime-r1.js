let /** @type {InitEffect} */ d;
let /** @type {InitState} */ s;
let /** @type {SimpleCursor} */ f;

const _ = {},
  id = (x) => x;

const EFF_PROPERTY = 1,
  EFF_ATTR = 2,
  EFF_INSERT_BEFORE = 3,
  EFF_ENSURE_BEFORE = 4,
  EFF_REGISTER_HANDLER = 5;

const EFF_REMOVE = 6;
const EFF_REMOVE_HANDLER = 7;

const normalizeChild = (w) => {
  if (typeof w === "string") {
    return Text(w);
  }
  return w;
};

const normalizeAttrs = ([key, value]) => {
  if (key.startsWith("$:")) {
    const propName = key.substring(2);
    return function setAttribute(node) {
      s.declare((last) => {
        const s = value();
        if (last !== s) {
          d.effect(EFF_ATTR, node, propName, s);
        }
        return s;
      }, _);
    };
  }
  if (key.startsWith("on:")) {
    const hdl = (ev) => {
      value(ev);
    };
    const eventName = key.substring(3);

    return function setupListener(/** @type {HTMLElement} */ node) {
      d.mountEff(EFF_REGISTER_HANDLER, node, eventName, hdl);
      d.disposeEff(EFF_REMOVE_HANDLER, node, eventName, hdl);
    };
  }
  return function staticSetAttribute(node) {
    d.mountEff(EFF_ATTR, node, key, value);
  };
};

export function Fragment({ children }) {
  const p_children = children.flat().map(normalizeChild);

  return function renderFragment() {
    for (const c of p_children) {
      c();
    }
  };
}

export function createElement(type, attrs, ...children) {
  if (typeof type === "function") {
    return type({ ...attrs, children });
  }

  const p_attrs = Object.entries(attrs ?? {}).map(normalizeAttrs);

  const p_children = children.flat().map(normalizeChild);

  return function renderElement() {
    const node = d.getNode(type);

    f.enter(node);
    // inverse travel
    for (let i = p_children.length - 1; i >= 0; i--) {
      p_children[i]();
    }
    f.leave();

    for (const c of p_attrs) {
      c(node);
    }
    d.mount(node);
    return node;
  };
}

export function Text(content) {
  if (typeof content === "function") {
    return () => {
      const node = d.getTextNode();
      s.declare((last) => {
        const current = content();
        if (last != current) {
          d.effect(EFF_PROPERTY, node, "textContent", current);
        }
        return current;
      }, _);
      d.mount(node);
      return node;
    };
  }
  return function renderText() {
    const node = d.getTextNode();
    d.mountEff(EFF_PROPERTY, node, "textContent", content);
    d.mount(node);
    return node;
  };
}

export function If(/** @type {{when:boolean, then:any , else: any}} */ body) {
  return function renderCondition() {
    s.declare(function checkCondition(last) {}, _);
  };
}

export function ForEach(/** @type {for,each,index} */ body) {
  body.index || (body.index = id);
  return function renderForEach() {
    s.declare(
      function reconcile(last) {
        const current = body.for();
        const old = last.for;
        const oldLength = last.for.length;
        const oldRenderList = last.renderList;
        const newRenderList = new Array(current.length);
        // then aEnd
        let aStart = 0,
          aEnd = current.length,
          bStart = 0,
          bEnd = oldLength;
        const toBeRendered = [];
        while (true) {
          if (aEnd - aStart === 0) {
            // current is empty, just remove [bStart:bEnd] nodes
            for (let i = bStart; i < bEnd; i++) {
              // console.log(oldRenderList[i].disposes);
              d.effect(...oldRenderList[i].disposes);
            }
            break;
          }
          if (bEnd - bStart === 0) {
            // last is empty, just create and render [aStart:aEnd] nodes
            for (let i = aEnd - 1; i >= aStart; i--) {
              const data = current[i];
              const render = body.each(data);

              const tmp = s,
                tmp2 = d,tmp3 = f.collectCleanup;
              s = new InitState();
              d = new InitEffect();
              f.collectCleanup = true;
              render();
              const eff = d.effects;

              newRenderList[i] = {
                disposes: d.disposes,
                render: render,
                state: s.state,
              };
              f.collectCleanup = tmp3;
              s = tmp;
              d = tmp2;
              d.effect(...eff);
            }
            break;
          }
          // same tail
          if (current[aEnd - 1] === old[bEnd - 1]) {
            // just render this node
            // node at [bEnd -1], render it now
            const { render, state } = oldRenderList[bEnd - 1];
            const tmp = s;
            s = new MutateState(state);
            render();
            s = tmp;
            newRenderList[aEnd - 1] = oldRenderList[bEnd - 1]; // the whole strucutre is mutable
            aEnd--, bEnd--;
            continue;
          }
          // same head
          if (current[aStart] === old[bStart]) {
            toBeRendered.push(aStart, bStart, false); // node at current[aStart], scheduled to be rendered, without adjusting position
            aStart++;
            bStart++;
            continue;
          }
          // the new tail is the old head
          if (current[aEnd - 1] === old[bStart]) {
            // node at current[aEnd - 1] already exist but the position shall be adjusted
            const { render, state } = oldRenderList[bStart];
            const tmp = s;
            s = new MutateState(state);
            f.adjust = true;
            render();
            f.adjust = false;
            s = tmp;
            newRenderList[aEnd - 1] = oldRenderList[bStart]; // the whole strucutre is mutable
            aEnd--, bStart++;
            continue;
          }
          // the old tail is the new head
          if (old[bEnd - 1] === current[aStart]) {
            // node at current[aStart] should be delayed
            toBeRendered.push(aStart, bEnd - 1, true); //
            bEnd--, aStart++;
            continue;
          }
          // then it's the chaos!
          throw new Error("not immplemented yet!");
        }
        for (let i = toBeRendered.length; i > 0; i-=3) {
          const a = toBeRendered[i-3],b = toBeRendered[i-2], adj = toBeRendered[i-1];
          const { render, state } = oldRenderList[b];
          // console.log(oldRenderList[b])
          const tmp = s,tmp2 = f.adjust;
          s = new MutateState(state);
          f.adjust = adj;
          render();
          s = tmp;
          f.adjust = tmp2;
          newRenderList[a] = oldRenderList[b];
        }
        return {
          for: current,
          renderList: newRenderList
        }
      },
      {
        for: [],
        renderList: [],
      }
    );
  };
}

const dom = {
  createElement: (x) => document.createElement(x),
  createTextNode: (x) => document.createTextNode(x),
  insertBefore: (/** @type {Node} */ p, a, b) => p.insertBefore(a, b),
  addEventListener: (/** @type {Node} */ p, t, a) =>
    p.addEventListener(a, t, a),
  removeEventListener: (/** @type {Node} */ p, t, a) =>
    p.removeEventListener(a, t, a),
};

class SimpleCursor {
  constructor(parent, cursor) {
    this.parent = parent;
    this.cursor = cursor;
    this.adjust = false;
    this.collectCleanup = false;
    this.childrenTS = [];
  }

  enter(x) {
    this.childrenTS.push(
      this.parent,
      this.cursor,
      this.adjust,
      this.collectCleanup
    );
    this.parent = x;
    this.cursor = null;
    this.adjust = false;
    this.collectCleanup = false;
  }

  leave() {
    this.collectCleanup = this.childrenTS.pop();
    this.adjust = this.childrenTS.pop();
    this.cursor = this.childrenTS.pop();
    this.parent = this.childrenTS.pop();
  }

  setAdjust(x) {
    this.adjust = x;
  }
}

class InitEffect {
  constructor() {
    this.effects = [];
    this.disposes = [];
  }

  getNode(type) {
    const node = dom.createElement(type);
    s.grabOrStore(node);
    return node;
  }

  getTextNode() {
    const node = dom.createTextNode("");
    s.grabOrStore(node);
    return node;
  }

  effect(...args) {
    this.effects.push(...args);
  }

  mount(node) {
    this.effects.push(EFF_INSERT_BEFORE, f.parent, node, f.cursor);
    // TODO
    if (f.collectCleanup) {
      /** ？ */
      this.disposes.push(EFF_REMOVE, node);
    }
    f.cursor = node;
  }

  mountEff(...args) {
    this.effects.push(...args);
  }

  disposeEff(...args) {
    this.disposes.push(...args);
  }

  finally() {}
}

class CheckEffect {
  constructor(parent, cursor) {
    this.effects = [];
  }

  getNode(type) {
    return s.grabOrStore();
  }

  getTextNode() {
    return s.grabOrStore();
  }

  effect(...args) {
    this.effects.push(...args);
  }

  mount(node) {
    // should check movement?
    if (f.adjust) {
      this.effects.push(EFF_INSERT_BEFORE, f.parent, node, f.cursor);
    }
    f.cursor = node;
  }

  mountEff(...args) {
    //nop
  }

  disposeEff(...args) {
    //nop
  }

  finally() {}
}

class InitState {
  constructor() {
    this.state = [];
  }

  grabOrStore(x) {
    this.state.push(x);
  }

  declare(fn, init) {
    this.state.push(fn(init));
    return this.state[this.state.length - 1];
  }

  finally() {}
}

class MutateState {
  constructor(state) {
    this.state = state;
    this.index = 0;
  }

  grabOrStore(x) {
    return this.state[this.index++];
  }

  declare(fn, init) {
    const ret = (this.state[this.index] = fn(this.state[this.index]));
    this.index++;
    return ret;
  }

  finally() {}
}

export function createApp(fn) {
  let state = null;
  let handlerMap = new Map();

  function render(container) {
    f = new SimpleCursor(container, null);
    if (state === null) {
      s = new InitState();
      state = s.state;
      d = new InitEffect();
    } else {
      s = new MutateState(state);
      d = new CheckEffect();
    }
    fn();
    let i = 0;
    while (i < d.effects.length) {
      const op = d.effects[i++];
      switch (op) {
        case EFF_ATTR:
          d.effects[i++].setAttribute(d.effects[i++], d.effects[i++]);
          break;
        case EFF_INSERT_BEFORE:
          const parent = d.effects[i++],
            node = d.effects[i++],
            cursor = d.effects[i++];
          parent.insertBefore(node, cursor);
          break;
        case EFF_PROPERTY:
          d.effects[i++][d.effects[i++]] = d.effects[i++];
          break;
        case EFF_REGISTER_HANDLER:
          d.effects[i++].addEventListener(
            d.effects[i++],
            (() => {
              const h = d.effects[i++];
              handlerMap.set(h, (x) => {
                h(x);
                render(container); //wtf!
              });
              return handlerMap.get(h);
            })()
          );
          break;
        case EFF_REMOVE:
          d.effects[i++].remove();
          break;
        case EFF_REMOVE_HANDLER:
          d.effects[i++].removeEventListener(d.effects[i++], (() => {
            const hh = d.effects[i++];
            return handlerMap.get(hh);
          })());
          break;
        default:
          throw new Error("unknown eff");
      }
    }
    s = null;
    d = null;
    f = null;
  }

  return {
    mount(container) {
      if (state !== null) {
        throw new Error("Already mounted");
      }
      render(container);
    },
    dispose() {
      if (state !== null) {
        state = null;
        return;
      }
      throw new Error("Not mounted");
    },
  };
}
