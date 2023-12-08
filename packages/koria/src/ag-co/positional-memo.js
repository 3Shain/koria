import { cc, op } from "../ag-co";

export const read = (fn) => op("read", fn);

export const positionalMemoHandler = (memoList) => {
  let state_cursor = 0; /** unsafe mutation */
  return {
    return: function* (value) {
      return [value, []];
    },
    read: function* ({ fn }) {
      const newValue = yield* fn(memoList[state_cursor], positionalMemoHandler);
      const [ret, list] = yield* cc(newValue);
      state_cursor++;
      return [ret, [newValue, ...list]];
    },
  };
};

export const initialHandler = () => {
  return {
    return: function* (value) {
      return [value, []];
    },
    read: function* ({ fn, init }) {
      const newValue = yield* fn(init, initialHandler);
      const [ret, list] = yield* cc(newValue);
      return [ret, [newValue, ...list]];
    },
  };
};
