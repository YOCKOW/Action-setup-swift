import * as os from 'os'
import * as xcode from '../src/xcode'

describe('Xcode Tests', () => {
  test('List of Applications', async () => {
    const list = await xcode.installedXcodeApplications()
    if (os.platform() == 'darwin') {
      expect(list.length).toBeGreaterThan(0)
    } else {
      expect(list.length).toBe(0)
    }
  })
})