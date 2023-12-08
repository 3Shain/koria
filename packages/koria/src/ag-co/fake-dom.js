import { cc, op } from "../ag-co";
import { read } from "./positional-memo";

const findDom = (type) => op('findDom', type);
const mountDom = (node) => op('mountDom', node);
const unmountDom = (node) => op('unmountDom', node);
const setupCursor = (node) => op('setupCursor', node);
const enterNode = (node) => op('enterNode', node);
const leaveNode = (node) => op('leaveNode', node);
const queryState = (node) => op('queryState', node);

export function createElement(type, props, ...children) {
  return function*() {
    const domNode = yield* findDom(type);
    yield* mountDom(domNode); //mount to where?

    yield* setupCursor(domNode);
    //deal with props

    //deal with children
    yield* enterNode(domNode);
    for(const child of children) {
      yield* child();
    }
    yield* leaveNode(domNode/** ? not necessary */);


    yield* unmountDom(domNode);
  }
}

export function Text(content) {
  return function*() {
    const domNode = yield* findDom('text');
    yield* mountDom(domNode); //mount to where?

    domNode.textContent = content; // not good

    yield* setupCursor(domNode);
    //deal with content read?
    yield* unmountDom(domNode);
  }
}

export const initDomHandler = (container) => {
  let current_cursor = container.lastChild;
  let parentCursor = container;
  const stack = [];
  return {
    *return(v) {
      return [v,()=>{},()=>{}];
    },
    *findDom(type) {
      if(type==='text') {
        return yield* cc(document.createTextNode(''));
      }
      return yield* cc(document.createElement(type));
    },
    *mountDom(node) {
      // get current cursor
      const cursor = current_cursor;
      const parent = parentCursor;
      const [v,s,p] = yield* cc(undefined);
      return [v,() => {
        if(cursor.nextSibling !== node) {
          if(cursor.nextSibling === null) {
            parent.insertBefore(node, cursor);
          } else {
            parent.insertBefore(node, cursor.nextSibling);
          }
        }
        s();
      },p];
    },
    *unmountDom(node) {
      //
      const [v,s,p] = yield* cc(undefined);
      return [v,s,()=>{
        node.remove();
        p();
      }]
    },
    *setupCursor(node) {
      current_cursor = node;
      return yield* cc(undefined);
    },
    *enterNode(node) {
      stack.push(current_cursor, parentCursor);
      if(!node.firstChild) {
        node.appendChild(document.createTextNode("")); // empty anchor
      }
      current_cursor = node.firstChild;
      parentCursor = node;
      return yield* cc(undefined);
    },
    *leaveNode(node) {
      parentCursor = stack.pop();
      current_cursor = stack.pop();
      return yield* cc(undefined);
    }
  }
}

export function Switch(value, then, otherwise) {
  return function*() {
    yield* read({
      fn:function*(pstate, stateHandler){
        const current = yield* queryState(value);

        // determine: constuction or simply normal check
        // if(current) {
        //   yield* then();
        // } else {
        //   yield* otherwise();
        // }
      },
      init: {}
    });
  }
}
