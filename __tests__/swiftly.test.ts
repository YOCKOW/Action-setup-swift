/* *************************************************************************************************
 swiftly.test.ts
   © 2026 YOCKOW.
     Licensed under MIT License.
     See "LICENSE.txt" for more information.
 ************************************************************************************************ */

/// <reference types="node" />
/// <reference types="vitest/globals" />
import { exec, warn } from '../src/common';
import { Swiftly } from '../src/swift-installer-swiftly';

describe("`swiftly` installer tests", () => {
  test('Installer', {timeout: 600_000}, async () => {
    if (process.env["GITHUB_ACTIONS"] == void 0) {
      warn("This test runs with GitHub Actions.");
      return;
    }

    const installer = new Swiftly("6.3.3");
    await installer.setUp();

    try {
      await exec("swiftly", ["--version"]);
      await installer.installSwift();
      await installer.switchSwift();
      await installer.finalize();
      await exec("which", ["swift"]);
      await exec("swift", ["--version"]);
    } finally {
      await installer.tearDown();
    }
  });
});