import * as os from 'os'
import * as xcode from '../src/xcode'

describe('Xcode Tests', () => {
  test('List of Applications', async () => {
    let list = await xcode.installedXcodeApplicationsUnderApplicationsDirectory()
    if (os.platform() == 'darwin') {
      expect(list.size).toBeGreaterThan(0)
    } else {
      expect(list.size).toBe(0)
    }

    list = await xcode.allInstalledXcodeApplications()
    if (os.platform() == 'darwin') {
      expect(list.size).toBeGreaterThan(0)
    } else {
      expect(list.size).toBe(0)
    }
  })
})