import { cc } from "../ag-co";

const id = x=>x;

// generate: [result, io]
export const ioCollect = () => {
  return {
    *return(res) {
      return [res,id];
    },
    *cio(fn) {
      const [res, io] = yield* cc(undefined);
      return [res, (x)=>{io(fn(x));}]
    }
  }
}
