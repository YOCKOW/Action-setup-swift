/* *************************************************************************************************
 xcode.test.ts
   © 2019-2026 YOCKOW.
     Licensed under MIT License.
     See "LICENSE.txt" for more information.
 ************************************************************************************************ */

import {
  describe,
  test,
  expect,
} from 'vitest';
import * as common from '../src/common';
import * as xcode from '../src/xcode';

describe('Xcode Tests', () => {
  test('List of Applications', async () => {
    let list = xcode.XcodeInfo.installedUnderApplicationsDirectory();
    if (common.osIsDarwin) {
      expect(list.size).toBeGreaterThan(0)
    } else {
      expect(list.size).toBe(0)
    }

    list = await xcode.XcodeInfo.all();
    if (common.osIsDarwin) {
      expect(list.size).toBeGreaterThan(0)
    } else {
      expect(list.size).toBe(0)
    }
  })
})