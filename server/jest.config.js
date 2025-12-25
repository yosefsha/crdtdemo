// filepath: /Users/yosefshachnovsky/dev/crdtdemo/server/jest.config.js
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  testPathIgnorePatterns: ["/node_modules/", "/build/"], // Exclude the build directory
  moduleNameMapper: {
    "^@crdtdemo/shared$": "<rootDir>/../shared/index.ts",
    "^@crdtdemo/shared/(.*)$": "<rootDir>/../shared/$1",
  },
};
/*
This tells Jest to use ts-jest as the preset.
ts-jest is a Jest transformer specifically designed for TypeScript. It compiles TypeScript files to JavaScript before running the tests.
This is required to handle .ts and .tsx files in your project.
testEnvironment: "node"

Specifies the environment in which your tests will run.
"node" means the tests will run in a Node.js environment, which is suitable for backend projects or server-side code.
If you're testing browser-based code, you might use "jsdom" instead.
transform

Specifies how Jest should transform files before running tests.
The key is a regular expression (^.+\\.tsx?$) that matches all .ts and .tsx files.
The value ("ts-jest") tells Jest to use ts-jest to transform these files.
moduleFileExtensions

Specifies the file extensions Jest should look for when resolving modules.
This list includes:
ts and tsx: TypeScript files.
js and jsx: JavaScript files.
json: JSON files.
node: Node.js modules.
*/
