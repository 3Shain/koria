let d;

const _ = {};

const normalizeChild = (w) => {
  if (typeof w === "string") {
    return Text(w);
  }
  return w;
};

const normalizeAttrs = ([key, value]) => {
  if (key.startsWith("$:")) {
    const propName = key.substring(2);
    return (node) => {
      d.state((last) => {
        const s = value();
        if (last !== s) {
          d.insertEffect(() => node.setAttribute(propName, s));
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
    // const initS = {
    //   handler:_,
    //   dispose: ()=>{} //nop
    // };
    return (/** @type {HTMLElement} */ node) => {
      d.state((last) => {
        if (last === _) {
          d.insertEffect(() => {
            node.addEventListener(eventName, hdl);
          });
          d.dispose(() => {
            node.removeEventListener(eventName, hdl);
          });
          return {};
        }
        return last;
      }, _);
    };
  }
  return (node) => {
    d.state((last) => {
      if (last === _) {
        d.insertEffect(() => node.setAttribute(key, value));
        return {};
      }
      return last;
    }, _);
  };
};

export function Fragment({ children }) {
  const p_children = children.map(normalizeChild).flat();

  return () => {
    for (const c of p_children) {
      c();
    }
  };
}

export function createElement(type, attrs, ...children) {
  const p_attrs = Object.entries(attrs ?? {}).map(normalizeAttrs);

  const p_children = children.map(normalizeChild).flat();

  return () => {
    const node = d.findDom(type);

    d.enterDom();
    for (const c of p_children) {
      c();
    }
    d.exitDom();

    for (const c of p_attrs) {
      c(node);
    }

    return node;
  };
}

export function Text(content) {
  if (typeof content === "function") {
    return () => {
      const node = d.findDom("text");
      d.state((last) => {
        const state = content();
        if (state !== last) {
          d.insertEffect(() => (node.textContent = state));
        }
        return state;
      }, _);
    };
  }
  return () => {
    const node = d.findDom("text");
    d.state((last) => {
      if (last === _) {
        d.insertEffect(() => (node.textContent = content));
        return {};
      }
      return last;
    }, _);
  };
}

export function If(pred, match, alternative) {
  return () => {
    d.state(
      (last) => {
        const value = !!pred(),
          toRender = value ? match : alternative;
        const toRecover = d;
        if (last.value !== value) {
          last.disposes.forEach((x) => d.insertEffect(x));
          d = new StatefulInitContext(d.parent, d.cursor);
        } else {
          // update
          d = new StatefulUpdateContext(last.stateGraph, d.parent, d.cursor);
          d.disposes = last.disposes; // forward-pass through
        }
        toRender();
        const ret = d;
        d = toRecover;
        d.resetCursor(ret.parent, ret.cursor);

        ret.effects.forEach((x) => d.insertEffect(x));
        return {
          value,
          stateGraph: ret.stateGraph,
          disposes: ret.disposes,
        };
      },
      { value: _, disposes: [], stateGraph: [] }
    );
  };
}

export function List(source, factory) {
  return () => {
    const current = source();
    console.log("render list");
    d.state(
      (last) => {
        let old = last.old;
        let new_ = new Map();
        const toRecover = d;
        let lastContext = d;
        for (const item of current) {
          if (old.has(item)) {
            const oldState = old.get(item);
            d = new StatefulUpdateContextWithMovementCheck(
              oldState.stateGraph,
              lastContext.parent,
              lastContext.cursor
            );
            oldState.render();
            new_.set(item, {
              stateGraph: d.stateGraph,
              disposes: oldState.disposes,
              render: oldState.render,
            });
            console.log("rendering old items");
          } else {
            d = new StatefulInitContext(lastContext.parent, lastContext.cursor);
            const render = factory(item);
            render();
            new_.set(item, {
              stateGraph: d.stateGraph,
              disposes: d.disposes,
              render,
            });
            console.log("rendering new item");
          }
          lastContext = d;
          d.effects.forEach((x) => toRecover.insertEffect(x));
        }
        d = toRecover;
        d.resetCursor(lastContext.parent, lastContext.cursor);
        for (const k of old.keys()) {
          if (!new_.has(k)) {
            console.log("removing unneeded item");
            old.get(k).disposes.forEach((x) => d.insertEffect(x));
          }
        }
        return {
          old: new_,
        };
      },
      {
        old: new Map(),
      }
    );
  };
}

class StatefulInitContext {
  constructor(parent, cursor) {
    this.parent = parent;
    this.cursor = cursor;
    this.stack = [];
    this.effects = [];
    this.disposes = [];
    this.stateGraph = [];
  }

  findDom(type) {
    const node =
      type === "text"
        ? document.createTextNode("")
        : document.createElement(type);
    const c_cursor = this.cursor,
      c_parent = this.parent;
    this.insertEffect((_) => {
      if (c_cursor !== null) {
        c_parent.insertBefore(
          node,
          c_cursor.nextSibling /* could be null, then append */
        );
      } else {
        c_parent.appendChild(node);
      }
    });
    this.cursor = node;
    this.stateGraph.push(node);
    this.disposes.push(() => {
      node.remove();
    });
    return node;
  }

  enterDom() {
    this.stack.push(this.cursor, this.parent, this.stateGraph);
    this.stateGraph = [];
    this.parent = this.cursor;
    this.cursor = this.parent.firstChild; // ??
  }

  exitDom() {
    const cStateGraph = this.stateGraph;
    this.stateGraph = this.stack.pop();
    this.stateGraph.push(cStateGraph);
    this.parent = this.stack.pop();
    this.cursor = this.stack.pop();
  }

  insertEffect(fn) {
    this.effects.push(fn);
  }

  state(fn, init) {
    const v = fn(init);
    this.stateGraph.push(v);
    return v; //
  }

  dispose(fn) {
    this.disposes.push(fn);
  }

  resetCursor(parent, cursor) {
    this.parent = parent;
    this.cursor = cursor;
  }
}

class StatefulUpdateContext {
  constructor(stateGraph, parent, cursor) {
    this.parent = parent;
    this.cursor = cursor;
    this.stack = [];
    this.effects = [];
    this.stateGraph = [];
    this.oldStateGraph = stateGraph;
    this.travelIndex = 0;
  }

  findDom(type) {
    const node = this.oldStateGraph[this.travelIndex++];
    this.stateGraph.push(node);
    this.cursor = node;
    return node;
  }

  enterDom() {
    this.stack.push(
      this.cursor,
      this.parent,
      this.stateGraph,
      this.oldStateGraph,
      this.travelIndex
    );
    this.stateGraph = [];
    this.oldStateGraph = this.oldStateGraph[this.travelIndex++];
    this.travelIndex = 0;
    this.parent = this.cursor;
    this.cursor = this.parent.firstChild; // ??
  }

  exitDom() {
    this.travelIndex = this.stack.pop() + 1;
    this.oldStateGraph = this.stack.pop();
    const cStateGraph = this.stateGraph;
    this.stateGraph = this.stack.pop();
    this.stateGraph.push(cStateGraph);
    this.parent = this.stack.pop();
    this.cursor = this.stack.pop();
  }

  insertEffect(fn) {
    this.effects.push(fn);
  }

  state(fn, init) {
    const v = fn(this.oldStateGraph[this.travelIndex++]);
    this.stateGraph.push(v);
    return v; //
  }

  dispose(fn) {
    // nop
  }

  resetCursor(parent, cursor) {
    this.parent = parent;
    this.cursor = cursor;
  }
}

class StatefulUpdateContextWithMovementCheck extends StatefulUpdateContext {
  findDom(type) {
    const node = this.oldStateGraph[this.travelIndex++];
    this.stateGraph.push(node);
    const c_cursor = this.cursor,
      c_parent = this.parent;
    this.insertEffect((recehck) => {
      if (c_cursor !== null) {
        if (c_cursor.nextSibling !== node && c_cursor !== node /** 这个地方有问题 */) {
          c_parent.insertBefore(
            node,
            c_cursor.nextSibling /* could be null, then append */
          );
        }
      } else {
        console.log(node);
        c_parent.appendChild(node);
      }
    });
    this.cursor = node;
    return node;
  }
}

const renderStateId = Symbol();

export function render(fn, container) {
  let k;
  if ((k = container[renderStateId])) {
    d = new StatefulUpdateContext(k.state, container, null);
  } else {
    d = new StatefulInitContext(container, container.lastChild);
  }
  fn();
  console.log(d.effects);
  for (let s of d.effects) {
    s();
  }
  container[renderStateId] = {
    state: d.stateGraph,
    disposes: d.disposes, // ? wrong logic
  };
  d = null;
}
