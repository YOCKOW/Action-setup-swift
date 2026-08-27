/* *************************************************************************************************
 common.test.ts
   © 2026 YOCKOW.
     Licensed under MIT License.
     See "LICENSE.txt" for more information.
 ************************************************************************************************ */

/// <reference types="node" />
/// <reference types="vitest/globals" />
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as common from '../src/common';

describe("Common tool tests", () => {
  test('Response Header', async () => {
    const normalHeader = await common.responseHeader(new URL("https://httpcan.org/get"));
    expect(normalHeader.statusCode).toBe(200);
    
    const redirectHeader = await common.responseHeader(new URL("https://httpcan.org/redirect/5"));
    expect(redirectHeader.statusCode).toSatisfy((value) => (300 <= value && value < 400));
  });

  test('Redirect', async () => {
    const redirectedURL = await common.redirectedURL(new URL("https://httpcan.org/redirect/5"));
    expect(redirectedURL).toStrictEqual(new URL("https://httpcan.org/get"));
    expect(await common.redirectedURL(redirectedURL)).toStrictEqual(redirectedURL);
  })

  test('Download', async () => {
    const tmpDirPath = path.join(os.tmpdir(), crypto.randomUUID());
    await fs.promises.mkdir(tmpDirPath);
    try {
      const localFilePath = path.join(tmpDirPath, crypto.randomUUID());
      await common.download(new URL("https://httpcan.org/html"), localFilePath);
      const fileContent = await fs.promises.readFile(localFilePath, {encoding: 'utf-8'});
      expect(fileContent).contains("<html>");
    } finally {
      await fs.promises.rm(
        tmpDirPath,
        {
          recursive: true,
          force: true
        }
      )
    }
  });
});