import { describe, it } from "vitest";
import {
  iter_array,
  iter_array_reverse,
  op,
  ret,
  seq,
  state,
  step,
} from "./ag-ef";

describe("ag-ef", () => {
  it("wwwww", async () => {
    // step(iter_array_reverse([0,1,4,5], x=>op('io', ()=>{
    //   console.log(x);
    // })))

    step(
      state(0, (get, set) => {
        return seq(set(114514), (_) =>
          seq(get(), (v) =>
            seq(set(1919810), (_) =>
              seq(get(), (v) =>
                op("io", () => {
                  console.log(v + ":output");
                })
              )
            )
          )
        );
      })
    );
  });

});
