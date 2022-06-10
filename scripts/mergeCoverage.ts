// import glob from "fast-glob";
// import { readFile, writeFile } from "fs-extra";
// import path from "path";

// function getLcovFiles(src: string) {
//   return glob(`packages/**/lcov.info`);
// }

// async function mergeCoverage() {
//   const files = await getLcovFiles("coverage");
//   const fileContents = await Promise.all(
//     files.map((x) => readFile(x, { encoding: "utf8" }))
//   );
//   const mergedReport = fileContents.reduce(
//     (mergedReport, c) => (mergedReport += c),
//     ""
//   );
//   await writeFile(path.resolve("./lcov.info"), mergedReport);
// }

// async function cli() {
//   try {
//     await mergeCoverage();
//   } catch (e) {
//     console.error(e);
//     process.exit(1);
//   }
// }

// export { mergeCoverage as build };

// if (require.main === module) cli();

export {};
