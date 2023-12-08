import { createRoot, createMemo, createSignal, createEffect } from 'solid-js';

type HNode = Node;
type Element = [HNode, Signal<IO>];
type IO = ()=>void;
type Signal<T> = ()=>T;

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
function createElement(tagName: string, isSVG = false): HTMLElement | SVGElement {
  return isSVG ? document.createElementNS(SVG_NAMESPACE, tagName) : document.createElement(tagName);
}
