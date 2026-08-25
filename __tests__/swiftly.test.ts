/* *************************************************************************************************
 swiftly.test.ts
   © 2026 YOCKOW.
     Licensed under MIT License.
     See "LICENSE.txt" for more information.
 ************************************************************************************************ */

/// <reference types="node" />
/// <reference types="vitest/globals" />
import * as exec from '@actions/exec';
import { Swiftly } from '../src/swift-installer-swiftly';

describe("`swiftly` installer tests", () => {
  test('Installer', {timeout: 60_000}, async () => {
    const installer = new Swiftly("6.3.3");
    await installer.setUp();

    try {
      exec.exec("swiftly", ["--version"]);
    } finally {
      await installer.tearDown();
    }
  });
});