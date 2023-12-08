import { describe, it } from "vitest";
import { op, step, handle, cc } from "./ag-co";

describe("ag-co", () => {
  it("wwwww", async () => {
    const v = step(
      handle(
        (function* () {
          const v = yield* op("log", "hello");
          yield* op("log", v);
          yield* op("log", "world");
          return yield* handle(
            (function* () {
              const v = yield* op("log", "hello");
              yield* op("log", v);
              yield* op("log", "world");
            })(),
            {
              return: function* (v) {
                return [v, "stop"];
              },
              log: function* (content) {
                yield* op("log", "nest-log:" + content);
                const [v, str] = yield* cc(114514);
                yield* op("io", () => {
                  console.log("nested:" + content);
                });
                return [v, `${str} ${content}`];
              },
            }
          );
        })(),
        {
          return: function* (v) {
            return [v, "start"];
          },
          log: function* (content) {
            yield* op("io", () => {
              console.log(content);
            });
            const [v, str] = yield* cc(undefined);
            return [v, `${str} ${content}`];
          },
        }
      )
    );
    console.log(v[1]);
    console.log(v[0][1]);
  });
});
