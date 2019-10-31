import XCTest

import swift_test_package_tests

var tests = [XCTestCaseEntry]()
tests += swift_test_package_tests.__allTests()

XCTMain(tests)
